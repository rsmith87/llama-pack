import { apiGet, apiPost } from "./client";
import type { BootstrapAdminResponse, CurrentConfig, SetupStatus } from "../types/api";

export function getSetupStatus() {
  return apiGet<SetupStatus>("/setup/status");
}

export function bootstrapAdmin(payload: { username: string }) {
  return apiPost<BootstrapAdminResponse>("/setup/bootstrap-admin", payload);
}

export function getCurrentConfig() {
  return apiGet<CurrentConfig>("/setup/current-config");
}
