from pathlib import Path

import pytest

from llama_pack.core.config import load_config
from llama_pack.providers.llama_cpp import build_llama_server_command


def test_load_config_reads_models_nodes_and_env_override(tmp_path, monkeypatch):
    config_file = tmp_path / "config.yaml"
    config_file.write_text(
        """
mode: agent
llama_server_bin: /opt/llama.cpp/llama-server
log_dir: ./agent-logs
models:
  qwen-coder:
    path: /models/qwen.gguf
    port: 8081
    ctx: 16384
    gpu_layers: 999
    host: 0.0.0.0
nodes:
  mac-mini:
    url: http://127.0.0.1:9000
""",
        encoding="utf-8",
    )
    monkeypatch.setenv("LLAMA_PACK_MODE", "controller")

    config = load_config(config_file)

    assert config.mode == "controller"
    assert config.llama_server_bin == "/opt/llama.cpp/llama-server"
    assert config.log_dir == Path("./agent-logs")
    assert config.models["qwen-coder"].port == 8081
    assert config.nodes["mac-mini"].url == "http://127.0.0.1:9000"
    assert config.node_heartbeat_timeout_seconds == 90


def test_example_network_configs_use_env_placeholders_for_lan_urls():
    root = Path(__file__).resolve().parents[1]
    config_files = [
        root / "config.example.yaml",
        root / "linux-agent.config.example.yaml",
        root / "raspberry-pi-controller.config.example.yaml",
    ]

    for config_file in config_files:
        text = config_file.read_text(encoding="utf-8")
        assert "192.168." not in text, config_file.name
        assert "MAC_MINI_IP" not in text, config_file.name
        assert "LINUX_2080TI_IP" not in text, config_file.name
        assert "LLAMA" + "_MANAGER_" not in text, config_file.name


def test_load_config_expands_env_var_placeholders_in_nested_values(tmp_path, monkeypatch):
    config_file = tmp_path / "config.yaml"
    config_file.write_text(
        """
mode: controller
agent_api_key: ${AGENT_API_KEY}
controller_registration_key: prefix-${JOIN_KEY}
hf_models_dirs:
  - ${MODEL_ROOT}
nodes:
  linux:
    url: ${LINUX_AGENT_URL}
    api_key: ${LINUX_AGENT_KEY}
models:
  gemma:
    path: ${MODEL_ROOT}/gemma.gguf
    port: 8080
""",
        encoding="utf-8",
    )
    monkeypatch.setenv("AGENT_API_KEY", "agent-secret")
    monkeypatch.setenv("JOIN_KEY", "join-secret")
    monkeypatch.setenv("MODEL_ROOT", "/models")
    monkeypatch.setenv("LINUX_AGENT_URL", "http://linux:9137")
    monkeypatch.setenv("LINUX_AGENT_KEY", "node-secret")

    config = load_config(config_file)

    assert config.agent_api_key == "agent-secret"
    assert config.controller_registration_key == "prefix-join-secret"
    assert config.hf_models_dirs == [Path("/models")]
    assert config.nodes["linux"].url == "http://linux:9137"
    assert config.nodes["linux"].api_key == "node-secret"
    assert config.models["gemma"].path == "/models/gemma.gguf"


def test_node_config_accepts_thread_routing_defaults():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "mac-mini": {
                    "url": "http://mac:9137",
                    "api_key": "mac-secret",
                    "default_model": "gemma",
                    "request_types": {
                        "general": {"model": "gemma", "priority": 10},
                        "coding": {"model": "qwen", "priority": 50},
                        "vision": {"model": "llava"},
                    },
                }
            },
        }
    )

    node = config.nodes["mac-mini"]
    assert node.default_model == "gemma"
    assert node.request_types["general"].model == "gemma"
    assert node.request_types["general"].priority == 10
    assert node.request_types["coding"].priority == 50
    assert node.request_types["vision"].priority == 100


