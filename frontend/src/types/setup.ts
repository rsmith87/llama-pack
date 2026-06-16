export type ActiveSetupMode = "controller" | "agent" | "standalone";

export type ActiveControllerSetupInputs = {
  log_dir: string;
  controller_registration_key: string;
  node_heartbeat_timeout_seconds: number;
  controller_instance_id: string;
};

export type ActiveAgentSetupInputs = {
  controller_url: string;
  node_name: string;
  agent_url: string;
  agent_api_key: string;
  controller_registration_key_outbound: string;
  llama_server_bin: string;
  llama_cpp_dir: string;
  python_bin: string;
  hf_models_dir: string;
  log_dir: string;
};

export type ActiveSetupRequest = {
  mode: ActiveSetupMode;
  config_path: string;
  env_path: string;
  overwrite_existing: boolean;
  inputs: {
    controller?: ActiveControllerSetupInputs;
    agent?: ActiveAgentSetupInputs;
  };
};

export type ActiveSetupResult = {
  ok: boolean;
  status: "ready" | "blocked_existing_files" | "applied" | "failed";
  existing_files: string[];
  planned_files: string[];
  backup_files: string[];
  message: string;
};
