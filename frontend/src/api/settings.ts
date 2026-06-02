import { apiPost } from "./client";

export function generateApiKeys(payload: { prefix: string; token_bytes: number; count: number }) {
  return apiPost<{ keys?: string[]; count?: number; prefix?: string; token_bytes?: number }>("/settings/api-keys/generate", payload);
}
