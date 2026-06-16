export type LocalModelProfile = {
  profile_key?: string;
  label?: string | null;
  order?: number;
  kind?: string | null;
  ctx?: number | null;
  gpu_layers?: number | null;
  host?: string | null;
  extra_args?: string[];
  intended_ctx?: number | null;
  kv_cache_policy?: string | null;
  resource_tier?: string | null;
  strengths?: string[];
  cost_tier?: string | null;
};

export type LocalModelDeployment = {
  deployment_id?: string;
  deployment_name?: string;
  node_name?: string | null;
  host?: string;
  port?: number;
  ctx_override?: number | null;
  gpu_layers_override?: number | null;
  mmproj_override?: string | null;
  extra_args_override?: string[];
  profile_key?: string | null;
  enabled?: boolean;
};

export type LocalModelCatalog = {
  model_id?: string;
  model_name?: string;
  asset_id?: string | null;
  config_source?: string;
  model_line?: string | null;
  ctx?: number | null;
  capacity_ctx?: number | null;
  gpu_layers?: number | null;
  vision?: boolean;
  mmproj?: string | null;
  supports_json_schema?: boolean | null;
  supports_grammar?: boolean | null;
  supports_mtp?: boolean | null;
  reasoning?: string | null;
  reasoning_budget?: number | null;
  prompt_template?: string | null;
  favorite?: boolean;
  strengths?: string[];
  cost_tier?: string | null;
  extra_args?: string[];
};

export type LocalModel = {
  name?: string;
  id?: string;
  status?: string;
  path?: string;
  model_path?: string;
  model?: string;
  model_dir?: string;
  node?: string;
  node_name?: string;
  port?: number;
  pid?: number | null;
  ctx?: number;
  capacity_ctx?: number | null;
  gpu_layers?: number;
  host?: string;
  reasoning?: string | null;
  reasoning_budget?: number | null;
  prompt_template?: string | null;
  file_id?: string;
  size_bytes?: number;
  favorite?: boolean;
  strengths?: string[];
  cost_tier?: string | null;
  vision?: boolean;
  mmproj?: string | null;
  model_catalog?: LocalModelCatalog | null;
  model_profiles?: LocalModelProfile[];
  model_deployments?: LocalModelDeployment[];
  supports?: {
    vision?: boolean;
  };
};

export type ModelsResponse = {
  models?: LocalModel[];
};

export type ModelProfile = {
  profile: string;
  label: string;
  identity: string;
  node?: string | null;
  route?: string;
  running?: boolean;
  ctx?: number;
  port?: number;
  resource_tier?: string;
};

export type ModelProfileFamily = {
  family: string;
  profiles: ModelProfile[];
};

export type ModelProfileCatalog = {
  families: ModelProfileFamily[];
};
