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

function syncTriggerFields(root) {
  const triggerType = root.querySelector("[data-workflow-trigger-type]");
  const dailyField = root.querySelector("[data-workflow-trigger-field='daily']");
  const intervalField = root.querySelector("[data-workflow-trigger-field='interval']");
  if (!triggerType || !dailyField || !intervalField) return;
  dailyField.hidden = triggerType.value !== "schedule_daily";
  intervalField.hidden = triggerType.value !== "schedule_interval";
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

function buildTriggers(data) {
  const triggerType = String(data.get("trigger_type") || "manual");
  if (triggerType === "manual") {
    return [{ type: "manual", schedule: null, event_type: null }];
  }
  if (triggerType === "schedule_daily") {
    const dailyTime = String(data.get("daily_time") || "").trim();
    if (!dailyTime) throw new Error("Daily workflows require a run time.");
    return [{ type: "schedule", schedule: { kind: "daily", value: dailyTime }, event_type: null }];
  }
  if (triggerType === "schedule_interval") {
    const intervalMinutes = String(data.get("interval_minutes") || "").trim();
    if (!intervalMinutes || Number(intervalMinutes) < 1) throw new Error("Interval workflows require minutes greater than zero.");
    return [{ type: "schedule", schedule: { kind: "interval_minutes", value: intervalMinutes }, event_type: null }];
  }
  throw new Error(`Unsupported trigger type: ${triggerType}`);
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
    triggers: buildTriggers(data),
  };
  await host.apiPost("/workflows", body);
  form.reset();
  syncTemplateDefaults(root);
  syncTriggerFields(root);
  setStatus(root, "Created");
  await refreshWorkflows(root, host);
}

export function mountPage(root, host) {
  const refreshButton = root.querySelector("[data-workflow-action='refresh']");
  const form = root.querySelector("[data-workflow-form='create']");
  const templateSelect = root.querySelector("[data-workflow-template-select]");
  const triggerType = root.querySelector("[data-workflow-trigger-type]");
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
  const triggerChanged = () => syncTriggerFields(root);
  refreshButton?.addEventListener("click", refresh);
  form?.addEventListener("submit", submit);
  templateSelect?.addEventListener("change", templateChanged);
  triggerType?.addEventListener("change", triggerChanged);
  syncTriggerFields(root);
  refresh();

  return () => {
    refreshButton?.removeEventListener("click", refresh);
    form?.removeEventListener("submit", submit);
    templateSelect?.removeEventListener("change", templateChanged);
    triggerType?.removeEventListener("change", triggerChanged);
  };
}
