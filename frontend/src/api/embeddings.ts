import { apiPost } from "./client";
import type { EmbeddingsRequest, EmbeddingsResponse } from "../types/index";

export function createEmbeddings(modelName: string, payload: EmbeddingsRequest) { return apiPost<EmbeddingsResponse>(`/chat/${encodeURIComponent(modelName)}/embeddings`, payload); }
