import { apiPost } from "./client";
import type { EmbeddingsResponse, MemoryEmbeddingsRequest, MemorySearchRequest, MemorySearchResponse, MemoryWriteRequest, MemoryWriteResponse } from "../types/index";

export function writeMemory(payload: MemoryWriteRequest) {
  return apiPost<MemoryWriteResponse>("/memory/write", payload);
}

export function searchMemory(payload: MemorySearchRequest) {
  return apiPost<MemorySearchResponse>("/memory/search", payload);
}

export function createMemoryEmbeddings(payload: MemoryEmbeddingsRequest) {
  return apiPost<EmbeddingsResponse>("/memory/embeddings", payload);
}
