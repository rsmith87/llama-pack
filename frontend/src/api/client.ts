export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export const API_PREFIX = "/lm-api/v1";

export type AuthTokenProvider = () => string;

let authTokenProvider: AuthTokenProvider = () => "";

export function setAuthTokenProvider(provider: AuthTokenProvider): void {
  authTokenProvider = provider;
}

function buildHeaders(options: ApiRequestOptions, stream = false): Record<string, string> {
  const token = authTokenProvider();
  const headers: Record<string, string> = {
    Accept: stream ? "text/event-stream" : "application/json",
  };
  if (token) headers["X-UI-Session"] = token;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  return { ...headers, ...(options.headers || {}) };
}

async function assertOk(response: Response): Promise<void> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const response = await fetch(API_PREFIX + path, {
    method: options.method || "GET",
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    headers: buildHeaders(options),
    signal: options.signal,
  });
  await assertOk(response);
  return response.json() as Promise<T>;
}

export async function apiAbsoluteRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const response = await fetch(path, {
    method: options.method || "GET",
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    headers: buildHeaders(options),
    signal: options.signal,
  });
  await assertOk(response);
  return response.json() as Promise<T>;
}

export function apiGet<T>(path: string, options: Omit<ApiRequestOptions, "method" | "body"> = {}): Promise<T> {
  return apiRequest<T>(path, { ...options, method: "GET" });
}

export function apiPost<T>(path: string, body?: unknown, options: Omit<ApiRequestOptions, "method" | "body"> = {}): Promise<T> {
  return apiRequest<T>(path, { ...options, method: "POST", body });
}

export function apiAbsolutePost<T>(path: string, body?: unknown, options: Omit<ApiRequestOptions, "method" | "body"> = {}): Promise<T> {
  return apiAbsoluteRequest<T>(path, { ...options, method: "POST", body });
}

export function apiPut<T>(path: string, body?: unknown, options: Omit<ApiRequestOptions, "method" | "body"> = {}): Promise<T> {
  return apiRequest<T>(path, { ...options, method: "PUT", body });
}

export function apiPatch<T>(path: string, body?: unknown, options: Omit<ApiRequestOptions, "method" | "body"> = {}): Promise<T> {
  return apiRequest<T>(path, { ...options, method: "PATCH", body });
}

export function apiDelete<T>(path: string, options: Omit<ApiRequestOptions, "method" | "body"> = {}): Promise<T> {
  return apiRequest<T>(path, { ...options, method: "DELETE" });
}

export async function apiStream(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  const response = await fetch(API_PREFIX + path, {
    method: options.method || "GET",
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    headers: buildHeaders(options, true),
    signal: options.signal,
  });
  await assertOk(response);
  if (!response.body) throw new Error("Response did not include a readable stream");
  return response.body.getReader();
}

export { loadDashboardData } from "./health";
