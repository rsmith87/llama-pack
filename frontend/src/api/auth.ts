import { apiGet, apiPost } from "./client";
import type { AuthKey, CurrentUserResponse, LoginRequest, LoginResponse } from "../types/api";

export function login(payload: LoginRequest) { return apiPost<LoginResponse>("/auth/login", payload); }
export function logout() { return apiPost<{ ok: boolean }>("/auth/logout"); }
export function currentUser() { return apiGet<CurrentUserResponse>("/auth/me"); }
export function listKeys() { return apiGet<{ keys?: AuthKey[] }>("/auth/keys"); }
export function createKey(payload: { username: string; role: string }) { return apiPost<Record<string, unknown>>("/auth/keys", payload); }
export function revokeKey(keyId: string) { return apiPost<Record<string, unknown>>(`/auth/keys/${encodeURIComponent(keyId)}/revoke`); }