def test_model_config_accepts_nested_runtime_profiles():
    config = load_config(
        {
            "mode": "agent",
            "models": {
                "gemma-4-E2B-it": {
                    "path": "/models/gemma/model.gguf",
                    "port": 8081,
                    "ctx": 8192,
                    "gpu_layers": 10,
                    "host": "0.0.0.0",
                    "prompt_template": "gemma",
                    "profiles": {
                        "fast": {
                            "ctx": 8192,
                            "gpu_layers": 999,
                            "order": 10,
                            "kind": "interactive",
                            "kv_cache_policy": "gpu-preferred",
                            "resource_tier": "low",
                        },
                        "long": {
                            "ctx": 131072,
                            "gpu_layers": 20,
                            "order": 30,
                            "kind": "long-context",
                            "kv_cache_policy": "cpu-ok",
                            "resource_tier": "high",
                            "extra_args": ["--cache-type-k", "q4_0"],
                        },
                    },
                }
            },
        }
    )

    model = config.models["gemma-4-E2B-it"]
    assert model.profiles["fast"].label_or_default("fast") == "Fast"
    assert model.profiles["fast"].intended_ctx is None
    assert model.profiles["long"].ctx == 131072
    assert model.profiles["long"].extra_args == ["--cache-type-k", "q4_0"]


def test_model_effective_profile_config_inherits_base_and_overrides_profile():
    config = load_config(
        {
            "mode": "agent",
            "models": {
                "gemma": {
                    "path": "/models/gemma.gguf",
                    "port": 8081,
                    "ctx": 8192,
                    "gpu_layers": 10,
                    "host": "0.0.0.0",
                    "prompt_template": "gemma",
                    "extra_args": ["--threads", "8"],
                    "strengths": ["general"],
                    "cost_tier": "medium",
                    "profiles": {
                        "long": {
                            "ctx": 131072,
                            "gpu_layers": 20,
                            "port": 8083,
                            "extra_args": ["--cache-type-k", "q4_0"],
                            "strengths": ["long_context"],
                            "cost_tier": "high",
                        }
                    },
                }
            },
        }
    )

    effective = config.effective_model_config("gemma:long")
    assert effective.path == "/models/gemma.gguf"
    assert effective.port == 8083
    assert effective.ctx == 131072
    assert effective.gpu_layers == 20
    assert effective.host == "0.0.0.0"
    assert effective.prompt_template == "gemma"
    assert effective.extra_args == ["--cache-type-k", "q4_0"]
    assert effective.strengths == ["long_context"]
    assert effective.cost_tier == "high"
    assert effective.profiles == {}


def test_model_effective_profile_config_derives_port_and_preserves_base_values():
    config = load_config(
        {
            "mode": "agent",
            "models": {
                "gemma": {
                    "path": "/models/gemma.gguf",
                    "port": 8081,
                    "ctx": 8192,
                    "gpu_layers": 10,
                    "extra_args": ["--threads", "8"],
                    "profiles": {
                        "fast": {
                            "ctx": 4096,
                            "order": 10,
                        }
                    },
                }
            },
        }
    )

    effective = config.effective_model_config("gemma:fast")
    assert effective.port == 8091
    assert effective.ctx == 4096
    assert effective.gpu_layers == 10
    assert effective.host == "127.0.0.1"
    assert effective.extra_args == ["--threads", "8"]


def test_agent_tools_defaults_are_disabled():
    config = load_config({"mode": "agent"})

    assert config.agent_tools.enabled is False
    assert config.agent_tools.max_iterations == 4
    assert config.agent_tools.tool_timeout_seconds == 10.0
    assert config.agent_tools.tools == {}


def test_client_cors_origins_default_to_empty_and_load_from_config():
    default_config = load_config({"mode": "controller"})
    configured = load_config(
        {
            "mode": "controller",
            "client_cors_origins": ["http://localhost:5173", "app://llama-pack-chat"],
        }
    )

    assert default_config.client_cors_origins == []
    assert configured.client_cors_origins == ["http://localhost:5173", "app://llama-pack-chat"]


