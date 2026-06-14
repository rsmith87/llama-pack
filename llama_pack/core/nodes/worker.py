from __future__ import annotations

import asyncio
import io
import logging
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from pathlib import Path
from time import monotonic
from typing import Any

import httpx

from llama_pack.core.config import AppConfig
from llama_pack.core.model_assets.library import GgufLibrary
from llama_pack.core.model_assets.transfers import TransferManager
from llama_pack.core.orchestration.job_contracts import (
    batch_cases_from_llm_batch,
    chat_payload_from_llm_generate,
    download_payload_from_model_download,
    embed_payload_from_llm_embed,
    install_payload_from_model_install,
)
from llama_pack.core.runtime.process_manager import ProcessManager


WorkerRequest = Callable[[str, str, dict[str, Any] | None, dict[str, str] | None], Awaitable[Any]]
WorkerChat = Callable[[str, dict[str, Any]], Awaitable[tuple[dict[str, Any], dict[str, str]]]]
WorkerEmbeddings = Callable[[str, list[str], str], Awaitable[tuple[dict[str, Any], dict[str, str]]]]
WorkerTransferStream = Callable[[str, dict[str, str]], Awaitable[Any]]
WorkerDownloadManager = Any
logger = logging.getLogger(__name__)


class AgentWorker:
    def __init__(
        self,
        config: AppConfig,
        request: WorkerRequest | None = None,
        chat: WorkerChat | None = None,
        embeddings: WorkerEmbeddings | None = None,
        transfer_stream: WorkerTransferStream | None = None,
        download_manager: WorkerDownloadManager | None = None,
        gguf_library: Any | None = None,
        process_manager: Any | None = None,
        transfer_manager: Any | None = None,
    ):
        self.config = config
        self._request = request or self._default_request
        self._chat = chat
        self._embeddings = embeddings
        self._transfer_stream = transfer_stream or self._default_transfer_stream
        self._transfer_manager = transfer_manager or TransferManager(config)
        self._download_manager = download_manager
        self._gguf_library = gguf_library
        self._process_manager = process_manager
        self._task: asyncio.Task | None = None
        self._stop_event: asyncio.Event | None = None

    @property
    def enabled(self) -> bool:
        return bool(
            self.config.mode == "agent"
            and self.config.agent_worker_enabled
            and self.config.controller_url
            and self.config.node_name
        )

    @property
    def running(self) -> bool:
        return bool(self._task is not None and not self._task.done())

    async def start(self) -> None:
        if not self.enabled or self._task is not None:
            return
        self._stop_event = asyncio.Event()
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        if self._task is None:
            return
        assert self._stop_event is not None
        self._stop_event.set()
        await self._task
        self._task = None
        self._stop_event = None

    async def _loop(self) -> None:
        assert self._stop_event is not None
        while not self._stop_event.is_set():
            try:
                await self.run_once()
            except Exception:
                logger.exception("Agent worker poll failed")
            try:
                await asyncio.wait_for(
                    self._stop_event.wait(),
                    timeout=self.config.agent_worker_poll_interval_seconds,
                )
            except TimeoutError:
                continue

    async def run_once(self) -> int:
        if not self.enabled:
            return 0
        claims = await self._claim()
        for claim in claims:
            await self._handle_claim(claim)
        return len(claims)

    async def _claim(self) -> list[dict[str, Any]]:
        payload = {
            "max_jobs": self.config.agent_worker_max_jobs,
            "labels": self.config.agent_worker_labels,
            "capacity": self.config.agent_worker_capacity,
        }
        response = await self._request("POST", self._url(f"/nodes/{self.config.node_name}/work/claim"), payload, self._headers())
        return response if isinstance(response, list) else []

    async def _handle_claim(self, claim: dict[str, Any]) -> None:
        job = claim.get("job") if isinstance(claim.get("job"), dict) else {}
        attempt_id = str(claim.get("attempt_id", ""))
        job_type = str(job.get("type", ""))
        if not attempt_id:
            return
        if job_type == "llm.generate":
            await self._run_llm_generate(attempt_id, job)
            return
        if job_type == "model.transfer":
            await self._run_model_transfer(attempt_id, job)
            return
        if job_type == "model.download":
            await self._run_model_download(attempt_id, job)
            return
        if job_type == "model.install":
            await self._run_model_install(attempt_id, job)
            return
        if job_type == "llm.embed":
            await self._run_llm_embed(attempt_id, job)
            return
        if job_type == "llm.batch":
            await self._run_llm_batch(attempt_id, job)
            return
        await self._fail(attempt_id, "UNSUPPORTED_JOB_TYPE", f"Unsupported job type: {job_type}", retryable=False)

    async def _run_llm_generate(self, attempt_id: str, job: dict[str, Any]) -> None:
        job_id = str(job.get("id", ""))
        if await self._is_cancel_requested(job_id):
            await self._fail(attempt_id, "CANCELED", "Job canceled before execution", retryable=False)
            return
        await self._progress(attempt_id, {"stage": "started", "job_type": "llm.generate"})
        started = monotonic()
        try:
            if self._chat is None:
                raise RuntimeError("Agent worker chat executor is not configured")
            model, chat_payload = chat_payload_from_llm_generate(job.get("payload", {}))
            response, route_meta = await self._chat(model, {**chat_payload, "target": "local"})
            elapsed_ms = int((monotonic() - started) * 1000)
            if await self._is_cancel_requested(job_id):
                await self._fail(attempt_id, "CANCELED", "Job canceled after model execution", retryable=False)
                return
            await self._complete(
                attempt_id,
                {
                    "response": response,
                    "route": route_meta,
                    "model": model,
                    "target": chat_payload.get("target", "local"),
                    "worker_node": self.config.node_name,
                    "elapsed_ms": elapsed_ms,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                },
            )
        except ValueError as exc:
            await self._fail(attempt_id, "INVALID_JOB_PAYLOAD", str(exc), retryable=False)
        except httpx.HTTPStatusError as exc:
            retryable = exc.response.status_code >= 500
            await self._fail(attempt_id, "UPSTREAM_HTTP_ERROR", str(exc), retryable=retryable)
        except httpx.HTTPError as exc:
            await self._fail(attempt_id, "UPSTREAM_TRANSPORT_ERROR", str(exc), retryable=True)
        except Exception as exc:
            await self._fail(attempt_id, "EXECUTION_ERROR", str(exc), retryable=True)

    async def _run_model_transfer(self, attempt_id: str, job: dict[str, Any]) -> None:
        job_id = str(job.get("id", ""))
        payload = job.get("payload", {})
        if await self._is_cancel_requested(job_id):
            await self._fail(attempt_id, "CANCELED", "Job canceled before transfer", retryable=False)
            return
        await self._progress(attempt_id, {"stage": "manifest", "job_type": "model.transfer"})
        try:
            source_node = str(payload["source_node"])
            source_file_id = str(payload["source_file_id"])
            source_base = self._api_base_url(str(payload["source_url"]))
            transfer_headers = {"Authorization": f"Bearer {payload['transfer_token']}"}
            manifest = await self._transfer_stream(
                f"{source_base}/transfer-source/ggufs/{source_file_id}/manifest",
                transfer_headers,
            )
            files = manifest.get("files", []) if isinstance(manifest, dict) else []
            copied = []
            skipped = []
            bytes_copied = 0
            for index, manifest_file in enumerate(files, start=1):
                if await self._is_cancel_requested(job_id):
                    await self._fail(attempt_id, "CANCELED", "Job canceled during transfer", retryable=False)
                    return
                await self._progress(
                    attempt_id,
                    {
                        "stage": "copying",
                        "file_index": index,
                        "files_total": len(files),
                        "relative_path": manifest_file.get("relative_path"),
                    },
                )
                stream = await self._transfer_stream(
                    f"{source_base}/transfer-source/files/{manifest_file['id']}/content",
                    transfer_headers,
                )
                result = self._transfer_manager.write_manifest_file(manifest_file, stream)
                if result["status"] == "copied":
                    copied.append(result)
                    bytes_copied += int(result["bytes"])
                else:
                    skipped.append(result)
            await self._complete(
                attempt_id,
                {
                    "source_node": source_node,
                    "destination_node": self.config.node_name,
                    "source_file_id": source_file_id,
                    "files_total": len(files),
                    "files_copied": len(copied),
                    "files_skipped": len(skipped),
                    "bytes_copied": bytes_copied,
                    "copied": copied,
                    "skipped": skipped,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                },
            )
        except FileExistsError as exc:
            await self._fail(attempt_id, "DESTINATION_CONFLICT", str(exc), retryable=False)
        except KeyError as exc:
            await self._fail(attempt_id, "INVALID_TRANSFER_PAYLOAD", str(exc), retryable=False)
        except Exception as exc:
            await self._fail(attempt_id, "TRANSFER_ERROR", str(exc), retryable=True)

    async def _run_model_download(self, attempt_id: str, job: dict[str, Any]) -> None:
        job_id = str(job.get("id", ""))
        if await self._is_cancel_requested(job_id):
            await self._fail(attempt_id, "CANCELED", "Job canceled before download", retryable=False)
            return
        if self._download_manager is None:
            await self._fail(attempt_id, "EXECUTION_ERROR", "Agent worker download manager is not configured", retryable=False)
            return
        await self._progress(attempt_id, {"stage": "started", "job_type": "model.download"})
        try:
            payload = download_payload_from_model_download(job.get("payload", {}))
            repo_id = str(payload["repo_id"])
            download = self._download_manager.start(
                repo_id,
                triggered_by=f"job:{job_id or 'unknown'}",
                revision=payload.get("revision"),
                include_file=payload.get("include_file"),
                mmproj_file=payload.get("mmproj_file"),
            )
            download_id = str(download["id"])
            await self._progress(attempt_id, self._download_progress(download))
            while str(download.get("status")) in {"queued", "running"}:
                if await self._is_cancel_requested(job_id):
                    cancelled = self._download_manager.cancel(download_id)
                    await self._progress(attempt_id, self._download_progress(cancelled))
                    await self._fail(attempt_id, "CANCELED", "Job canceled during download", retryable=False)
                    return
                download = self._download_manager.status(download_id)
                await self._progress(attempt_id, self._download_progress(download))
                if str(download.get("status")) in {"queued", "running"}:
                    await asyncio.sleep(1)
            if str(download.get("status")) != "succeeded":
                await self._fail(
                    attempt_id,
                    "DOWNLOAD_FAILED",
                    str(download.get("error_detail") or f"Download ended with status {download.get('status')}"),
                    retryable=True,
                )
                return
            await self._complete(
                attempt_id,
                {
                    **self._download_result(download),
                    "worker_node": self.config.node_name,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                },
            )
        except ValueError as exc:
            await self._fail(attempt_id, "INVALID_JOB_PAYLOAD", str(exc), retryable=False)
        except Exception as exc:
            await self._fail(attempt_id, "DOWNLOAD_ERROR", str(exc), retryable=True)

    async def _run_model_install(self, attempt_id: str, job: dict[str, Any]) -> None:
        job_id = str(job.get("id", ""))
        if await self._is_cancel_requested(job_id):
            await self._fail(attempt_id, "CANCELED", "Job canceled before install", retryable=False)
            return
        if self._download_manager is None:
            await self._fail(attempt_id, "EXECUTION_ERROR", "Agent worker download manager is not configured", retryable=False)
            return
        await self._progress(attempt_id, {"stage": "started", "job_type": "model.install"})
        try:
            payload = install_payload_from_model_install(job.get("payload", {}))
            download = await self._download_to_terminal(attempt_id, job_id, payload, job_type="model.install")
            if download is None:
                return
            if str(download.get("status")) != "succeeded":
                await self._fail(
                    attempt_id,
                    "DOWNLOAD_FAILED",
                    str(download.get("error_detail") or f"Download ended with status {download.get('status')}"),
                    retryable=True,
                )
                return
            main_file = self._find_downloaded_file(download, str(payload.get("include_file") or ""))
            mmproj_path = self._find_downloaded_file(download, str(payload.get("mmproj_file") or ""), required=False)
            await self._progress(
                attempt_id,
                {
                    "stage": "verified",
                    "job_type": "model.install",
                    "download_id": download.get("id"),
                    "file_id": main_file["id"],
                    "path": main_file["path"],
                },
            )
            model = self._gguf_library.add_model(
                file_id=str(main_file["id"]),
                name=str(payload["model_name"]),
                port=int(payload["port"]),
                ctx=int(payload.get("ctx", 4096)),
                gpu_layers=int(payload.get("gpu_layers", 0)),
                host=str(payload.get("host", "127.0.0.1")),
                reasoning=payload.get("reasoning"),
                reasoning_budget=payload.get("reasoning_budget"),
                prompt_template=payload.get("prompt_template"),
                vision=bool(payload.get("vision", False)),
                mmproj=str(mmproj_path["path"]) if mmproj_path else None,
            )
            await self._progress(
                attempt_id,
                {
                    "stage": "registered",
                    "job_type": "model.install",
                    "model_name": model.get("name"),
                    "path": model.get("path"),
                },
            )
            start_status = None
            if payload.get("start", True):
                start_status = self._process_manager.start(str(payload["model_name"]))
                await self._progress(
                    attempt_id,
                    {
                        "stage": "started",
                        "job_type": "model.install",
                        "model_name": payload["model_name"],
                        "running": getattr(start_status, "running", None) if not isinstance(start_status, dict) else start_status.get("running"),
                    },
                )
            await self._complete(
                attempt_id,
                {
                    "download": self._download_result(download),
                    "file": main_file,
                    "model": model,
                    "start_status": self._status_payload(start_status),
                    "worker_node": self.config.node_name,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                },
            )
        except ValueError as exc:
            await self._fail(attempt_id, "INVALID_JOB_PAYLOAD", str(exc), retryable=False)
        except KeyError as exc:
            await self._fail(attempt_id, "INSTALL_NOT_FOUND", str(exc), retryable=False)
        except Exception as exc:
            await self._fail(attempt_id, "INSTALL_ERROR", str(exc), retryable=True)

    async def _run_llm_embed(self, attempt_id: str, job: dict[str, Any]) -> None:
        job_id = str(job.get("id", ""))
        if await self._is_cancel_requested(job_id):
            await self._fail(attempt_id, "CANCELED", "Job canceled before execution", retryable=False)
            return
        await self._progress(attempt_id, {"stage": "started", "job_type": "llm.embed"})
        started = monotonic()
        try:
            if self._embeddings is None:
                raise RuntimeError("Agent worker embeddings executor is not configured")
            model, inputs, target = embed_payload_from_llm_embed(job.get("payload", {}))
            response, route_meta = await self._embeddings(model, inputs, "local")
            elapsed_ms = int((monotonic() - started) * 1000)
            if await self._is_cancel_requested(job_id):
                await self._fail(attempt_id, "CANCELED", "Job canceled after embedding execution", retryable=False)
                return
            await self._complete(
                attempt_id,
                {
                    "response": response,
                    "route": route_meta,
                    "model": model,
                    "target": target,
                    "worker_node": self.config.node_name,
                    "elapsed_ms": elapsed_ms,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                },
            )
        except ValueError as exc:
            await self._fail(attempt_id, "INVALID_JOB_PAYLOAD", str(exc), retryable=False)
        except httpx.HTTPStatusError as exc:
            retryable = exc.response.status_code >= 500
            await self._fail(attempt_id, "UPSTREAM_HTTP_ERROR", str(exc), retryable=retryable)
        except httpx.HTTPError as exc:
            await self._fail(attempt_id, "UPSTREAM_TRANSPORT_ERROR", str(exc), retryable=True)
        except Exception as exc:
            await self._fail(attempt_id, "EXECUTION_ERROR", str(exc), retryable=True)

    async def _is_cancel_requested(self, job_id: str) -> bool:
        if not job_id:
            return False
        job = await self._request(
            "GET",
            self._url(f"/nodes/{self.config.node_name}/work/jobs/{job_id}/cancellation"),
            None,
            self._headers(),
        )
        return bool(isinstance(job, dict) and job.get("cancellation_requested"))

    async def _progress(self, attempt_id: str, progress: dict[str, Any]) -> None:
        await self._request("POST", self._url(f"/nodes/{self.config.node_name}/work/{attempt_id}/progress"), {"progress": progress}, self._headers())

    async def _run_llm_batch(self, attempt_id: str, job: dict[str, Any]) -> None:
        job_id = str(job.get("id", ""))
        if await self._is_cancel_requested(job_id):
            await self._fail(attempt_id, "CANCELED", "Job canceled before execution", retryable=False)
            return
        try:
            cases = batch_cases_from_llm_batch(job.get("payload", {}))
        except ValueError as exc:
            await self._fail(attempt_id, "INVALID_JOB_PAYLOAD", str(exc), retryable=False)
            return
        if self._chat is None:
            await self._fail(attempt_id, "EXECUTION_ERROR", "Agent worker chat executor is not configured", retryable=False)
            return
        await self._progress(attempt_id, {"stage": "started", "job_type": "llm.batch", "cases_total": len(cases)})
        started = monotonic()
        case_artifacts: list[dict[str, Any]] = []
        cases_completed = 0
        cases_failed = 0
        for i, case in enumerate(cases):
            if await self._is_cancel_requested(job_id):
                await self._fail(attempt_id, "CANCELED", f"Job canceled at case {i + 1}", retryable=False)
                return
            await self._progress(attempt_id, {
                "stage": "case_running",
                "case_index": i + 1,
                "cases_total": len(cases),
                "case_id": case.case_id,
            })
            case_started = monotonic()
            try:
                response, route_meta = await self._chat(case.model, {**case.chat_payload, "target": case.target})
                case_elapsed_ms = int((monotonic() - case_started) * 1000)
                cases_completed += 1
                case_artifacts.append({
                    "kind": "llm.batch.case",
                    "uri": f"batch://cases/{case.case_id}",
                    "meta": {
                        "case_id": case.case_id,
                        "model": case.model,
                        "target": case.target,
                        "response": response,
                        "route": route_meta,
                        "elapsed_ms": case_elapsed_ms,
                    },
                })
            except Exception as exc:
                case_elapsed_ms = int((monotonic() - case_started) * 1000)
                cases_failed += 1
                case_artifacts.append({
                    "kind": "llm.batch.case",
                    "uri": f"batch://cases/{case.case_id}",
                    "meta": {
                        "case_id": case.case_id,
                        "model": case.model,
                        "target": case.target,
                        "response": None,
                        "error": str(exc),
                        "elapsed_ms": case_elapsed_ms,
                    },
                })
        elapsed_ms = int((monotonic() - started) * 1000)
        summary_artifact = {
            "kind": "llm.batch.summary",
            "uri": "batch://summary",
            "meta": {
                "cases_total": len(cases),
                "cases_completed": cases_completed,
                "cases_failed": cases_failed,
                "elapsed_ms": elapsed_ms,
                "worker_node": self.config.node_name,
            },
        }
        await self._complete(
            attempt_id,
            {
                "cases_total": len(cases),
                "cases_completed": cases_completed,
                "cases_failed": cases_failed,
                "worker_node": self.config.node_name,
                "elapsed_ms": elapsed_ms,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            },
            artifacts=[*case_artifacts, summary_artifact],
        )

    async def _complete(self, attempt_id: str, result: dict[str, Any], artifacts: list[dict[str, Any]] | None = None) -> None:
        body: dict[str, Any] = {"result": result}
        if artifacts:
            body["artifacts"] = artifacts
        await self._request("POST", self._url(f"/nodes/{self.config.node_name}/work/{attempt_id}/complete"), body, self._headers())

    async def _fail(self, attempt_id: str, error_code: str, error_detail: str, retryable: bool) -> None:
        await self._request(
            "POST",
            self._url(f"/nodes/{self.config.node_name}/work/{attempt_id}/fail"),
            {"error_code": error_code, "error_detail": error_detail, "retryable": retryable},
            self._headers(),
        )

    def _url(self, path: str) -> str:
        base = self._api_base_url(str(self.config.controller_url))
        return f"{base}/{path.lstrip('/')}"

    def _download_progress(self, download: dict[str, Any]) -> dict[str, Any]:
        return {
            "stage": "downloading" if str(download.get("status")) in {"queued", "running"} else str(download.get("status")),
            "job_type": "model.download",
            "download_id": download.get("id"),
            "repo_id": download.get("repo_id"),
            "status": download.get("status"),
            "local_path": download.get("local_path"),
            "bytes_downloaded": download.get("bytes_downloaded"),
            "bytes_total": download.get("bytes_total"),
            "progress_percent": download.get("progress_percent"),
        }

    def _download_result(self, download: dict[str, Any]) -> dict[str, Any]:
        return {
            "download_id": download.get("id"),
            "repo_id": download.get("repo_id"),
            "revision": download.get("revision"),
            "status": download.get("status"),
            "local_path": download.get("local_path"),
            "bytes_downloaded": download.get("bytes_downloaded"),
            "bytes_total": download.get("bytes_total"),
            "progress_percent": download.get("progress_percent"),
            "log_path": download.get("log_path"),
        }

    async def _download_to_terminal(
        self,
        attempt_id: str,
        job_id: str,
        payload: dict[str, Any],
        *,
        job_type: str,
    ) -> dict[str, Any] | None:
        download = self._download_manager.start(
            str(payload["repo_id"]),
            triggered_by=f"job:{job_id or 'unknown'}",
            revision=payload.get("revision"),
            include_file=payload.get("include_file"),
            mmproj_file=payload.get("mmproj_file"),
        )
        download_id = str(download["id"])
        await self._progress(attempt_id, {**self._download_progress(download), "job_type": job_type})
        while str(download.get("status")) in {"queued", "running"}:
            if await self._is_cancel_requested(job_id):
                cancelled = self._download_manager.cancel(download_id)
                await self._progress(attempt_id, {**self._download_progress(cancelled), "job_type": job_type})
                await self._fail(attempt_id, "CANCELED", "Job canceled during download", retryable=False)
                return None
            download = self._download_manager.status(download_id)
            await self._progress(attempt_id, {**self._download_progress(download), "job_type": job_type})
            if str(download.get("status")) in {"queued", "running"}:
                await asyncio.sleep(1)
        return download

    def _find_downloaded_file(self, download: dict[str, Any], include_file: str, *, required: bool = True) -> dict[str, Any] | None:
        local_path = Path(str(download.get("local_path") or ""))
        expected = str(local_path / include_file) if include_file else ""
        matches = []
        for file in self._gguf_library.list_files():
            file_path = str(file.get("path") or "")
            filename = str(file.get("filename") or Path(file_path).name)
            if include_file:
                if file_path == expected or file_path.endswith(f"/{include_file}") or filename == Path(include_file).name:
                    matches.append(file)
            elif file_path.startswith(str(local_path)) and "mmproj" not in filename.lower():
                matches.append(file)
        if matches:
            return matches[0]
        if required:
            raise KeyError(f"Downloaded GGUF not found: {include_file or local_path}")
        return None

    def _status_payload(self, status: Any) -> dict[str, Any] | None:
        if status is None:
            return None
        if isinstance(status, dict):
            return status
        if hasattr(status, "to_dict"):
            return status.to_dict()
        if hasattr(status, "__dict__"):
            return dict(status.__dict__)
        return {"status": str(status)}

    @staticmethod
    def _api_base_url(url: str) -> str:
        base = url.rstrip("/")
        if not base.endswith("/lm-api/v1"):
            base = f"{base}/lm-api/v1"
        return base

    def _headers(self) -> dict[str, str]:
        if self.config.agent_api_key:
            return {"X-Llama-Manager-Key": self.config.agent_api_key}
        return {}

    @staticmethod
    async def _default_request(method: str, url: str, payload: dict[str, Any] | None, headers: dict[str, str] | None) -> Any:
        async with httpx.AsyncClient(timeout=None) as client:
            response = await client.request(method, url, json=payload, headers=headers or None)
            response.raise_for_status()
            return response.json() if response.content else {"ok": True}

    @staticmethod
    async def _default_transfer_stream(url: str, headers: dict[str, str]) -> Any:
        async with httpx.AsyncClient(timeout=None) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            content_type = response.headers.get("content-type", "")
            if "application/json" in content_type:
                return response.json()
            return io.BytesIO(response.content)
