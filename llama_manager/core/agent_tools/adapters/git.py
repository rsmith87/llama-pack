from __future__ import annotations

import asyncio

from llama_manager.core.agent_tools.common import MAX_RESULT_CHARS, is_relative_to, truncate
from llama_manager.core.config.models import AgentToolDefinitionConfig, AppConfig


class GitStatusToolAdapter:
    def __init__(self, config: AppConfig) -> None:
        self.config = config

    async def execute(self, tool: AgentToolDefinitionConfig, arguments: dict[str, object]) -> dict[str, object]:
        if tool.path is None:
            return {"ok": False, "error": "git_status tool has no path"}
        repo = tool.path.resolve()
        roots = [safe_root.resolve() for safe_root in self.config.agent_tools.safe_roots]
        if not roots or not any(is_relative_to(repo, safe_root) for safe_root in roots):
            return {"ok": False, "error": f"repo path is outside configured safe roots: {repo}"}
        if not repo.exists():
            return {"ok": False, "error": f"repo path does not exist: {repo}"}

        timeout = tool.timeout_seconds or self.config.agent_tools.tool_timeout_seconds

        branch_code, branch_out, branch_err = await _run_git(["rev-parse", "--abbrev-ref", "HEAD"], repo, timeout)
        if branch_code != 0:
            return {"ok": False, "error": truncate(branch_err.strip() or f"git exited with code {branch_code}", MAX_RESULT_CHARS)}

        status_code, status_out, status_err = await _run_git(["status", "--porcelain"], repo, timeout)
        if status_code != 0:
            return {"ok": False, "error": truncate(status_err.strip() or f"git status exited with code {status_code}", MAX_RESULT_CHARS)}

        changed = []
        for line in status_out.splitlines():
            if len(line) >= 3:
                status = line[:2]
                path_part = line[3:]
                if " -> " in path_part:
                    path_part = path_part.split(" -> ", 1)[1]
                changed.append({"status": status, "path": path_part})
                if len(changed) >= tool.max_entries:
                    break

        return {
            "ok": True,
            "branch": branch_out.strip(),
            "changed": changed,
            "clean": len(changed) == 0,
        }


class GitDiffToolAdapter:
    def __init__(self, config: AppConfig) -> None:
        self.config = config

    async def execute(self, tool: AgentToolDefinitionConfig, arguments: dict[str, object]) -> dict[str, object]:
        if tool.path is None:
            return {"ok": False, "error": "git_diff tool has no path"}
        repo = tool.path.resolve()
        roots = [safe_root.resolve() for safe_root in self.config.agent_tools.safe_roots]
        if not roots or not any(is_relative_to(repo, safe_root) for safe_root in roots):
            return {"ok": False, "error": f"repo path is outside configured safe roots: {repo}"}
        if not repo.exists():
            return {"ok": False, "error": f"repo path does not exist: {repo}"}

        timeout = tool.timeout_seconds or self.config.agent_tools.tool_timeout_seconds
        code, out, err = await _run_git(["diff", "HEAD"], repo, timeout)
        if code != 0:
            return {"ok": False, "error": truncate(err.strip() or f"git diff exited with code {code}", MAX_RESULT_CHARS)}

        lines = out.splitlines(keepends=True)
        truncated = len(lines) > tool.max_lines
        return {
            "ok": True,
            "diff": "".join(lines[: tool.max_lines]),
            "total_lines": len(lines),
            "truncated": truncated,
        }


class GitLogToolAdapter:
    def __init__(self, config: AppConfig) -> None:
        self.config = config

    async def execute(self, tool: AgentToolDefinitionConfig, arguments: dict[str, object]) -> dict[str, object]:
        if tool.path is None:
            return {"ok": False, "error": "git_log tool has no path"}
        repo = tool.path.resolve()
        roots = [safe_root.resolve() for safe_root in self.config.agent_tools.safe_roots]
        if not roots or not any(is_relative_to(repo, safe_root) for safe_root in roots):
            return {"ok": False, "error": f"repo path is outside configured safe roots: {repo}"}
        if not repo.exists():
            return {"ok": False, "error": f"repo path does not exist: {repo}"}

        timeout = tool.timeout_seconds or self.config.agent_tools.tool_timeout_seconds
        fmt = "%h|%s|%an|%ar"
        code, out, err = await _run_git(
            ["log", f"--format={fmt}", f"-{tool.max_commits}"],
            repo,
            timeout,
        )
        if code != 0:
            return {"ok": False, "error": truncate(err.strip() or f"git log exited with code {code}", MAX_RESULT_CHARS)}

        commits = []
        for line in out.splitlines():
            parts = line.split("|", 3)
            if len(parts) == 4:
                commits.append({"hash": parts[0], "subject": parts[1], "author": parts[2], "age": parts[3]})
        return {"ok": True, "commits": commits, "count": len(commits)}


async def _run_git(args: list[str], repo, timeout: float) -> tuple[int, str, str]:
    try:
        process = await asyncio.create_subprocess_exec(
            "git", "-C", str(repo), *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout)
    except FileNotFoundError:
        return -1, "", "git executable not found"
    except TimeoutError:
        process.kill()
        await process.communicate()
        return -1, "", "git command timed out"
    return process.returncode, stdout.decode("utf-8", errors="replace"), stderr.decode("utf-8", errors="replace")