def test_agent_tools_accept_shell_file_http_and_directory_list_definitions(tmp_path):
    config = load_config(
        {
            "mode": "agent",
            "agent_tools": {
                "enabled": True,
                "safe_roots": [str(tmp_path)],
                "tools": {
                    "list_status": {
                        "type": "shell",
                        "description": "List runtime status.",
                        "command": ["echo", "ok"],
                    },
                    "read_status": {
                        "type": "file_read",
                        "description": "Read a status file.",
                        "path": str(tmp_path / "status.txt"),
                    },
                    "health": {
                        "type": "http",
                        "description": "Fetch health.",
                        "method": "GET",
                        "url": "http://127.0.0.1:9137/health",
                    },
                    "list_logs": {
                        "type": "directory_list",
                        "description": "List logs.",
                        "path": str(tmp_path),
                        "recursive": True,
                        "max_depth": 2,
                        "max_entries": 25,
                        "include_hidden": False,
                    },
                },
            },
        }
    )

    assert set(config.agent_tools.tools) == {"list_status", "read_status", "health", "list_logs"}
    assert config.agent_tools.tools["list_status"].type == "shell"
    assert config.agent_tools.tools["read_status"].type == "file_read"
    assert config.agent_tools.tools["health"].type == "http"
    assert config.agent_tools.tools["list_logs"].type == "directory_list"
    assert config.agent_tools.tools["list_logs"].max_depth == 2


def test_agent_tools_reject_invalid_tool_name():
    with pytest.raises(ValueError, match="tool names"):
        load_config(
            {
                "mode": "agent",
                "agent_tools": {
                    "enabled": True,
                    "tools": {
                        "bad name": {
                            "type": "shell",
                            "description": "Bad.",
                            "command": ["echo", "bad"],
                        }
                    },
                },
            }
        )


def test_agent_tools_reject_file_read_path_outside_safe_roots(tmp_path):
    with pytest.raises(ValueError, match="safe_roots"):
        load_config(
            {
                "mode": "agent",
                "agent_tools": {
                    "enabled": True,
                    "safe_roots": [str(tmp_path / "allowed")],
                    "tools": {
                        "read_secret": {
                            "type": "file_read",
                            "description": "Read secret.",
                            "path": str(tmp_path / "secret.txt"),
                        }
                    },
                },
            }
        )


def test_agent_tools_reject_directory_list_path_outside_safe_roots(tmp_path):
    with pytest.raises(ValueError, match="safe_roots"):
        load_config(
            {
                "mode": "agent",
                "agent_tools": {
                    "enabled": True,
                    "safe_roots": [str(tmp_path / "allowed")],
                    "tools": {
                        "list_secret": {
                            "type": "directory_list",
                            "description": "List secret.",
                            "path": str(tmp_path / "secret"),
                        }
                    },
                },
            }
        )


def test_raspberry_pi_example_includes_thread_routing_defaults(monkeypatch):
    monkeypatch.setenv("LLAMA_PACK_CONTROLLER_REGISTRATION_KEY", "controller-key")
    monkeypatch.setenv("LLAMA_PACK_MAC_MINI_AGENT_URL", "http://mac:9137")
    monkeypatch.setenv("LLAMA_PACK_MAC_MINI_AGENT_API_KEY", "mac-key")
    monkeypatch.setenv("LLAMA_PACK_LINUX_2080TI_AGENT_URL", "http://linux:9137")
    monkeypatch.setenv("LLAMA_PACK_LINUX_2080TI_AGENT_API_KEY", "linux-key")

    config = load_config("raspberry-pi-controller.config.example.yaml")

    assert config.nodes["mac-mini"].default_model
    assert "general" in config.nodes["mac-mini"].request_types
    assert "coding" in config.nodes["linux-2080ti"].request_types


def test_build_llama_server_command_uses_configured_model_options():
    config = load_config(
        {
            "mode": "agent",
            "llama_server_bin": "llama-server",
            "models": {
                "gemma": {
                    "path": r"C:\models\gemma.gguf",
                    "port": 8080,
                    "ctx": 8192,
                    "gpu_layers": 999,
                    "host": "0.0.0.0",
                }
            },
        }
    )

    command = build_llama_server_command(config.llama_server_bin, config.models["gemma"])

    assert command == [
        "llama-server",
        "--model",
        r"C:\models\gemma.gguf",
        "--host",
        "0.0.0.0",
        "--port",
        "8080",
        "--ctx-size",
        "8192",
        "--n-gpu-layers",
        "999",
    ]


