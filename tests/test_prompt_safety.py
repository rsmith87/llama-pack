import pytest
from tests.helpers import authenticated_client as TestClient

from llama_pack.core.chat.prompt_safety import PromptSafetyScanner, PromptSafetyViolationError
from llama_pack.core.config import load_config
from llama_pack.core.nodes.registry import NodeRegistry
from llama_pack.core.chat.proxy import ChatProxy
from llama_pack.main import create_app


class PromptSafetyProcessManager:
    def list_statuses(self) -> list[dict[str, object]]:
        return [
            {
                "name": "qwen",
                "running": True,
                "pid": 123,
                "process_state": "adopted",
                "port": 8081,
                "model_path": "/models/qwen.gguf",
                "log_path": "/tmp/qwen.log",
            }
        ]

    def status(self, name: str) -> dict[str, object]:
        return self.list_statuses()[0]


def test_prompt_safety_scanner_detects_luhn_valid_credit_card() -> None:
    scanner = PromptSafetyScanner()

    with pytest.raises(PromptSafetyViolationError) as raised:
        scanner.require_safe_messages(
            [
                {
                    "role": "user",
                    "content": "Please process card 4111 1111 1111 1111 today.",
                }
            ]
        )

    violation = raised.value.violations[0]
    assert violation.kind == "credit_card"
    assert violation.path == "messages[0].content"


def test_prompt_safety_scanner_ignores_non_luhn_number() -> None:
    scanner = PromptSafetyScanner()

    scanner.require_safe_messages(
        [
            {
                "role": "user",
                "content": "The test sequence is 4111 1111 1111 1112.",
            }
        ]
    )


def test_prompt_safety_scanner_detects_social_security_number() -> None:
    scanner = PromptSafetyScanner()

    with pytest.raises(PromptSafetyViolationError) as raised:
        scanner.require_safe_messages(
            [
                {
                    "role": "user",
                    "content": "My SSN is 123-45-6789.",
                }
            ]
        )

    violation = raised.value.violations[0]
    assert violation.kind == "ssn"
    assert violation.path == "messages[0].content"


def test_prompt_safety_scanner_detects_api_key_assignment() -> None:
    scanner = PromptSafetyScanner()

    with pytest.raises(PromptSafetyViolationError) as raised:
        scanner.require_safe_messages(
            [
                {
                    "role": "user",
                    "content": "Use api_key = abcdefghijklmnopqrstuvwxyz123456",
                }
            ]
        )

    violation = raised.value.violations[0]
    assert violation.kind == "api_key"
    assert violation.path == "messages[0].content"


def test_chat_api_blocks_sensitive_prompt_before_model_request() -> None:
    calls: list[dict[str, object]] = []

    async def chat_request(url: str, payload: dict[str, object]) -> dict[str, object]:
        calls.append(payload)
        return {"choices": [{"message": {"role": "assistant", "content": "ok"}}]}

    config = load_config(
        {
            "mode": "agent",
            "models": {
                "qwen": {
                    "path": "/models/qwen.gguf",
                    "port": 8081,
                }
            },
        }
    )
    app = create_app(
        config=config,
        process_manager=PromptSafetyProcessManager(),
        chat_request=chat_request,
    )
    client = TestClient(app)

    response = client.post(
        "/lm-api/v1/chat/qwen",
        json={
            "messages": [
                {
                    "role": "user",
                    "content": "Here is my token: sk-abcdefghijklmnopqrstuvwxyz1234567890",
                }
            ]
        },
    )

    assert response.status_code == 422
    assert response.json() == {
        "detail": {
            "error_type": "prompt_safety_violation",
            "message": "Prompt contains sensitive data and was not sent to the model.",
            "violations": [{"kind": "api_key", "path": "messages[0].content"}],
        }
    }
    assert calls == []


@pytest.mark.asyncio
async def test_chat_proxy_blocks_sensitive_older_history_before_summarization() -> None:
    calls: list[dict[str, object]] = []

    async def chat_request(url: str, payload: dict[str, object]) -> dict[str, object]:
        calls.append(payload)
        return {"choices": [{"message": {"role": "assistant", "content": "ok"}}]}

    config = load_config(
        {
            "mode": "agent",
            "models": {
                "qwen": {
                    "path": "/models/qwen.gguf",
                    "port": 8081,
                    "ctx": 1000,
                }
            },
            "context_summarization_trigger_ratio": 0.1,
        }
    )
    proxy = ChatProxy(
        process_manager=PromptSafetyProcessManager(),
        config=config,
        node_registry=NodeRegistry(config=config),
        request=chat_request,
    )

    with pytest.raises(PromptSafetyViolationError) as raised:
        await proxy.chat(
            "qwen",
            {
                "messages": [
                    {
                        "role": "user",
                        "content": "Old card 4111 1111 1111 1111 " + ("alpha " * 100),
                    },
                    {"role": "assistant", "content": "bravo " * 100},
                    {"role": "user", "content": "charlie " * 100},
                    {"role": "assistant", "content": "delta " * 100},
                    {"role": "user", "content": "echo " * 100},
                    {"role": "assistant", "content": "foxtrot " * 100},
                ],
                "max_tokens": 16,
            },
        )

    assert raised.value.violations[0].kind == "credit_card"
    assert calls == []
