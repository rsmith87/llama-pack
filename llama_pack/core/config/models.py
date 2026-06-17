from __future__ import annotations

from pathlib import Path
import re
from typing import Any, Literal

from pydantic import BaseModel, Field, PrivateAttr, field_validator, model_validator


Mode = Literal["agent", "controller"]
ReasoningMode = Literal["on", "off", "auto"]
SpeculativeMode = Literal["mtp"]
AgentToolType = Literal["shell", "file_read", "file_read_dynamic", "file_write", "http", "directory_list", "file_search", "text_search", "git_status", "git_diff", "git_log", "process_status", "http_json", "log_tail", "web_fetch", "sqlite_query", "memory_write", "memory_search"]
PLUGIN_ID_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")


class ModelProfileConfig(BaseModel):
    ctx: int | None = None
    port: int | None = None
    gpu_layers: int | None = None
    host: str | None = None
    extra_args: list[str] | None = None
    label: str | None = None
    order: int = 100
    kind: str | None = None
    intended_ctx: int | None = None
    kv_cache_policy: str | None = None
    resource_tier: str | None = None
    strengths: list[str] = Field(default_factory=list)
    cost_tier: Literal["low", "medium", "high"] | None = None

    def label_or_default(self, key: str) -> str:
        return self.label or key[:1].upper() + key[1:]


class SpeculativeConfig(BaseModel):
    mode: SpeculativeMode
    draft_model_path: str | None = None
    draft_max: int | None = Field(default=None, ge=0)
    draft_min: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_draft_range(self) -> "SpeculativeConfig":
        if self.draft_min is not None and self.draft_max is not None and self.draft_min > self.draft_max:
            raise ValueError("draft_min must be less than or equal to draft_max")
        return self


class ModelConfig(BaseModel):
    path: str
    port: int
    ctx: int = 4096
    gpu_layers: int = Field(default=0)
    host: str = "127.0.0.1"
    reasoning: ReasoningMode | None = None
    reasoning_budget: int | None = None
    vision: bool = False
    mmproj: str | None = None
    extra_args: list[str] = Field(default_factory=list)
    supports_json_schema: bool | None = None
    supports_grammar: bool | None = None
    supports_mtp: bool | None = None
    speculative: SpeculativeConfig | None = None
    model_line: str | None = None
    favorite: bool = False
    prompt_template: str | None = None
    strengths: list[str] = Field(default_factory=list)
    cost_tier: Literal["low", "medium", "high"] | None = None
    profiles: dict[str, ModelProfileConfig] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_speculative_settings(self) -> "ModelConfig":
        if self.speculative is None:
            return self
        if self.speculative.mode == "mtp" and self.supports_mtp is not True:
            raise ValueError("supports_mtp must be true before speculative.mode 'mtp' can be configured")
        return self


class NodeRequestTypeConfig(BaseModel):
    model: str
    priority: int = 100


class NodeConfig(BaseModel):
    url: str
    api_key: str | None = None
    verify_tls: bool = True
    default_model: str | None = None
    request_types: dict[str, NodeRequestTypeConfig] = Field(default_factory=dict)
    max_running_models: int | None = None


class PluginConfig(BaseModel):
    enabled: bool = True
    path: Path | None = None
    config: dict[str, Any] = Field(default_factory=dict)


