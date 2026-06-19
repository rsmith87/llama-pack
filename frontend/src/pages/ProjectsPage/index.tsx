import "./styles.css";
import { useEffect, useMemo, useState } from "react";
import {
  createProject,
  listProjectNodeRoots,
  listProjects,
  updateProject,
  upsertProjectNodeRoot,
  type ProjectNodeRootRecord,
  type ProjectNodeRootSafeStatus,
  type ProjectRecord,
} from "../../api/projects";
import { Button, DataTable, ErrorBanner, FormField, Panel, StatusBadge } from "../../components/ui";
import { useAsyncResource } from "../../hooks/useAsyncResource";

type ProjectsData = {
  projects: ProjectRecord[];
};

const SAFE_ROOT_STATUSES: ProjectNodeRootSafeStatus[] = ["unknown", "allowed", "blocked"];

function emptyRootForm(project: ProjectRecord | null): {
  nodeName: string;
  rootPath: string;
  safeRootStatus: ProjectNodeRootSafeStatus;
} {
  return {
    nodeName: "",
    rootPath: project?.root_hint || "",
    safeRootStatus: "unknown",
  };
}

function statusTone(status: ProjectNodeRootSafeStatus): "success" | "warning" | "danger" | "muted" {
  if (status === "allowed") return "success";
  if (status === "blocked") return "danger";
  if (status === "unknown") return "warning";
  return "muted";
}

async function loadProjectsData(): Promise<ProjectsData> {
  const payload = await listProjects(false);
  return { projects: payload.projects };
}

