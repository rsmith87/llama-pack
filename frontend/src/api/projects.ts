import { apiGet, apiPatch, apiPost, apiPut } from "./client";

export type ProjectRecord = {
  id: string;
  name: string;
  root_hint?: string | null;
  archived?: boolean;
};

export type ProjectNodeRootSafeStatus = "unknown" | "allowed" | "blocked";

export type ProjectNodeRootRecord = {
  id: string;
  project_id: string;
  node_name: string;
  root_path: string;
  safe_root_status: ProjectNodeRootSafeStatus;
  created_at: string;
  updated_at: string;
};

export type CreateProjectRequest = {
  name: string;
  root_hint: string | null;
};

export type UpdateProjectRequest = {
  name: string;
  root_hint: string | null;
  archived: boolean;
};

export type UpsertProjectNodeRootRequest = {
  node_name: string;
  root_path: string;
  safe_root_status: ProjectNodeRootSafeStatus;
};

export type ProjectGraphStatus = {
  project_id: string;
  status: string;
  snapshot_id?: string | null;
  active_snapshot_id?: string | null;
  latest_snapshot_id?: string | null;
  latest_status?: string | null;
  file_count?: number;
  symbol_count?: number;
  relation_count?: number;
  updated_at?: string | null;
  error_detail?: string | null;
};

export type ProjectGraphIndexRequest = {
  node_name: string;
  root_path: string;
  force: boolean;
};

export type ProjectGraphQueryRequest = {
  type: string;
  payload: Record<string, unknown>;
};

export type ProjectGraphSymbolRecord = {
  id: string;
  qualified_name: string;
  name: string;
  kind: string;
  language: string;
  start_line: number;
  end_line: number;
  file: {
    path: string;
  };
};

export type ProjectGraphSymbolQueryResponse = {
  type: "find_symbol";
  result: ProjectGraphSymbolRecord[];
};

export function listProjects(includeArchived: boolean) {
  return apiGet<{ projects: ProjectRecord[] }>(`/projects?include_archived=${includeArchived ? "true" : "false"}`);
}

export function createProject(payload: CreateProjectRequest) {
  return apiPost<ProjectRecord>("/projects", payload);
}

export function updateProject(projectId: string, payload: UpdateProjectRequest) {
  return apiPatch<ProjectRecord>(`/projects/${encodeURIComponent(projectId)}`, payload);
}

export function listProjectNodeRoots(projectId: string) {
  return apiGet<{ node_roots: ProjectNodeRootRecord[] }>(`/projects/${encodeURIComponent(projectId)}/node-roots`);
}

export function upsertProjectNodeRoot(projectId: string, payload: UpsertProjectNodeRootRequest) {
  return apiPut<ProjectNodeRootRecord>(`/projects/${encodeURIComponent(projectId)}/node-roots`, payload);
}

export function getProjectGraphStatus(projectId: string) {
  return apiGet<ProjectGraphStatus>(`/projects/${encodeURIComponent(projectId)}/graph/status`);
}

export function getProjectGraphOverview(projectId: string) {
  return apiGet<Record<string, unknown>>(`/projects/${encodeURIComponent(projectId)}/graph/overview`);
}

export function indexProjectGraph(projectId: string, payload: ProjectGraphIndexRequest) {
  return apiPost<Record<string, unknown>>(`/projects/${encodeURIComponent(projectId)}/graph/index`, payload);
}

export function queryProjectGraph(projectId: string, payload: ProjectGraphQueryRequest) {
  return apiPost<Record<string, unknown>>(`/projects/${encodeURIComponent(projectId)}/graph/query`, payload);
}

export function findProjectGraphSymbols(projectId: string, query: string) {
  return apiPost<ProjectGraphSymbolQueryResponse>(`/projects/${encodeURIComponent(projectId)}/graph/query`, {
    type: "find_symbol",
    payload: { query },
  });
}
