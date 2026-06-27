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

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = String(value);
  return element.innerHTML;
}

function setStatus(root, message) {
  const status = root.querySelector("[data-workflow-status]");
  if (status) status.textContent = message;
}

function setEditing(root, editing) {
  const title = root.querySelector("[data-workflow-form-title]");
  const saveLabel = root.querySelector("[data-workflow-save-label]");
  const cancelButton = root.querySelector("[data-workflow-action='cancel-edit']");
  if (title) title.textContent = editing ? "Edit Workflow" : "Create Workflow";
  if (saveLabel) saveLabel.textContent = editing ? "Save Changes" : "Save";
  if (cancelButton) cancelButton.hidden = !editing;
}

function syncTemplateDefaults(root) {
  const select = root.querySelector("[data-workflow-template-select]");
  if (!select) return;
  setParameterFields(root, select.value, defaultParameters(select.value));
}

function setParameterPanel(root, templateId) {
  const panels = root.querySelectorAll("[data-workflow-parameter-panel]");
  for (const panel of panels) {
    panel.hidden = panel.dataset.workflowParameterPanel !== templateId;
  }
}

function clearSteps(root) {
  const steps = root.querySelector("[data-workflow-steps]");
  if (steps) steps.innerHTML = "";
}

function addStepField(root, label, instructions) {
  const steps = root.querySelector("[data-workflow-steps]");
  if (!steps) return;
  const row = document.createElement("div");
  row.className = "workflow-step-row";
  row.innerHTML = `
    <label>
      Label
      <input name="step_label" value="${escapeHtml(label)}" />
    </label>
    <label>
      Instructions
      <textarea name="step_instructions" rows="3">${escapeHtml(instructions)}</textarea>
    </label>
    <button type="button" data-workflow-action="remove-step">Remove</button>
  `;
  steps.appendChild(row);
}

function setParameterFields(root, templateId, parameters) {
  const form = root.querySelector("[data-workflow-form='create']");
  if (!form) return;
  setParameterPanel(root, templateId);
  if (templateId === "thread_prompt_chain") {
    form.elements.content.value = String(parameters.content || "");
    form.elements.model.value = String(parameters.model || "auto");
    form.elements.target.value = String(parameters.target || "auto");
    clearSteps(root);
    const steps = Array.isArray(parameters.steps) && parameters.steps.length > 0
      ? parameters.steps
      : [{ label: "summarize", instructions: "Summarize in five bullets." }];
    for (const step of steps) {
      addStepField(root, String(step.label || ""), String(step.instructions || ""));
    }
  }
  if (templateId === "scheduled_benchmark") {
    form.elements.benchmark_id.value = String(parameters.benchmark_id || "");
    form.elements.models.value = Array.isArray(parameters.models) ? parameters.models.join(", ") : "";
  }
}