def test_default_config_does_not_embed_machine_specific_paths(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("LLAMA_PACK_CONFIG", raising=False)
    config = load_config()

    assert config.llama_cpp_dir == Path("./llama.cpp")
    assert not str(config.llama_cpp_dir).startswith("/Users/")


def test_load_config_prefers_local_config_yaml_when_env_unset(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("LLAMA_PACK_CONFIG", raising=False)
    (tmp_path / "config.yaml").write_text(
        """
mode: agent
llama_server_bin: C:/local/llama-server.exe
""",
        encoding="utf-8",
    )
    (tmp_path / "config.example.yaml").write_text(
        """
mode: agent
llama_server_bin: /Users/stale/llama-server
""",
        encoding="utf-8",
    )

    config = load_config()

    assert config.llama_server_bin == "C:/local/llama-server.exe"
    assert config.config_source == str((tmp_path / "config.yaml").resolve())


def test_load_config_falls_back_to_local_example_when_config_yaml_missing(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("LLAMA_PACK_CONFIG", raising=False)
    (tmp_path / "config.example.yaml").write_text(
        """
mode: agent
llama_server_bin: C:/fallback/llama-server.exe
""",
        encoding="utf-8",
    )

    config = load_config()

    assert config.llama_server_bin == "C:/fallback/llama-server.exe"
    assert config.config_source == str((tmp_path / "config.example.yaml").resolve())


def test_build_llama_server_command_uses_reasoning_options():
    config = load_config(
        {
            "mode": "agent",
            "llama_server_bin": "llama-server",
            "models": {
                "gemma": {
                    "path": "/models/gemma.gguf",
                    "port": 8080,
                    "reasoning": "auto",
                    "reasoning_budget": 2048,
                }
            },
        }
    )

    command = build_llama_server_command(config.llama_server_bin, config.models["gemma"])

    assert "--reasoning" in command
    assert command[command.index("--reasoning") + 1] == "auto"
    assert "--reasoning-budget" in command
    assert command[command.index("--reasoning-budget") + 1] == "2048"


def test_build_llama_server_command_includes_mmproj_sidecar_when_configured():
    config = load_config(
        {
            "mode": "agent",
            "llama_server_bin": "llama-server",
            "models": {
                "gemma-vision": {
                    "path": "/models/gemma.gguf",
                    "port": 8080,
                    "vision": True,
                    "mmproj": "/models/mmproj-gemma.gguf",
                }
            },
        }
    )

    command = build_llama_server_command(config.llama_server_bin, config.models["gemma-vision"])
    assert "--mmproj" in command
    assert command[command.index("--mmproj") + 1] == "/models/mmproj-gemma.gguf"


def test_model_config_allows_speculative_mtp_when_model_is_marked_capable():
    config = load_config(
        {
            "mode": "agent",
            "models": {
                "deepseek": {
                    "path": "/models/deepseek.gguf",
                    "port": 8080,
                    "supports_mtp": True,
                    "speculative": {
                        "mode": "mtp",
                        "draft_max": 4,
                        "draft_min": 1,
                    },
                }
            },
        }
    )

    assert config.models["deepseek"].supports_mtp is True
    assert config.models["deepseek"].speculative is not None
    assert config.models["deepseek"].speculative.mode == "mtp"
    assert config.models["deepseek"].speculative.draft_max == 4
    assert config.models["deepseek"].speculative.draft_min == 1


def test_model_config_rejects_speculative_mtp_when_mtp_capability_is_unknown():
    with pytest.raises(ValueError, match="supports_mtp"):
        load_config(
            {
                "mode": "agent",
                "models": {
                    "deepseek": {
                        "path": "/models/deepseek.gguf",
                        "port": 8080,
                        "speculative": {"mode": "mtp"},
                    }
                },
            }
        )


def test_model_config_rejects_speculative_mtp_for_non_mtp_model():
    with pytest.raises(ValueError, match="supports_mtp"):
        load_config(
            {
                "mode": "agent",
                "models": {
                    "gemma": {
                        "path": "/models/gemma.gguf",
                        "port": 8080,
                        "supports_mtp": False,
                        "speculative": {"mode": "mtp"},
                    }
                },
            }
        )


def test_model_config_rejects_speculative_draft_range_when_min_exceeds_max():
    with pytest.raises(ValueError, match="draft_min"):
        load_config(
            {
                "mode": "agent",
                "models": {
                    "deepseek": {
                        "path": "/models/deepseek.gguf",
                        "port": 8080,
                        "supports_mtp": True,
                        "speculative": {
                            "mode": "mtp",
                            "draft_min": 4,
                            "draft_max": 2,
                        },
                    }
                },
            }
        )


def test_build_llama_server_command_enables_speculative_mtp_when_requested():
    config = load_config(
        {
            "mode": "agent",
            "llama_server_bin": "llama-server",
            "models": {
                "deepseek": {
                    "path": "/models/deepseek.gguf",
                    "port": 8080,
                    "supports_mtp": True,
                    "speculative": {
                        "mode": "mtp",
                        "draft_model_path": "/models/mtp-deepseek.gguf",
                        "draft_max": 4,
                        "draft_min": 1,
                    },
                }
            },
        }
    )

    command = build_llama_server_command(config.llama_server_bin, config.models["deepseek"])

    assert "--spec-type" in command
    assert command[command.index("--spec-type") + 1] == "draft-mtp"
    assert "--model-draft" in command
    assert command[command.index("--model-draft") + 1] == "/models/mtp-deepseek.gguf"
    assert "--spec-draft-n-max" in command
    assert command[command.index("--spec-draft-n-max") + 1] == "4"
    assert "--spec-draft-n-min" in command
    assert command[command.index("--spec-draft-n-min") + 1] == "1"


def test_build_llama_server_command_omits_speculative_flags_when_unset():
    config = load_config(
        {
            "mode": "agent",
            "llama_server_bin": "llama-server",
            "models": {
                "gemma": {
                    "path": "/models/gemma.gguf",
                    "port": 8080,
                    "supports_mtp": False,
                }
            },
        }
    )

    command = build_llama_server_command(config.llama_server_bin, config.models["gemma"])

    assert "--spec-type" not in command
    assert "--spec-draft-n-max" not in command
    assert "--spec-draft-n-min" not in command


def test_configuration_docs_mention_speculative_fields_and_advanced_note():
    root = Path(__file__).resolve().parents[1]
    text = (root / "docs" / "configuration.md").read_text(encoding="utf-8")

    assert "supports_mtp" in text
    assert "speculative" in text
    assert "draft_model_path" in text
    assert "draft_max" in text
    assert "draft_min" in text
    assert "advanced speculative" in text.lower()
    assert "hf_repo" in text.lower()


def test_load_config_accepts_legacy_hf_models_dir_list():
    config = load_config(
        {
            "hf_models_dir": [
                "/Volumes/4TB/HFModels",
                "/Users/robertsmith/.cache/huggingface/hub",
            ]
        }
    )

    assert [str(path) for path in config.model_roots] == [
        "/Volumes/4TB/HFModels",
        "/Users/robertsmith/.cache/huggingface/hub",
    ]


def test_load_config_controller_retention_days_default():
    config = load_config({"mode": "controller"})
    assert config.controller_retention_days == 30


def test_load_config_controller_phase3_defaults():
    config = load_config({"mode": "controller"})
    assert config.controller_db_url is None
    assert config.controller_instance_id == "controller-default"
    assert config.controller_leader_lease_seconds == 30


# ---------------------------------------------------------------------------
# Split config tests
# ---------------------------------------------------------------------------


def _write_yaml(path: "Path", data: dict) -> None:
    import yaml
    path.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")


def test_split_config_loads_linked_models_file(tmp_path):
    models_file = tmp_path / "config" / "models.yaml"
    models_file.parent.mkdir()
    _write_yaml(
        models_file,
        {
            "qwen-coder": {
                "path": "/models/qwen.gguf",
                "port": 8081,
                "ctx": 16384,
                "gpu_layers": 999,
                "host": "0.0.0.0",
            }
        },
    )
    manifest = tmp_path / "config.yaml"
    _write_yaml(manifest, {"mode": "agent", "files": {"models": "config/models.yaml"}})

    config = load_config(manifest)

    assert "qwen-coder" in config.models
    assert config.models["qwen-coder"].port == 8081
    assert config._file_links["models"] == models_file.resolve()


def test_split_config_root_inline_overrides_linked_grouped_value(tmp_path):
    runtime_file = tmp_path / "config" / "runtime.yaml"
    runtime_file.parent.mkdir()
    _write_yaml(runtime_file, {"log_dir": "logs-from-file", "heartbeat_interval_seconds": 99})
    manifest = tmp_path / "config.yaml"
    _write_yaml(
        manifest,
        {"mode": "agent", "log_dir": "logs-override", "files": {"runtime": "config/runtime.yaml"}},
    )

    config = load_config(manifest)

    assert str(config.log_dir) == "logs-override"
    assert config.heartbeat_interval_seconds == 99


def test_split_config_unknown_files_key_fails(tmp_path):
    manifest = tmp_path / "config.yaml"
    _write_yaml(manifest, {"mode": "agent", "files": {"bogus_section": "config/bogus.yaml"}})

    with pytest.raises(ValueError, match="Unknown file key 'bogus_section'"):
        load_config(manifest)


def test_split_config_missing_linked_file_fails(tmp_path):
    manifest = tmp_path / "config.yaml"
    _write_yaml(manifest, {"mode": "agent", "files": {"models": "config/models.yaml"}})

    with pytest.raises(FileNotFoundError, match="Linked config file not found"):
        load_config(manifest)


def test_split_config_grouped_file_wrong_group_field_fails(tmp_path):
    persistence_file = tmp_path / "config" / "persistence.yaml"
    persistence_file.parent.mkdir()
    _write_yaml(persistence_file, {"controller_db_url": None, "models": {}})
    manifest = tmp_path / "config.yaml"
    _write_yaml(manifest, {"mode": "agent", "files": {"persistence": "config/persistence.yaml"}})

    with pytest.raises(ValueError, match="does not belong to the 'persistence' group"):
        load_config(manifest)


def test_split_config_env_var_expansion_in_linked_files(tmp_path, monkeypatch):
    monkeypatch.setenv("TEST_DB_URL", "sqlite:///test.db")
    persistence_file = tmp_path / "config" / "persistence.yaml"
    persistence_file.parent.mkdir()
    _write_yaml(persistence_file, {"controller_db_url": "${TEST_DB_URL}"})
    manifest = tmp_path / "config.yaml"
    _write_yaml(
        manifest, {"mode": "agent", "files": {"persistence": "config/persistence.yaml"}}
    )

    config = load_config(manifest)

    assert config.controller_db_url == "sqlite:///test.db"


def test_save_split_config_writes_models_to_linked_file(tmp_path):
    models_file = tmp_path / "config" / "models.yaml"
    models_file.parent.mkdir()
    _write_yaml(
        models_file,
        {"gemma": {"path": "/models/gemma.gguf", "port": 8080, "gpu_layers": 0}},
    )
    manifest = tmp_path / "config.yaml"
    _write_yaml(manifest, {"mode": "agent", "files": {"models": "config/models.yaml"}})

    config = load_config(manifest)
    config.models["new-model"] = config.models["gemma"].model_copy(
        update={"path": "/models/new.gguf", "port": 8099}
    )

    from llama_pack.core.config import save_config
    save_config(config)

    import yaml
    saved_models = yaml.safe_load(models_file.read_text(encoding="utf-8"))
    assert "new-model" in saved_models
    assert saved_models["new-model"]["port"] == 8099
    # Root manifest should not contain models
    saved_root = yaml.safe_load(manifest.read_text(encoding="utf-8"))
    assert "models" not in saved_root
    assert "files" in saved_root


def test_save_split_config_writes_agent_tools_to_linked_file(tmp_path):
    tools_file = tmp_path / "config" / "agent_tools.yaml"
    tools_file.parent.mkdir()
    _write_yaml(
        tools_file,
        {
            "enabled": True,
            "max_iterations": 4,
            "tool_timeout_seconds": 10.0,
            "safe_roots": [str(tmp_path)],
            "tools": {
                "repo_status": {
                    "type": "git_status",
                    "description": "Show git status.",
                    "path": str(tmp_path),
                }
            },
        },
    )
    manifest = tmp_path / "config.yaml"
    _write_yaml(manifest, {"mode": "agent", "files": {"agent_tools": "config/agent_tools.yaml"}})

    config = load_config(manifest)
    config.agent_tools.max_iterations = 8

    from llama_pack.core.config import save_config
    save_config(config)

    import yaml
    saved_tools = yaml.safe_load(tools_file.read_text(encoding="utf-8"))
    assert saved_tools["max_iterations"] == 8
    saved_root = yaml.safe_load(manifest.read_text(encoding="utf-8"))
    assert "agent_tools" not in saved_root
    assert "files" in saved_root


def test_save_split_config_root_manifest_stays_small(tmp_path):
    runtime_file = tmp_path / "config" / "runtime.yaml"
    runtime_file.parent.mkdir()
    _write_yaml(runtime_file, {"log_dir": "logs", "heartbeat_interval_seconds": 30})
    auth_file = tmp_path / "config" / "auth.yaml"
    _write_yaml(auth_file, {"agent_api_key": "secret-key"})
    manifest = tmp_path / "config.yaml"
    _write_yaml(
        manifest,
        {
            "mode": "agent",
            "files": {
                "runtime": "config/runtime.yaml",
                "auth": "config/auth.yaml",
            },
        },
    )

    config = load_config(manifest)
    from llama_pack.core.config import save_config
    save_config(config)

    import yaml
    saved_root = yaml.safe_load(manifest.read_text(encoding="utf-8"))
    # Linked fields must not leak into the root manifest
    assert "log_dir" not in saved_root
    assert "agent_api_key" not in saved_root
    # files mapping must be preserved
    assert saved_root["files"]["runtime"] == "config/runtime.yaml"
    assert saved_root["files"]["auth"] == "config/auth.yaml"
    # mode stays root-owned
    assert saved_root["mode"] == "agent"


def test_save_split_example_auth_file_keeps_secret_placeholders(tmp_path, monkeypatch):
    auth_file = tmp_path / "config" / "auth.example.yaml"
    auth_file.parent.mkdir()
    _write_yaml(
        auth_file,
        {
            "agent_api_key": "${LLAMA_PACK_AGENT_API_KEY}",
            "test_chat_api_key": "${LLAMA_PACK_TEST_CHAT_API_KEY}",
            "controller_registration_key": "${LLAMA_PACK_CONTROLLER_REGISTRATION_KEY}",
            "controller_registration_key_outbound": "${LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND}",
        },
    )
    manifest = tmp_path / "config.yaml"
    _write_yaml(manifest, {"mode": "agent", "files": {"auth": "config/auth.example.yaml"}})
    monkeypatch.setenv("LLAMA_PACK_AGENT_API_KEY", "real-agent-key")
    monkeypatch.setenv("LLAMA_PACK_TEST_CHAT_API_KEY", "real-test-chat-key")
    monkeypatch.setenv("LLAMA_PACK_CONTROLLER_REGISTRATION_KEY", "real-registration-key")
    monkeypatch.setenv(
        "LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND",
        "real-registration-outbound-key",
    )

    config = load_config(manifest)
    assert config.agent_api_key == "real-agent-key"

    from llama_pack.core.config import save_config
    save_config(config)

    import yaml
    saved_auth = yaml.safe_load(auth_file.read_text(encoding="utf-8"))
    assert saved_auth["agent_api_key"] == "${LLAMA_PACK_AGENT_API_KEY}"
    assert saved_auth["test_chat_api_key"] == "${LLAMA_PACK_TEST_CHAT_API_KEY}"
    assert saved_auth["controller_registration_key"] == "${LLAMA_PACK_CONTROLLER_REGISTRATION_KEY}"
    assert (
        saved_auth["controller_registration_key_outbound"]
        == "${LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND}"
    )


def test_save_single_file_example_config_keeps_secret_placeholders(tmp_path, monkeypatch):
    config_file = tmp_path / "config.example.yaml"
    _write_yaml(
        config_file,
        {
            "mode": "agent",
            "agent_api_key": "${LLAMA_PACK_AGENT_API_KEY}",
            "test_chat_api_key": "${LLAMA_PACK_TEST_CHAT_API_KEY}",
        },
    )
    monkeypatch.setenv("LLAMA_PACK_AGENT_API_KEY", "real-agent-key")
    monkeypatch.setenv("LLAMA_PACK_TEST_CHAT_API_KEY", "real-test-chat-key")

    config = load_config(config_file)
    assert config.agent_api_key == "real-agent-key"

    from llama_pack.core.config import save_config
    save_config(config)

    import yaml
    saved = yaml.safe_load(config_file.read_text(encoding="utf-8"))
    assert saved["agent_api_key"] == "${LLAMA_PACK_AGENT_API_KEY}"
    assert saved["test_chat_api_key"] == "${LLAMA_PACK_TEST_CHAT_API_KEY}"
