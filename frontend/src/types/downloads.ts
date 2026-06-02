export type DownloadRecord = Record<string, unknown>;
export type DownloadsResponse = { downloads?: DownloadRecord[] };
export type QuantDiscoveryResponse = Record<string, unknown>;

export type DownloadRecommendation = {
  repo_id: string;
  title: string;
  include_file: string;
  mmproj_file?: string | null;
  vision?: boolean;
  quant: string;
  fit_label: string;
  use_case: string;
  fit_reason: string;
  score: number;
};

export type DownloadRecommendationsResponse = {
  machine?: {
    ram_gb?: number;
    vram_gb?: number;
    platform?: string;
  };
  recommendations?: DownloadRecommendation[];
  excluded?: DownloadRecommendation[];
};

/** A quantization record as returned by the quant-discovery endpoint. */
export type QuantRecord = Record<string, unknown>;

/** Identifies a GGUF file available on a remote node. */
export type RemoteGgufSource = {
  node: string;
  modelName: string;
  fileId: string;
};

/** Inventory status of a recommended download — local, on a remote node, or missing. */
export type RecommendedInventory = {
  status: "local" | "remote" | "missing";
  label: string;
  detail: string;
  remoteSource: RemoteGgufSource | null;
};

/** Normalised form of a DownloadRecommendation for the HfDownloadsPage UI. */
export type RecommendedDownload = {
  repoId: string;
  title: string;
  includeFile: string;
  mmprojFile: string | null;
  vision: boolean;
  quant: string;
  fitLabel: string;
  useCase: string;
  fitReason: string;
  score: number;
};

/** State for the remote-to-node transfer modal in HfDownloadsPage. */
export type HfTransferState = {
  item: RecommendedDownload;
  source: RemoteGgufSource;
  destinationNode: string;
  status: string;
  submitting: boolean;
};
