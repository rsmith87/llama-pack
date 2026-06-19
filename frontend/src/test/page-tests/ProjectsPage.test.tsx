import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ProjectsPage } from "../../pages/ProjectsPage";

function okJson(payload: unknown) {
  return { ok: true, json: async () => payload };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("creates projects and upserts safe node roots", async () => {
  const fetchMock = vi.fn((url: string, options?: RequestInit) => {
    if (url === "/lm-api/v1/projects?include_archived=false") {
      return Promise.resolve(okJson({
        projects: [
          { id: "project-1", name: "Spitball", root_hint: "/repo", archived: false },
        ],
      }));
    }
    if (url === "/lm-api/v1/projects/project-1/node-roots" && options?.method === "GET") {
      return Promise.resolve(okJson({
        node_roots: [
          {
            id: "root-1",
            project_id: "project-1",
            node_name: "mac-mini",
            root_path: "/repo",
            safe_root_status: "unknown",
            created_at: "2026-06-18T12:00:00Z",
            updated_at: "2026-06-18T12:00:00Z",
          },
        ],
      }));
    }
    if (url === "/lm-api/v1/projects" && options?.method === "POST") {
      return Promise.resolve(okJson({ id: "project-2", name: "New Project", root_hint: "/workspace", archived: false }));
    }
    if (url === "/lm-api/v1/projects/project-1/node-roots" && options?.method === "PUT") {
      return Promise.resolve(okJson({
        id: "root-1",
        project_id: "project-1",
        node_name: "mac-mini",
        root_path: "/repo",
        safe_root_status: "allowed",
        created_at: "2026-06-18T12:00:00Z",
        updated_at: "2026-06-18T12:01:00Z",
      }));
    }
    return Promise.resolve(okJson({}));
  });
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();

  render(<ProjectsPage />);

  expect(await screen.findByRole("heading", { name: "Projects" })).toBeInTheDocument();
  expect(await screen.findByText("/repo")).toBeInTheDocument();

  await user.clear(screen.getByLabelText("New Project Name"));
  await user.type(screen.getByLabelText("New Project Name"), "New Project");
  await user.clear(screen.getByLabelText("New Root Hint"));
  await user.type(screen.getByLabelText("New Root Hint"), "/workspace");
  await user.click(screen.getByRole("button", { name: "Create Project" }));

  expect(fetchMock).toHaveBeenCalledWith("/lm-api/v1/projects", expect.objectContaining({
    method: "POST",
    body: JSON.stringify({ name: "New Project", root_hint: "/workspace" }),
  }));

  await user.click(screen.getByRole("button", { name: "Edit" }));
  await user.selectOptions(screen.getByLabelText("Safe Root Status"), "allowed");
  await user.click(screen.getByRole("button", { name: "Save Node Root" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/lm-api/v1/projects/project-1/node-roots", expect.objectContaining({
    method: "PUT",
    body: JSON.stringify({ node_name: "mac-mini", root_path: "/repo", safe_root_status: "allowed" }),
  })));
});
