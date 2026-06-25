export type MemoryWriteRequest = {
  text: string;
  tier: "permanent" | "durable" | "ephemeral";
  topic: string | null;
  tags: string[];
};

export type MemoryWriteResponse = {
  ok: boolean;
  id?: string | null;
  detail?: string | null;
};

export type MemorySearchRequest = {
  query: string;
  top_k: number;
};

export type MemorySearchResult = {
  id?: string;
  text?: string;
  tier?: string;
  topic?: string | null;
  tags?: string[];
  score?: number;
};

export type MemorySearchResponse = {
  ok: boolean;
  count: number;
  results: MemorySearchResult[];
};

export type MemoryEmbeddingsRequest = {
  input: string[];
};
