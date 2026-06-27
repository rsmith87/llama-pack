const apiBase = "/lm-api/v1/plugins/llama_pack_workflows";

async function fetchJson(path) {
  const response = await fetch(`${apiBase}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

function renderList(elementId, items, renderItem) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.innerHTML = "";
  for (const item of items) {
    const row = document.createElement("div");
    row.className = "workflow-row";
    row.innerHTML = renderItem(item);
    element.appendChild(row);
  }
}

async function refreshWorkflows() {
  const [templates, workflows, runs] = await Promise.all([
    fetchJson("/templates"),
    fetchJson("/workflows"),
    fetchJson("/runs"),
  ]);
  renderList("workflow-templates", templates.templates, (item) => `<strong>${item.name}</strong><span>${item.description}</span>`);
  renderList("workflow-definitions", workflows.workflows, (item) => `<strong>${item.name}</strong><span>${item.enabled ? "enabled" : "disabled"}</span>`);
  renderList("workflow-runs", runs.runs, (item) => `<strong>${item.status}</strong><span>${item.trigger_type}: ${item.trigger_detail}</span>`);
}

document.querySelector("[data-workflow-action='refresh']")?.addEventListener("click", () => {
  refreshWorkflows().catch((error) => console.error(error));
});

refreshWorkflows().catch((error) => console.error(error));
