import { NodeRecord } from "../types/nodes";

export type GgufFile = Record<string, unknown> & {
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
  model_ctx?: number | null;
  model_gpu_layers?: number | null;
  model_port?: number | null;
  model_prompt_template?: string | null;
  model_reasoning?: string | null;
  model_reasoning_budget?: number | null;
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