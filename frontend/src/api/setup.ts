import { apiGet, apiPost } from "./client";
import type {
  ActiveSetupRequest,
  ActiveSetupResult,
  BootstrapAdminResponse,
  CurrentConfig,
  SetupStatus,
} from "../types/index";

export function getSetupStatus() {
  return apiGet<SetupStatus>("/setup/status");
}

export function bootstrapAdmin(payload: { username: string }) {
  return apiPost<BootstrapAdminResponse>("/setup/bootstrap-admin", payload);
}

export function getCurrentConfig() {
  return apiGet<CurrentConfig>("/setup/current-config");
}

export function preflightSetup(payload: ActiveSetupRequest) {
  return apiPost<ActiveSetupResult>("/setup/preflight", payload);
}

export function applySetup(payload: ActiveSetupRequest) {
  return apiPost<ActiveSetupResult>("/setup/apply", payload);
}
