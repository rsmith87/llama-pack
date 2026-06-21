from __future__ import annotations

from llama_pack.core.chat import ModelNotRunningError
from llama_pack.core.threads.service import ThreadChatError


ChatErrorDetail = dict[str, str]


def model_not_running_detail(exc: ModelNotRunningError) -> ChatErrorDetail:
    message = str(exc)
    return {
        "code": "MODEL_NOT_RUNNING",
        "message": message,
        "action": "Start the requested model before sending chat requests.",
        "model": _trailing_message_value(message),
    }


def thread_chat_error_detail(exc: ThreadChatError) -> ChatErrorDetail:
    message = str(exc)
    if exc.error_code == "ROUTING_ERROR" and message.startswith("No eligible running model found"):
        return no_eligible_route_detail(message)
    return {
        "code": exc.error_code,
        "message": message,
        "action": "Review the thread request route, target, model, and node configuration.",
    }


def thread_chat_http_detail(exc: ThreadChatError) -> str | ChatErrorDetail:
    message = str(exc)
    if exc.error_code == "ROUTING_ERROR" and is_no_eligible_route_message(message):
        return no_eligible_route_detail(message)
    return message


def no_eligible_route_detail(message: str) -> ChatErrorDetail:
    return {
        "code": "NO_ELIGIBLE_ROUTE",
        "message": message,
        "action": "Start an eligible model on a configured node or change the request model, target, or request_type.",
    }


def is_no_eligible_route_message(message: str) -> bool:
    return message.startswith("No eligible running model found")


def _trailing_message_value(message: str) -> str:
    if ": " not in message:
        return ""
    return message.rsplit(": ", 1)[1]