function buildParameters(root, data) {
  const templateId = String(data.get("template_id") || "");
  if (templateId === "thread_prompt_chain") {
    const stepRows = root.querySelectorAll(".workflow-step-row");
    const steps = [];
    for (const row of stepRows) {
      const label = String(row.querySelector("[name='step_label']")?.value || "").trim();
      const instructions = String(row.querySelector("[name='step_instructions']")?.value || "").trim();
      if (label || instructions) steps.push({ label, instructions });
    }
    return {
      content: String(data.get("content") || ""),
      steps,
      model: String(data.get("model") || "auto"),
      target: String(data.get("target") || "auto"),
    };
  }
  if (templateId === "scheduled_benchmark") {
    const models = String(data.get("models") || "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item);
    return {
      benchmark_id: String(data.get("benchmark_id") || ""),
      models,
    };
  }
  return {};
}

function resetForm(root, form) {
  form.reset();
  form.elements.workflow_id.value = "";
  setEditing(root, false);
  syncTemplateDefaults(root);
  syncTriggerFields(root);
  hideAdvanced(root);
}

function syncTriggerFields(root) {
  const triggerType = root.querySelector("[data-workflow-trigger-type]");
  const dailyField = root.querySelector("[data-workflow-trigger-field='daily']");
  const intervalField = root.querySelector("[data-workflow-trigger-field='interval']");
  const eventField = root.querySelector("[data-workflow-trigger-field='event']");
  if (!triggerType || !dailyField || !intervalField || !eventField) return;
  dailyField.hidden = triggerType.value !== "schedule_daily";
  intervalField.hidden = triggerType.value !== "schedule_interval";
  eventField.hidden = triggerType.value !== "event";
}

function hideAdvanced(root) {
  const advanced = root.querySelector("[data-workflow-advanced]");
  if (advanced) advanced.hidden = true;
}

function toggleAdvanced(root) {
  const advanced = root.querySelector("[data-workflow-advanced]");
  if (advanced) advanced.hidden = !advanced.hidden;
}

function workflowTriggerOption(workflow) {
  const trigger = workflow.triggers && workflow.triggers.length > 0 ? workflow.triggers[0] : null;
  if (!trigger || trigger.type === "manual") return { type: "manual", dailyTime: "09:00", intervalMinutes: "60" };
  if (trigger.type === "schedule" && trigger.schedule?.kind === "daily") {
    return { type: "schedule_daily", dailyTime: trigger.schedule.value, intervalMinutes: "60" };
  }
  if (trigger.type === "schedule" && trigger.schedule?.kind === "interval_minutes") {
    return { type: "schedule_interval", dailyTime: "09:00", intervalMinutes: trigger.schedule.value };
  }
  if (trigger.type === "event" && trigger.event_type) {
    return { type: "event", dailyTime: "09:00", intervalMinutes: "60", eventType: trigger.event_type };
  }
  return { type: "manual", dailyTime: "09:00", intervalMinutes: "60" };
}

function populateForm(root, workflow) {
  const form = root.querySelector("[data-workflow-form='create']");
  if (!form) return;
  const trigger = workflowTriggerOption(workflow);
  form.elements.workflow_id.value = workflow.id;
  form.elements.name.value = workflow.name;
  form.elements.description.value = workflow.description;
  form.elements.template_id.value = workflow.template_id;
  setParameterFields(root, workflow.template_id, workflow.parameters);
  form.elements.trigger_type.value = trigger.type;
  form.elements.daily_time.value = trigger.dailyTime;
  form.elements.interval_minutes.value = trigger.intervalMinutes;
  form.elements.event_type.value = trigger.eventType || "llama_pack.chat.completed";
  form.elements.enabled.checked = Boolean(workflow.enabled);
  setEditing(root, true);
  syncTriggerFields(root);
  setStatus(root, "Editing workflow");
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
  const selectedTemplate = select?.value || "thread_prompt_chain";
  setParameterPanel(root, selectedTemplate);
  const form = root.querySelector("[data-workflow-form='create']");
  if (form && !form.elements.workflow_id.value && !form.elements.content.value && !form.elements.benchmark_id.value) {
    setParameterFields(root, selectedTemplate, defaultParameters(selectedTemplate));
  }
  renderList("workflow-templates", templates.templates, (item) => `<strong>${item.name}</strong><span>${item.description}</span>`);
  renderList("workflow-definitions", workflows.workflows, (item) => `
    <div class="workflow-row-main">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${escapeHtml(item.enabled ? "enabled" : "disabled")} · ${escapeHtml(item.template_id)}</span>
    </div>
    <div class="workflow-row-actions">
      <button type="button" data-workflow-action="edit" data-workflow-id="${escapeHtml(item.id)}">Edit</button>
      <button type="button" data-workflow-action="run" data-workflow-id="${escapeHtml(item.id)}">Run</button>
      <button type="button" data-workflow-action="${item.enabled ? "disable" : "enable"}" data-workflow-id="${escapeHtml(item.id)}">${item.enabled ? "Disable" : "Enable"}</button>
    </div>
  `);
  renderList("workflow-runs", runs.runs, (item) => `<strong>${item.status}</strong><span>${item.trigger_type}: ${item.trigger_detail}</span>`);
  root.workflowDefinitions = workflows.workflows;
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
  if (triggerType === "event") {
    const eventType = String(data.get("event_type") || "").trim();
    if (eventType !== "llama_pack.chat.completed" && eventType !== "llama_pack.chat.failed") {
      throw new Error(`Unsupported workflow event type: ${eventType}`);
    }
    return [{ type: "event", schedule: null, event_type: eventType }];
  }
  throw new Error(`Unsupported trigger type: ${triggerType}`);
}

async function createWorkflow(root, host, form) {
  const data = new FormData(form);
  const workflowId = String(data.get("workflow_id") || "");
  const body = {
    name: String(data.get("name") || ""),
    description: String(data.get("description") || ""),
    template_id: String(data.get("template_id") || ""),
    enabled: data.get("enabled") === "on",
    parameters: buildParameters(root, data),
    triggers: buildTriggers(data),
  };
  if (workflowId) {
    await host.apiPut(`/workflows/${encodeURIComponent(workflowId)}`, body);
    setStatus(root, "Saved");
  } else {
    await host.apiPost("/workflows", body);
    setStatus(root, "Created");
  }
  resetForm(root, form);
  await refreshWorkflows(root, host);
}

async function handleWorkflowAction(root, host, action, workflowId) {
  if (action === "edit") {
    const workflow = (root.workflowDefinitions || []).find((item) => item.id === workflowId);
    if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);
    populateForm(root, workflow);
    return;
  }
  if (action === "run") {
    await host.apiPost(`/workflows/${encodeURIComponent(workflowId)}/runs`);
    setStatus(root, "Run started");
  }
  if (action === "enable") {
    await host.apiPost(`/workflows/${encodeURIComponent(workflowId)}/enable`);
    setStatus(root, "Enabled");
  }
  if (action === "disable") {
    await host.apiPost(`/workflows/${encodeURIComponent(workflowId)}/disable`);
    setStatus(root, "Disabled");
  }
  await refreshWorkflows(root, host);
}

