import { NodeRecord } from "../types/nodes";

export type GgufModelCatalog = {
  model_id?: string;
  model_name?: string;
  asset_id?: string | null;
  config_source?: string;
  model_line?: string | null;
  ctx?: number | null;
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

export type GgufModelProfile = {
  profile_id?: string;
  model_id?: string;
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

export type GgufModelDeployment = {
  deployment_id?: string;
  model_id?: string;
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

export type GgufFile = Record<string, unknown> & {
  asset_id?: string;
  id?: string;
  name?: string;
  filename?: string;
  model_dir?: string;
  path?: string;
  file_id?: string;
  size_bytes?: number;
  registered?: boolean;
  registered_as?: string | null;
  running?: boolean;
  pid?: number | null;
  vision?: boolean;
  mmproj?: string | null;
  model_supports_mtp?: boolean | null;
  model_draft_model_path?: string | null;
  model_ctx?: number | null;
  model_gpu_layers?: number | null;
  model_port?: number | null;
  model_prompt_template?: string | null;
  model_reasoning?: string | null;
  model_reasoning_budget?: number | null;
  model_line?: string | null;
  model_catalog?: GgufModelCatalog | null;
  model_profiles?: GgufModelProfile[];
  model_deployments?: GgufModelDeployment[];
};

export type GgufLibraryResponse = { files?: GgufFile[]; ggufs?: GgufFile[] };

export type ConversionRecord = Record<string, unknown>;
export type ConversionsResponse = {
  models?: ConversionRecord[];
  conversions?: ConversionRecord[];
};

export type QuantizationFile = Record<string, unknown>;
export type QuantizationFilesResponse = { files?: QuantizationFile[] };

export type GgufLibraryData = {
  files: GgufFile[];
  nodeSnapshots: NodeRecord[];
  nodeGgufSnapshots: NodeRecord[];
};
