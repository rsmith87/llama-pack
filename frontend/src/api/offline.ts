import { apiPost } from "./client";

export type OfflineReadinessRequest = {
  source_node: string;
  model: string;
  target_nodes: string[];
};

export type OfflineReadinessNode = {
  node: string;
  reachable: boolean;
  registered: boolean;
  artifact_present: boolean;
  ready: boolean;
  error: string | null;
};

export type OfflineReadinessResponse = {
  source_node: string;
  model: string;
  nodes: OfflineReadinessNode[];
};

export type OfflineDistributeRequest = {
  source_node: string;
  source_file_id: string;
  target_nodes: string[];
};

export type OfflineDistributionNode = {
  node: string;
  status: string;
  transfer_id: string | null;
  error: string | null;
};

export type OfflineDistributionResponse = {
  source_node: string;
  source_file_id: string;
  nodes: OfflineDistributionNode[];
};

export function checkOfflineReadiness(payload: OfflineReadinessRequest): Promise<OfflineReadinessResponse> {
  return apiPost<OfflineReadinessResponse>("/offline/readiness", payload);
}

export function distributeOfflineModel(payload: OfflineDistributeRequest): Promise<OfflineDistributionResponse> {
  return apiPost<OfflineDistributionResponse>("/offline/distribute", payload);
}
