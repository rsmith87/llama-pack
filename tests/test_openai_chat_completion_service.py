from __future__ import annotations

from llama_pack.api.routes.openai_chat_completion import (
    OpenAIChatCompletionService,
    OpenAIChatCompletionsRequest,
    apply_document_collection_context,
)


def test_openai_chat_completion_service_owns_request_boundary() -> None:
    body = OpenAIChatCompletionsRequest(
        model="qwen",
        messages=[{"role": "user", "content": "hello"}],
        stream=False,
    )

    assert body.model == "qwen"
    assert body.messages[0].role == "user"
    assert OpenAIChatCompletionService is not None
    assert apply_document_collection_context({"messages": []}, None, None) == ({"messages": []}, [])
