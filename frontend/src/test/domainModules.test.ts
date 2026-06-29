import { afterEach, describe, expect, it, vi } from "vitest";
import { login, logout } from "../api/auth";
import { listAuditEvents } from "../api/audit";
import { sendChat } from "../api/chat";
import { getClientDiscovery } from "../api/clientDiscovery";
import { listJobs } from "../api/controller";
import { listDownloadHistory, listDownloadRecommendations } from "../api/downloads";
import { createEmbeddings } from "../api/embeddings";
import { getHealth } from "../api/health";
import { listGgufs } from "../api/library";
import { listModels } from "../api/models";
import { listNodes } from "../api/nodes";
import { listQuantizationFiles } from "../api/quantizations";
import { applySetup, bootstrapAdmin, getSetupStatus, preflightSetup } from "../api/setup";
import { createThread } from "../api/threads";
import { setAuthTokenProvider } from "../api/client";

afterEach(() => {
  setAuthTokenProvider(() => "");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubJson(payload: unknown = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => payload }),
  );
}

describe("domain API modules", () => {
  it("wraps read endpoints with typed GET calls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/lm-api/v1/nodes") return Promise.resolve({ ok: true, json: async () => [] });
        if (url === "/lm-api/v1/downloads/history?limit=200") return Promise.resolve({ ok: true, json: async () => [] });
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }),
    );

    await getHealth();
    await listModels();
    await listNodes();
    await listGgufs();
    await listDownloadHistory();
    await listDownloadRecommendations();
    await listQuantizationFiles();
    await listAuditEvents();
    await listJobs();
    await getSetupStatus();
    await getClientDiscovery();

    expect(fetch).toHaveBeenNthCalledWith(1, "/lm-api/v1/health", expect.objectContaining({ method: "GET" }));
    expect(fetch).toHaveBeenNthCalledWith(2, "/lm-api/v1/models", expect.objectContaining({ method: "GET" }));
    expect(fetch).toHaveBeenNthCalledWith(3, "/lm-api/v1/nodes", expect.objectContaining({ method: "GET" }));
    expect(fetch).toHaveBeenNthCalledWith(4, "/lm-api/v1/library/ggufs", expect.objectContaining({ method: "GET" }));
    expect(fetch).toHaveBeenNthCalledWith(5, "/lm-api/v1/downloads/history?limit=200", expect.objectContaining({ method: "GET" }));
    expect(fetch).toHaveBeenCalledWith("/lm-api/v1/downloads/recommendations", expect.objectContaining({ method: "GET" }));
    expect(fetch).toHaveBeenNthCalledWith(7, "/lm-api/v1/quantizations/files", expect.objectContaining({ method: "GET" }));
    expect(fetch).toHaveBeenNthCalledWith(8, "/lm-api/v1/audit/events", expect.objectContaining({ method: "GET" }));
    expect(fetch).toHaveBeenNthCalledWith(9, "/lm-api/v1/jobs", expect.objectContaining({ method: "GET" }));
    expect(fetch).toHaveBeenNthCalledWith(10, "/lm-api/v1/setup/status", expect.objectContaining({ method: "GET" }));
    expect(fetch).toHaveBeenNthCalledWith(11, "/lm-api/v1/client-discovery", expect.objectContaining({ method: "GET" }));
  });

  it("wraps mutation endpoints with JSON POST calls", async () => {
    stubJson({ ok: true });

    await login({ username: "root", api_key: "key" });
    await logout();
    await sendChat("mistral", { messages: [] });
    await createEmbeddings("mistral", { input: ["hello"] });
    await createThread({ app: "ui" });
    await bootstrapAdmin({ username: "root" });

    expect(fetch).toHaveBeenNthCalledWith(1, "/lm-api/v1/auth/login", expect.objectContaining({ method: "POST" }));
    expect(fetch).toHaveBeenNthCalledWith(2, "/lm-api/v1/auth/logout", expect.objectContaining({ method: "POST" }));
    expect(fetch).toHaveBeenNthCalledWith(3, "/lm-api/v1/chat/mistral", expect.objectContaining({ method: "POST" }));
    expect(fetch).toHaveBeenNthCalledWith(4, "/lm-api/v1/chat/mistral/embeddings", expect.objectContaining({ method: "POST" }));
    expect(fetch).toHaveBeenNthCalledWith(5, "/lm-api/v1/threads", expect.objectContaining({ method: "POST" }));
    expect(fetch).toHaveBeenNthCalledWith(6, "/lm-api/v1/setup/bootstrap-admin", expect.objectContaining({ method: "POST" }));
  });

  it("calls active setup preflight and apply endpoints", async () => {
    stubJson({ ok: true, status: "ready", existing_files: [], planned_files: [], backup_files: [], message: "ok" });
    const payload = {
      mode: "controller" as const,
      config_path: "config.yaml",
      env_path: ".llama_pack.env",
      overwrite_existing: false,
      inputs: {
        controller: {
          log_dir: "./logs",
          controller_registration_key: "secret",
          node_heartbeat_timeout_seconds: 90,
          controller_instance_id: "local-controller",
        },
      },
    };

    await preflightSetup(payload);
    await applySetup(payload);

    expect(fetch).toHaveBeenCalledWith("/lm-api/v1/setup/preflight", expect.objectContaining({ method: "POST" }));
    expect(fetch).toHaveBeenCalledWith("/lm-api/v1/setup/apply", expect.objectContaining({ method: "POST" }));
  });
});
