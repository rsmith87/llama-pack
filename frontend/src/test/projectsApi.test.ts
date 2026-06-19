import { afterEach, describe, expect, it, vi } from "vitest";
import { createProject, getProjectGraphStatus, indexProjectGraph, listProjectNodeRoots, updateProject, upsertProjectNodeRoot } from "../api/projects";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function okJson(payload: unknown) {
  return { ok: true, json: async () => payload };
}

describe("projects api", () => {
  it("creates and updates projects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(okJson({ id: "project-1" }))
        .mockResolvedValueOnce(okJson({ id: "project-1", name: "Renamed" })),
    );

    await createProject({ name: "Spitball", root_hint: "/repo" });
    await updateProject("project-1", { name: "Renamed", root_hint: "/workspace", archived: false });

    expect(fetch).toHaveBeenNthCalledWith(1, "/lm-api/v1/projects", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ name: "Spitball", root_hint: "/repo" }),
    }));
    expect(fetch).toHaveBeenNthCalledWith(2, "/lm-api/v1/projects/project-1", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ name: "Renamed", root_hint: "/workspace", archived: false }),
    }));
  });

  it("lists and upserts project node roots", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(okJson({ node_roots: [] }))
        .mockResolvedValueOnce(okJson({ id: "root-1", safe_root_status: "allowed" })),
    );

    await listProjectNodeRoots("project-1");
    await upsertProjectNodeRoot("project-1", { node_name: "mac-mini", root_path: "/repo", safe_root_status: "allowed" });

    expect(fetch).toHaveBeenNthCalledWith(1, "/lm-api/v1/projects/project-1/node-roots", expect.objectContaining({ method: "GET" }));
    expect(fetch).toHaveBeenNthCalledWith(2, "/lm-api/v1/projects/project-1/node-roots", expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ node_name: "mac-mini", root_path: "/repo", safe_root_status: "allowed" }),
    }));
  });

  it("loads graph status and indexes a project graph", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(okJson({ project_id: "project-1", status: "not_indexed" }))
        .mockResolvedValueOnce(okJson({ id: "job-1", type: "project.graph.index" })),
    );

    await getProjectGraphStatus("project-1");
    await indexProjectGraph("project-1", { node_name: "mac-mini", root_path: "/repo", force: false });

    expect(fetch).toHaveBeenNthCalledWith(1, "/lm-api/v1/projects/project-1/graph/status", expect.objectContaining({ method: "GET" }));
    expect(fetch).toHaveBeenNthCalledWith(2, "/lm-api/v1/projects/project-1/graph/index", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ node_name: "mac-mini", root_path: "/repo", force: false }),
    }));
  });
});
