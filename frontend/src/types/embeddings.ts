export type EmbeddingsRequest = Record<string, unknown>;
export type EmbeddingsResponse = Record<string, unknown>;

export type EmbeddingRow = Record<string, unknown> & { embedding?: number[] };
export type EmbeddingsResult = {
  data?: EmbeddingRow[];
  model?: string;
  usage?: Record<string, unknown>;
};
export type DisplayEmbeddingRow = { row: EmbeddingRow; input: string; index: number };
export type SimilarityRow = { rank: number; index: number; id: string; score: number };
