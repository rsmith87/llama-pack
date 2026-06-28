from __future__ import annotations

from fastapi import FastAPI

from llama_pack.core.app.state import (
    AppStateRequestBindings,
    ModelManagerBindings,
    configure_app_state,
    configure_chat_state,
    configure_controller_agent_state,
    configure_foundation_state,
    configure_model_asset_state,
    configure_runtime_domain_state,
    configure_session_and_persistence_state,
)


def test_app_state_module_exposes_subsystem_builders() -> None:
    assert configure_app_state is not None
    assert configure_foundation_state is not None
    assert configure_session_and_persistence_state is not None
    assert configure_chat_state is not None
    assert configure_model_asset_state is not None
    assert configure_runtime_domain_state is not None
    assert configure_controller_agent_state is not None


def test_app_state_binding_types_are_explicit() -> None:
    request_bindings = AppStateRequestBindings(
        controller_request=None,
        chat_request=None,
        chat_stream_request=None,
        heartbeat_request=None,
    )
    manager_bindings = ModelManagerBindings(
        process_manager=None,
        conversion_manager=None,
        quantization_manager=None,
        gguf_library=None,
    )

    assert request_bindings.controller_request is None
    assert manager_bindings.process_manager is None
    assert isinstance(FastAPI(), FastAPI)