export function mountPage(root, host) {
  const refreshButton = root.querySelector("[data-workflow-action='refresh']");
  const cancelButton = root.querySelector("[data-workflow-action='cancel-edit']");
  const form = root.querySelector("[data-workflow-form='create']");
  const definitions = root.querySelector("#workflow-definitions");
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
  const formAction = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.dataset.workflowAction;
    if (action === "add-step") {
      addStepField(root, "", "");
    }
    if (action === "remove-step") {
      target.closest(".workflow-step-row")?.remove();
    }
    if (action === "toggle-advanced") {
      toggleAdvanced(root);
    }
  };
  const cancelEdit = () => {
    if (!form) return;
    resetForm(root, form);
    setStatus(root, "");
  };
  const workflowAction = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.dataset.workflowAction;
    const workflowId = target.dataset.workflowId;
    if (!action || !workflowId) return;
    handleWorkflowAction(root, host, action, workflowId).catch((error) => {
      setStatus(root, error.message);
      console.error(error);
    });
  };
  refreshButton?.addEventListener("click", refresh);
  cancelButton?.addEventListener("click", cancelEdit);
  definitions?.addEventListener("click", workflowAction);
  form?.addEventListener("click", formAction);
  form?.addEventListener("submit", submit);
  templateSelect?.addEventListener("change", templateChanged);
  triggerType?.addEventListener("change", triggerChanged);
  syncTriggerFields(root);
  refresh();

  return () => {
    refreshButton?.removeEventListener("click", refresh);
    cancelButton?.removeEventListener("click", cancelEdit);
    definitions?.removeEventListener("click", workflowAction);
    form?.removeEventListener("click", formAction);
    form?.removeEventListener("submit", submit);
    templateSelect?.removeEventListener("change", templateChanged);
    triggerType?.removeEventListener("change", triggerChanged);
  };
}
