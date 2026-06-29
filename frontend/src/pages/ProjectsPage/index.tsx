import "./styles.css";
import { useEffect, useMemo, useState } from "react";
import {
  createProject,
  findProjectGraphSymbols,
  getProjectGraphStatus,
  indexProjectGraph,
  listProjectNodeRoots,
  listProjects,
  updateProject,
  upsertProjectNodeRoot,
  type ProjectGraphStatus,
  type ProjectGraphSymbolRecord,
  type ProjectNodeRootRecord,
  type ProjectNodeRootSafeStatus,
  type ProjectRecord,
} from "../../api/projects";
import { listNodes } from "../../api/nodes";
import { Button, DataTable, ErrorBanner, FormField, Panel, StatusBadge } from "../../components/ui";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import type { NodeInventoryItem } from "../../types";

type ProjectsData = {
  projects: ProjectRecord[];
  nodes: NodeInventoryItem[];
};

type ProjectNodeRootMapping = {
  nodeName: string;
  root: ProjectNodeRootRecord | null;
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

function graphStatusTone(status: string | undefined): "success" | "warning" | "danger" | "muted" {
  if (status === "ready") return "success";
  if (status === "queued" || status === "running" || status === "not_indexed") return "warning";
  if (status === "failed") return "danger";
  return "muted";
}

function graphMetricValue(value: number | undefined): string {
  return typeof value === "number" ? String(value) : "-";
}

function hasStaleGraphIngest(status: ProjectGraphStatus | null): boolean {
  return Boolean(
    status?.latest_status === "failed"
    && status.active_snapshot_id
    && status.latest_snapshot_id
    && status.active_snapshot_id !== status.latest_snapshot_id,
  );
}

function graphStatusMessage(status: ProjectGraphStatus | null): string {
  if (hasStaleGraphIngest(status)) return "Latest ingest failed; showing the previous ready graph.";
  if (status?.status === "failed" || status?.latest_status === "failed") return "Ingest failed";
  if (status?.status === "not_indexed") return "No graph has been indexed yet.";
  return "";
}

async function loadProjectsData(): Promise<ProjectsData> {
  const [projectsPayload, nodes] = await Promise.all([listProjects(false), listNodes()]);
  return { projects: projectsPayload.projects, nodes };
}

function nodeRootMappings(nodes: NodeInventoryItem[], roots: ProjectNodeRootRecord[]): ProjectNodeRootMapping[] {
  const byNode = new Map<string, ProjectNodeRootRecord>();
  for (const root of roots) byNode.set(root.node_name, root);
  const names = new Set<string>();
  for (const node of nodes) {
    if (node.name) names.add(node.name);
  }
  for (const root of roots) names.add(root.node_name);
  return Array.from(names)
    .sort((left, right) => left.localeCompare(right))
    .map((nodeName) => ({ nodeName, root: byNode.get(nodeName) || null }));
}

export function ProjectsPage() {
  const { data, loading, error, refresh, setError } = useAsyncResource<ProjectsData>(loadProjectsData, { projects: [], nodes: [] });
  const projects = data.projects;
  const nodes = data.nodes;
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || projects[0] || null,
    [projects, selectedProjectId],
  );

  const [nodeRoots, setNodeRoots] = useState<ProjectNodeRootRecord[]>([]);
  const [graphStatus, setGraphStatus] = useState<ProjectGraphStatus | null>(null);
  const [rootsLoading, setRootsLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [symbolQuery, setSymbolQuery] = useState("");
  const [symbolResults, setSymbolResults] = useState<ProjectGraphSymbolRecord[]>([]);
  const [symbolSearching, setSymbolSearching] = useState(false);
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
      setGraphStatus(null);
      setSymbolQuery("");
      setSymbolResults([]);
      setRootForm(emptyRootForm(null));
      return;
    }
    if (selectedProject.id !== selectedProjectId) setSelectedProjectId(selectedProject.id);
    setEditName(selectedProject.name);
    setEditRootHint(selectedProject.root_hint || "");
    setRootForm(emptyRootForm(selectedProject));
    setSymbolQuery("");
    setSymbolResults([]);
  }, [selectedProject, selectedProjectId]);

  useEffect(() => {
    if (!selectedProject) return;
    let active = true;
    setRootsLoading(true);
    setError("");
    Promise.all([
      listProjectNodeRoots(selectedProject.id),
      getProjectGraphStatus(selectedProject.id),
    ])
      .then(([rootsPayload, statusPayload]) => {
        if (active) {
          setNodeRoots(rootsPayload.node_roots);
          setGraphStatus(statusPayload);
        }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load project graph data");
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

  async function reloadGraphStatus(projectId: string): Promise<void> {
    setGraphStatus(await getProjectGraphStatus(projectId));
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

  async function handleIngestCodebase(force: boolean): Promise<void> {
    if (!selectedProject) return;
    setSaveMessage("");
    setError("");
    const nodeName = rootForm.nodeName.trim();
    const rootPath = rootForm.rootPath.trim();
    if (!nodeName || !rootPath) {
      setError("Select or enter a node root before ingesting a codebase.");
      return;
    }
    setIngesting(true);
    try {
      await indexProjectGraph(selectedProject.id, { node_name: nodeName, root_path: rootPath, force });
      await reloadGraphStatus(selectedProject.id);
      setSaveMessage(force ? "Codebase reindex queued." : "Codebase ingest queued.");
    } finally {
      setIngesting(false);
    }
  }

  async function handleSearchSymbols(): Promise<void> {
    if (!selectedProject) return;
    setSaveMessage("");
    setError("");
    const query = symbolQuery.trim();
    if (!query) {
      setError("Symbol query is required.");
      return;
    }
    setSymbolSearching(true);
    try {
      const response = await findProjectGraphSymbols(selectedProject.id, query);
      setSymbolResults(response.result);
    } finally {
      setSymbolSearching(false);
    }
  }

  function editRoot(root: ProjectNodeRootRecord): void {
    setRootForm({
      nodeName: root.node_name,
      rootPath: root.root_path,
      safeRootStatus: root.safe_root_status,
    });
  }

  function configureNodeRoot(nodeName: string): void {
    setRootForm({
      nodeName,
      rootPath: selectedProject?.root_hint || "",
      safeRootStatus: "unknown",
    });
  }

  const rootMappings = nodeRootMappings(nodes, nodeRoots);

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

              <DataTable
                rows={rootMappings}
                emptyMessage={rootsLoading ? "Loading controller nodes..." : "No controller nodes found."}
                getRowKey={(mapping) => mapping.nodeName}
                columns={[
                  { key: "node", header: "Node", render: (mapping) => mapping.nodeName },
                  { key: "path", header: "Project Root", render: (mapping) => mapping.root?.root_path || "No root mapped" },
                  {
                    key: "status",
                    header: "Safe Status",
                    render: (mapping) => mapping.root ? <StatusBadge tone={statusTone(mapping.root.safe_root_status)}>{mapping.root.safe_root_status}</StatusBadge> : <StatusBadge tone="muted">unmapped</StatusBadge>,
                  },
                  {
                    key: "actions",
                    header: "Actions",
                    render: (mapping) => {
                      const root = mapping.root;
                      if (root) {
                        return <Button type="button" onClick={() => editRoot(root)} aria-label={`Edit root for ${mapping.nodeName}`}>Edit</Button>;
                      }
                      return <Button type="button" onClick={() => configureNodeRoot(mapping.nodeName)} aria-label={`Configure root for ${mapping.nodeName}`}>Configure</Button>;
                    },
                  },
                ]}
              />

              <Panel title="Code Graph" eyebrow="Indexed graph">
                <div className="projects-graph-panel">
                  <div className="projects-graph-status">
                    <span className="label">Graph Status</span>
                    <StatusBadge tone={graphStatusTone(graphStatus?.status)}>{graphStatus?.status || "unknown"}</StatusBadge>
                    {graphStatus?.snapshot_id || graphStatus?.active_snapshot_id ? (
                      <span className="muted">snapshot={graphStatus.snapshot_id || graphStatus.active_snapshot_id}</span>
                    ) : null}
                  </div>
                  <div className="projects-graph-actions">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => void handleIngestCodebase(false)}
                      disabled={ingesting || rootForm.safeRootStatus !== "allowed"}
                    >
                      {ingesting ? "Queueing" : "Ingest Codebase"}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleIngestCodebase(true)}
                      disabled={ingesting || rootForm.safeRootStatus !== "allowed"}
                    >
                      Force Reindex
                    </Button>
                  </div>
                </div>
                <div className="projects-graph-summary">
                  <div><span>Files</span><strong>{graphMetricValue(graphStatus?.file_count)}</strong></div>
                  <div><span>Symbols</span><strong>{graphMetricValue(graphStatus?.symbol_count)}</strong></div>
                  <div><span>Relations</span><strong>{graphMetricValue(graphStatus?.relation_count)}</strong></div>
                  <div><span>Last Update</span><strong>{graphStatus?.updated_at || "-"}</strong></div>
                </div>
                {graphStatusMessage(graphStatus) ? (
                  <div className={`projects-graph-explanation ${hasStaleGraphIngest(graphStatus) ? "warning" : "danger"}`} role="status">
                    <strong>{graphStatusMessage(graphStatus)}</strong>
                    {graphStatus?.error_detail ? <p>{graphStatus.error_detail}</p> : null}
                  </div>
                ) : null}
                <div className="projects-symbol-search">
                  <div className="projects-symbol-search-form">
                    <FormField label="Symbol Query">
                      <input
                        value={symbolQuery}
                        onChange={(event) => setSymbolQuery(event.target.value)}
                        placeholder="ProjectGraphIndexer"
                      />
                    </FormField>
                    <Button
                      type="button"
                      onClick={() => void handleSearchSymbols()}
                      disabled={symbolSearching || graphStatus?.status !== "ready"}
                    >
                      {symbolSearching ? "Searching" : "Search Symbols"}
                    </Button>
                  </div>
                  <DataTable
                    rows={symbolResults}
                    emptyMessage={symbolSearching ? "Searching symbols..." : "No symbol results."}
                    getRowKey={(symbol) => symbol.id}
                    columns={[
                      { key: "name", header: "Name", render: (symbol) => symbol.name },
                      { key: "kind", header: "Kind", render: (symbol) => symbol.kind },
                      { key: "path", header: "Path", render: (symbol) => symbol.file.path },
                      { key: "lines", header: "Lines", render: (symbol) => `${symbol.start_line}-${symbol.end_line}` },
                    ]}
                  />
                </div>
              </Panel>
            </div>
          ) : (
            <p className="muted">Create a project before registering node roots.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
