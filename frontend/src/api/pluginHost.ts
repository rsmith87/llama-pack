import { apiDelete, apiGet, apiPost, apiPut } from "./client";

export type PluginHostApi = {
  pluginId: string;
  apiGet<T = unknown>(path: string): Promise<T>;
  apiPost<T = unknown>(path: string, body?: unknown): Promise<T>;
  apiPut<T = unknown>(path: string, body?: unknown): Promise<T>;
  apiDelete<T = unknown>(path: string): Promise<T>;
  navigate(path: string): void;
  refreshPluginStatus(): void;
};

function pluginPath(pluginId: string, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `/plugins/${encodeURIComponent(pluginId)}${clean}`;
}

export function createPluginHostApi({
  pluginId,
  navigate,
  refreshPluginStatus,
}: {
  pluginId: string;
  navigate: (path: string) => void;
  refreshPluginStatus: () => void;
}): PluginHostApi {
  return {
    pluginId,
    apiGet: (path) => apiGet(pluginPath(pluginId, path)),
    apiPost: (path, body) => apiPost(pluginPath(pluginId, path), body),
    apiPut: (path, body) => apiPut(pluginPath(pluginId, path), body),
    apiDelete: (path) => apiDelete(pluginPath(pluginId, path)),
    navigate,
    refreshPluginStatus,
  };
}