class AgentToolDefinitionConfig(BaseModel):
    type: AgentToolType
    description: str
    command: list[str] | None = None
    path: Path | None = None
    method: str | None = None
    url: str | None = None
    timeout_seconds: float | None = None
    glob: str | None = None
    recursive: bool = False
    max_depth: int = Field(default=0, ge=0, le=32)
    max_entries: int = Field(default=200, ge=1, le=5000)
    include_hidden: bool = False
    case_sensitive: bool = False
    regex: bool = False
    max_matches: int = Field(default=50, ge=1, le=2000)
    max_file_bytes: int = Field(default=524288, ge=1)
    max_response_bytes: int = Field(default=65536, ge=1)
    max_lines: int = Field(default=100, ge=1, le=1000)
    max_commits: int = Field(default=20, ge=1, le=200)
    allowed_domains: list[str] = Field(default_factory=list)
    strip_html: bool = True
    paths: list[Path] = Field(default_factory=list)
    write_mode: Literal["write", "append", "create_only"] = "append"
    max_write_bytes: int = Field(default=32768, ge=1, le=1048576)
    parameters: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_adapter_fields(self) -> "AgentToolDefinitionConfig":
        if self.type == "shell" and not self.command:
            raise ValueError("shell tools require command")
        if self.type == "file_read" and self.path is None:
            raise ValueError("file_read tools require path")
        if self.type == "file_read_dynamic" and self.path is None:
            raise ValueError("file_read_dynamic tools require path")
        if self.type == "file_write" and self.path is None:
            raise ValueError("file_write tools require path")
        if self.type == "directory_list" and self.path is None:
            raise ValueError("directory_list tools require path")
        if self.type == "file_search":
            if self.path is None:
                raise ValueError("file_search tools require path")
            if not self.glob:
                raise ValueError("file_search tools require glob")
        if self.type == "text_search":
            if self.path is None:
                raise ValueError("text_search tools require path")
            if not self.glob:
                raise ValueError("text_search tools require glob")
        if self.type == "git_status" and self.path is None:
            raise ValueError("git_status tools require path")
        if self.type == "git_diff" and self.path is None:
            raise ValueError("git_diff tools require path")
        if self.type == "git_log" and self.path is None:
            raise ValueError("git_log tools require path")
        if self.type == "sqlite_query" and self.path is None and not self.paths:
            raise ValueError("sqlite_query tools require path or paths")
        if self.type == "log_tail" and self.path is None:
            raise ValueError("log_tail tools require path")
        if self.type == "http":
            if not self.url:
                raise ValueError("http tools require url")
            if self.method and self.method.upper() not in {"GET", "POST"}:
                raise ValueError("http tools support only GET and POST")
        if self.type == "http_json":
            if not self.url:
                raise ValueError("http_json tools require url")
            if self.method and self.method.upper() not in {"GET", "POST"}:
                raise ValueError("http_json tools support only GET and POST")
        return self


class MemoryConfig(BaseModel):
    enabled: bool = False
    path: Path = Path("./logs/agent_memory")
    embedding_model_path: Path | None = None
    auto_inject: bool = True
    top_k: int = Field(default=3, ge=1, le=20)
    soft_cap: int = Field(default=500, ge=10, le=100000)
    ephemeral_ttl_days: int = Field(default=7, ge=1)
    durable_ttl_days: int = Field(default=90, ge=1)


class AgentToolsConfig(BaseModel):
    enabled: bool = False
    max_iterations: int = Field(default=4, ge=1, le=16)
    tool_timeout_seconds: float = Field(default=10.0, gt=0)
    safe_roots: list[Path] = Field(default_factory=list)
    tools: dict[str, AgentToolDefinitionConfig] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_tools(self) -> "AgentToolsConfig":
        name_pattern = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,63}$")
        for name, tool in self.tools.items():
            if not name_pattern.match(name):
                raise ValueError("agent tool names must match ^[A-Za-z_][A-Za-z0-9_]{0,63}$")
            if tool.type in {"file_read", "file_read_dynamic", "file_write", "directory_list", "file_search", "text_search", "git_status", "git_diff", "git_log", "log_tail", "sqlite_query"}:
                if not self.safe_roots:
                    raise ValueError(f"{tool.type} tools require agent_tools.safe_roots")
                roots = [root.resolve() for root in self.safe_roots]
                all_paths = list(tool.paths) if tool.paths else ([tool.path] if tool.path else [])
                for p in all_paths:
                    resolved = p.resolve()
                    if not any(_is_relative_to(resolved, root) for root in roots):
                        raise ValueError(f"{tool.type} tool paths must be under agent_tools.safe_roots")
        return self