export function ProjectsPage() {
  const { data, loading, error, refresh, setError } = useAsyncResource<ProjectsData>(loadProjectsData, { projects: [] });
  const projects = data.projects;
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || projects[0] || null,
    [projects, selectedProjectId],
  );

  const [nodeRoots, setNodeRoots] = useState<ProjectNodeRootRecord[]>([]);
  const [rootsLoading, setRootsLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newRootHint, setNewRootHint] = useState("");
  const [editName, setEditName] = useState("");
  const [editRootHint, setEditRootHint] = useState("");
  const [rootForm, setRootForm] = useState(emptyRootForm(null));

  useEffect(() => {
    if (!selectedProject) {
      setSelectedProjectId("");
      setEditName("");
      setEditRootHint("");
      setNodeRoots([]);
      setRootForm(emptyRootForm(null));
      return;
    }
    if (selectedProject.id !== selectedProjectId) setSelectedProjectId(selectedProject.id);
    setEditName(selectedProject.name);
    setEditRootHint(selectedProject.root_hint || "");
    setRootForm(emptyRootForm(selectedProject));
  }, [selectedProject, selectedProjectId]);

  useEffect(() => {
    if (!selectedProject) return;
    let active = true;
    setRootsLoading(true);
    setError("");
    listProjectNodeRoots(selectedProject.id)
      .then((payload) => {
        if (active) setNodeRoots(payload.node_roots);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load project node roots");
      })
      .finally(() => {
        if (active) setRootsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedProject, setError]);

  async function reloadNodeRoots(projectId: string): Promise<void> {
    const payload = await listProjectNodeRoots(projectId);
    setNodeRoots(payload.node_roots);
  }

  async function handleCreateProject(): Promise<void> {
    setSaveMessage("");
    setError("");
    const name = newProjectName.trim();
    const rootHint = newRootHint.trim();
    if (!name) {
      setError("Project name is required.");
      return;
    }
    const created = await createProject({ name, root_hint: rootHint || null });
    setNewProjectName("");
    setNewRootHint("");
    setSelectedProjectId(created.id);
    await refresh();
    setSaveMessage("Project created.");
  }

  async function handleUpdateProject(): Promise<void> {
    if (!selectedProject) return;
    setSaveMessage("");
    setError("");
    const name = editName.trim();
    const rootHint = editRootHint.trim();
    if (!name) {
      setError("Project name is required.");
      return;
    }
    await updateProject(selectedProject.id, { name, root_hint: rootHint || null, archived: Boolean(selectedProject.archived) });
    await refresh();
    setSaveMessage("Project updated.");
  }

  async function handleSaveNodeRoot(): Promise<void> {
    if (!selectedProject) return;
    setSaveMessage("");
    setError("");
    const nodeName = rootForm.nodeName.trim();
    const rootPath = rootForm.rootPath.trim();
    if (!nodeName || !rootPath) {
      setError("Node name and root path are required.");
      return;
    }
    await upsertProjectNodeRoot(selectedProject.id, {
      node_name: nodeName,
      root_path: rootPath,
      safe_root_status: rootForm.safeRootStatus,
    });
    await reloadNodeRoots(selectedProject.id);
    setSaveMessage("Node root saved.");
  }

  function editRoot(root: ProjectNodeRootRecord): void {
    setRootForm({
      nodeName: root.node_name,
      rootPath: root.root_path,
      safeRootStatus: root.safe_root_status,
    });
  }

  return (
    <div className="projects-page-react">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Knowledge graph</span>
          <h2>Projects</h2>
        </div>
        <Button type="button" onClick={refresh} disabled={loading}>{loading ? "Refreshing" : "Refresh"}</Button>
      </div>
      <ErrorBanner message={error} />
      {saveMessage ? <p className="projects-save-message" role="status">{saveMessage}</p> : null}

      <div className="projects-layout">
        <Panel title="Project Registry" eyebrow="Controller-owned">
          <div className="projects-create-form">
            <FormField label="New Project Name">
              <input value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} />
            </FormField>
            <FormField label="New Root Hint">
              <input value={newRootHint} onChange={(event) => setNewRootHint(event.target.value)} placeholder="/path/to/workspace" />
            </FormField>
            <Button type="button" variant="primary" onClick={() => void handleCreateProject()}>Create Project</Button>
          </div>
          <DataTable
            rows={projects}
            emptyMessage={loading ? "Loading projects..." : "No projects found."}
            getRowKey={(project) => project.id}
            columns={[
              { key: "name", header: "Name", render: (project) => project.name },
              { key: "root", header: "Root Hint", render: (project) => project.root_hint || "-" },
              {
                key: "actions",
                header: "Actions",
                render: (project) => (
                  <Button type="button" onClick={() => setSelectedProjectId(project.id)} aria-label={`Select ${project.name}`}>
                    {project.id === selectedProject?.id ? "Selected" : "Select"}
                  </Button>
                ),
              },
            ]}
          />
        </Panel>

        <Panel title="Project Detail" eyebrow={selectedProject?.name || "No project"}>
          {selectedProject ? (
            <div className="projects-detail-stack">
              <div className="projects-edit-form">
                <FormField label="Project Name">
                  <input value={editName} onChange={(event) => setEditName(event.target.value)} />
                </FormField>
                <FormField label="Root Hint">
                  <input value={editRootHint} onChange={(event) => setEditRootHint(event.target.value)} />
                </FormField>
                <Button type="button" onClick={() => void handleUpdateProject()}>Save Project</Button>
              </div>

              <div className="projects-root-form">
                <FormField label="Node Name">
                  <input value={rootForm.nodeName} onChange={(event) => setRootForm({ ...rootForm, nodeName: event.target.value })} placeholder="mac-mini" />
                </FormField>
                <FormField label="Root Path">
                  <input value={rootForm.rootPath} onChange={(event) => setRootForm({ ...rootForm, rootPath: event.target.value })} placeholder="/path/to/workspace" />
                </FormField>
                <FormField label="Safe Root Status">
                  <select value={rootForm.safeRootStatus} onChange={(event) => setRootForm({ ...rootForm, safeRootStatus: event.target.value as ProjectNodeRootSafeStatus })}>
                    {SAFE_ROOT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </FormField>
                <Button type="button" variant="primary" onClick={() => void handleSaveNodeRoot()}>Save Node Root</Button>
              </div>

              <DataTable
                rows={nodeRoots}
                emptyMessage={rootsLoading ? "Loading node roots..." : "No node roots registered."}
                getRowKey={(root) => root.id}
                columns={[
                  { key: "node", header: "Node", render: (root) => root.node_name },
                  { key: "path", header: "Root Path", render: (root) => root.root_path },
                  { key: "status", header: "Safe Status", render: (root) => <StatusBadge tone={statusTone(root.safe_root_status)}>{root.safe_root_status}</StatusBadge> },
                  { key: "updated", header: "Updated", render: (root) => root.updated_at },
                  { key: "actions", header: "Actions", render: (root) => <Button type="button" onClick={() => editRoot(root)}>Edit</Button> },
                ]}
              />
            </div>
          ) : (
            <p className="muted">Create a project before registering node roots.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
