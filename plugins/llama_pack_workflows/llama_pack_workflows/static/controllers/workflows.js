function defaultParameters(templateId) {
  if (templateId === "thread_prompt_chain") {
    return {
      content: "Summarize the latest thread activity.",
      steps: [{ label: "summarize", instructions: "Summarize in five bullets." }],
      model: "auto",
      target: "auto",
    };
  }
  if (templateId === "scheduled_benchmark") {
    return {
      benchmark_id: "",
      models: [],
    };
  }
  return {};
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

function setStatus(root, message) {
  const status = root.querySelector("[data-workflow-status]");
  if (status) status.textContent = message;
}

function syncTemplateDefaults(root) {
  const select = root.querySelector("[data-workflow-template-select]");
  const parameters = root.querySelector("[data-workflow-parameters]");
  if (!select || !parameters) return;
  parameters.value = JSON.stringify(defaultParameters(select.value), null, 2);
}

async function refreshWorkflows(root, host) {
  const [templates, workflows, runs] = await Promise.all([
    host.apiGet("/templates"),
    host.apiGet("/workflows"),
    host.apiGet("/runs"),
  ]);
  const select = root.querySelector("[data-workflow-template-select]");
  if (select) {
    const selected = select.value;
    select.innerHTML = "";
    for (const template of templates.templates) {
      const option = document.createElement("option");
      option.value = template.id;
      option.textContent = template.name;
      select.appendChild(option);
    }
    if (selected) select.value = selected;
    if (!select.value && templates.templates.length > 0) select.value = templates.templates[0].id;
  }
  const parameters = root.querySelector("[data-workflow-parameters]");
  if (parameters && !parameters.value) syncTemplateDefaults(root);
  renderList("workflow-templates", templates.templates, (item) => `<strong>${item.name}</strong><span>${item.description}</span>`);
  renderList("workflow-definitions", workflows.workflows, (item) => `<strong>${item.name}</strong><span>${item.enabled ? "enabled" : "disabled"}</span>`);
  renderList("workflow-runs", runs.runs, (item) => `<strong>${item.status}</strong><span>${item.trigger_type}: ${item.trigger_detail}</span>`);
}

async function createWorkflow(root, host, form) {
  const data = new FormData(form);
  const parametersJson = String(data.get("parameters_json") || "{}");
  const body = {
    name: String(data.get("name") || ""),
    description: String(data.get("description") || ""),
    template_id: String(data.get("template_id") || ""),
    enabled: data.get("enabled") === "on",
    parameters: JSON.parse(parametersJson),
    triggers: [{ type: "manual", schedule: null, event_type: null }],
  };
  await host.apiPost("/workflows", body);
  form.reset();
  syncTemplateDefaults(root);
  setStatus(root, "Created");
  await refreshWorkflows(root, host);
}

export function mountPage(root, host) {
  const refreshButton = root.querySelector("[data-workflow-action='refresh']");
  const form = root.querySelector("[data-workflow-form='create']");
  const templateSelect = root.querySelector("[data-workflow-template-select]");
  const refresh = () => {
    refreshWorkflows(root, host).catch((error) => {
      setStatus(root, error.message);
      console.error(error);
    });
  };
  const submit = (event) => {
    event.preventDefault();
    if (!form) return;
    setStatus(root, "Creating...");
    createWorkflow(root, host, form).catch((error) => {
      setStatus(root, error.message);
      console.error(error);
    });
  };
  const templateChanged = () => syncTemplateDefaults(root);
  refreshButton?.addEventListener("click", refresh);
  form?.addEventListener("submit", submit);
  templateSelect?.addEventListener("change", templateChanged);
  refresh();

  return () => {
    refreshButton?.removeEventListener("click", refresh);
    form?.removeEventListener("submit", submit);
    templateSelect?.removeEventListener("change", templateChanged);
  };
}