class AppConfig(BaseModel):
    mode: Mode = "agent"
    llama_server_bin: str = "llama-server"
    llama_cpp_dir: Path = Path("./llama.cpp")
    python_bin: str = "python3"
    hf_models_dir: Path | None = None
    hf_models_dirs: list[Path] = Field(default_factory=list)
    log_dir: Path = Path("./logs")
    models: dict[str, ModelConfig] = Field(default_factory=dict)
    nodes: dict[str, NodeConfig] = Field(default_factory=dict)
    agent_api_key: str | None = None
    test_chat_api_key: str | None = None
    controller_registration_key: str | None = None
    node_heartbeat_timeout_seconds: int = 90
    controller_url: str | None = None
    node_name: str | None = None
    agent_url: str = "http://127.0.0.1:9000"
    heartbeat_interval_seconds: int = 30
    controller_retention_days: int = 30
    controller_archive_retention_days: int = 90
    controller_archive_dir: Path = Path("./logs/archive")
    controller_registration_key_outbound: str | None = None
    auth_db_url: str | None = None
    audit_db_url: str | None = None
    chat_sessions_db_url: str | None = None
    controller_db_url: str | None = None
    downloads_db_url: str | None = None
    benchmarks_db_url: str | None = None
    models_db_url: str | None = None
    settings_db_url: str | None = None
    controller_instance_id: str = "controller-default"
    controller_leader_lease_seconds: int = 30
    agent_worker_enabled: bool = False
    agent_worker_poll_interval_seconds: int = 2
    agent_worker_max_jobs: int = 1
    agent_worker_labels: dict[str, Any] = Field(default_factory=dict)
    agent_worker_capacity: dict[str, Any] = Field(default_factory=dict)
    routing_fanout_enabled: bool = False
    routing_fanout_max: int = 2
    routing_plugin_path: str | None = None
    client_cors_origins: list[str] = Field(default_factory=list)
    enabled_plugins: list[str] = Field(default_factory=list)
    plugins: dict[str, PluginConfig] = Field(default_factory=dict)
    chat_max_active_per_target: int = Field(default=1, ge=1, le=128)
    chat_max_queue_per_target: int = Field(default=32, ge=0, le=10000)
    chat_max_active_per_session: int = Field(default=1, ge=1, le=32)
    chat_max_queue_per_session: int = Field(default=4, ge=0, le=1000)
    chat_admission_timeout_seconds: float = Field(default=120.0, gt=0, le=3600)
    agent_tools: AgentToolsConfig = Field(default_factory=AgentToolsConfig)
    memory: MemoryConfig = Field(default_factory=MemoryConfig)
    config_source: str = "(defaults)"

    _section_sources: dict[str, Path] = PrivateAttr(default_factory=dict)
    _file_links: dict[str, Path] = PrivateAttr(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def normalize_model_roots(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        raw_single = data.get("hf_models_dir")
        if isinstance(raw_single, list) and "hf_models_dirs" not in data:
            data = {**data, "hf_models_dirs": raw_single, "hf_models_dir": None}
        return data

    @field_validator("enabled_plugins")
    @classmethod
    def validate_enabled_plugin_ids(cls, value: list[str]) -> list[str]:
        for plugin_id in value:
            if not PLUGIN_ID_PATTERN.fullmatch(plugin_id):
                raise ValueError(f"Invalid plugin id {plugin_id!r}")
        return value

    @field_validator("plugins")
    @classmethod
    def validate_plugin_config_ids(cls, value: dict[str, PluginConfig]) -> dict[str, PluginConfig]:
        for plugin_id in value:
            if not PLUGIN_ID_PATTERN.fullmatch(plugin_id):
                raise ValueError(f"Invalid plugin id {plugin_id!r}")
        return value

    @property
    def model_roots(self) -> list[Path]:
        roots = list(self.hf_models_dirs)
        if not roots and self.hf_models_dir is not None:
            roots.append(self.hf_models_dir)
        deduped = []
        seen = set()
        for root in roots:
            key = str(root)
            if key not in seen:
                deduped.append(root)
                seen.add(key)
        return deduped

    def effective_model_config(self, identity: str) -> ModelConfig:
        if ":" not in identity:
            try:
                return self.models[identity]
            except KeyError as exc:
                raise KeyError(f"Unknown model family {identity!r}") from exc

        family, profile_key = identity.split(":", 1)
        try:
            base = self.models[family]
        except KeyError as exc:
            raise KeyError(f"Unknown model family {family!r} for profile identity {identity!r}") from exc

        try:
            profile = base.profiles[profile_key]
        except KeyError as exc:
            raise KeyError(f"Unknown profile {profile_key!r} for model family {family!r}") from exc

        data = base.model_dump()
        data["profiles"] = {}
        for field in ("ctx", "gpu_layers", "host", "extra_args", "cost_tier"):
            value = getattr(profile, field)
            if value is not None:
                data[field] = value
        if profile.strengths:
            data["strengths"] = list(profile.strengths)
        data["port"] = profile.port if profile.port is not None else base.port + profile.order
        return ModelConfig(**data)


def _is_relative_to(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False
