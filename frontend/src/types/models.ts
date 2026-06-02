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
  gpu_layers?: number;
  host?: string;
  reasoning?: string | null;
  reasoning_budget?: number | null;
  prompt_template?: string | null;
  file_id?: string;
  size_bytes?: number;
  favorite?: boolean;
  vision?: boolean;
  mmproj?: string | null;
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
