const SUPPORTED_EVENT_TRIGGERS = new Set([
  "llama_pack.chat.completed",
  "llama_pack.chat.failed",
  "llama_pack.chat.rejected",
  "llama_pack.thread.error.created",
  "llama_pack.thread.user_message.created",
  "llama_pack.thread.assistant_message.created",
  "llama_pack.thread.workflow_step.failed",
  "llama_pack.thread.history_summary.created",
]);

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

function renderList(root, elementId, items, renderItem, emptyMessage) {
  const element = root.querySelector(`#${elementId}`);
  if (!element) return;
  element.innerHTML = "";
  if (items.length === 0) {
    const row = document.createElement("div");
    row.className = "workflow-empty";
    row.textContent = emptyMessage;
    element.appendChild(row);
    return;
  }
  for (const item of items) {
    const row = document.createElement("div");
    row.className = "workflow-row";
    if (item.id) row.dataset.workflowRowId = item.id;
    row.innerHTML = renderItem(item);
    element.appendChild(row);
  }
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = String(value);
  return element.innerHTML;
}

function workflowIcon(name) {
  const icons = {
    total: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12M6 12h12M6 16h8"/><path d="M4 5h16v14H4z"/></svg>`,
    enabled: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 12 3 3 5-6"/><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>`,
    timers: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v5l3 2"/><path d="M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"/><path d="M9 2h6"/></svg>`,
    failed: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 9 6 6m0-6-6 6"/><path d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z"/></svg>`,
    trigger: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="M8 8h8v8H8z"/></svg>`,
    template: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>`,
    step: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>`,
    output: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19h14"/><path d="M12 5v10"/><path d="m8 11 4 4 4-4"/></svg>`,
  };
  return icons[name] || icons.step;
}

function formatTemplateName(templateId, templates) {
  const template = templates.find((item) => item.id === templateId);
  return template ? template.name : templateId;
}

function workflowTrigger(workflow) {
  return workflow.triggers && workflow.triggers.length > 0 ? workflow.triggers[0] : null;
}

function isScheduledWorkflow(workflow) {
  return workflowTrigger(workflow)?.type === "schedule";
}

function describeTrigger(workflow) {
  const trigger = workflowTrigger(workflow);
  if (!trigger || trigger.type === "manual") return "Manual";
  if (trigger.type === "schedule" && trigger.schedule?.kind === "daily") return `Daily at ${trigger.schedule.value}`;
  if (trigger.type === "schedule" && trigger.schedule?.kind === "interval_minutes") return `Every ${trigger.schedule.value} min`;
  if (trigger.type === "event" && trigger.event_type) return trigger.event_type.replaceAll(".", " / ");
  return "Unknown trigger";
}

function describeWorkflowSteps(workflow) {
  if (workflow.template_id === "thread_prompt_chain") {
    const steps = Array.isArray(workflow.parameters?.steps) ? workflow.parameters.steps : [];
    return steps.map((step) => String(step.label || "step")).filter((item) => item);
  }
  if (workflow.template_id === "scheduled_benchmark") {
    const models = Array.isArray(workflow.parameters?.models) ? workflow.parameters.models : [];
    return ["benchmark", models.length > 0 ? `${models.length} models` : "models"];
  }
  return ["run"];
}

function workflowLastRun(workflow, runs) {
  return runs.find((run) => run.workflow_id === workflow.id) || null;
}

function renderSummary(root, workflows, runs) {
  const summary = root.querySelector("[data-workflow-summary]");
  if (!summary) return;
  const enabledCount = workflows.filter((item) => item.enabled).length;
  const timerCount = workflows.filter(isScheduledWorkflow).length;
  const failedCount = runs.filter((item) => item.status === "failed").length;
  summary.innerHTML = `
    <div class="total"><span class="workflow-summary-icon">${workflowIcon("total")}</span><span>Total</span><strong>${workflows.length}</strong></div>
    <div class="enabled"><span class="workflow-summary-icon">${workflowIcon("enabled")}</span><span>Enabled</span><strong>${enabledCount}</strong></div>
    <div class="timers"><span class="workflow-summary-icon">${workflowIcon("timers")}</span><span>Timers</span><strong>${timerCount}</strong></div>
    <div class="failed"><span class="workflow-summary-icon">${workflowIcon("failed")}</span><span>Failed runs</span><strong>${failedCount}</strong></div>
  `;
}

function renderDiagram(root, workflow, templates) {
  const diagram = root.querySelector("[data-workflow-diagram]");
  const title = root.querySelector("[data-workflow-diagram-title]");
  const subtitle = root.querySelector("[data-workflow-diagram-subtitle]");
  if (!diagram || !title || !subtitle) return;
  if (!workflow) {
    title.textContent = "Workflow Diagram";
    subtitle.textContent = "Select a workflow to inspect its trigger, template, and steps.";
    diagram.innerHTML = `<div class="workflow-empty">No workflow selected.</div>`;
    return;
  }
  title.textContent = workflow.name;
  subtitle.textContent = workflow.description || "No description provided.";
  const stepNodes = describeWorkflowSteps(workflow).map((step, index) => `
    <div class="workflow-diagram-node step">
      <span class="workflow-diagram-icon">${workflowIcon("step")}</span>
      <span>Step ${index + 1}</span>
      <strong>${escapeHtml(step)}</strong>
    </div>
  `).join("");
  diagram.innerHTML = `
    <div class="workflow-diagram-node trigger">
      <span class="workflow-diagram-icon">${workflowIcon("trigger")}</span>
      <span>Trigger</span>
      <strong>${escapeHtml(describeTrigger(workflow))}</strong>
    </div>
    <div class="workflow-diagram-node template">
      <span class="workflow-diagram-icon">${workflowIcon("template")}</span>
      <span>Template</span>
      <strong>${escapeHtml(formatTemplateName(workflow.template_id, templates))}</strong>
    </div>
    ${stepNodes}
    <div class="workflow-diagram-node output">
      <span class="workflow-diagram-icon">${workflowIcon("output")}</span>
      <span>Output</span>
      <strong>Run record</strong>
    </div>
  `;
}

function formatOptionalValue(value) {
  return value ? escapeHtml(value) : "None";
}

function renderRunDetail(root, detail) {
  const panel = root.querySelector("[data-workflow-run-detail]");
  const body = root.querySelector("[data-workflow-run-detail-body]");
  if (!panel || !body) return;
  const run = detail.run;
  const steps = Array.isArray(detail.steps) ? detail.steps : [];
  const failedStep = steps.find((step) => step.status === "failed") || null;
  const stepRows = steps.map((step) => `
    <div class="workflow-run-step ${escapeHtml(step.status)}">
      <div>
        <strong>${escapeHtml(step.label)}</strong>
        <span>${escapeHtml(step.status)}</span>
      </div>
      <dl>
        <div><dt>Created</dt><dd>${formatOptionalValue(step.created_at)}</dd></div>
        <div><dt>Thread ID</dt><dd>${formatOptionalValue(step.linked_thread_id)}</dd></div>
        <div><dt>Job ID</dt><dd>${formatOptionalValue(step.linked_job_id)}</dd></div>
      </dl>
      ${step.error_detail ? `<pre>${escapeHtml(step.error_detail)}</pre>` : ""}
    </div>
  `).join("");
  panel.hidden = false;
  body.innerHTML = `
    <div class="workflow-run-detail-grid">
      <div><span>Status</span><strong>${escapeHtml(run.status)}</strong></div>
      <div><span>Created</span><strong>${formatOptionalValue(run.created_at)}</strong></div>
      <div><span>Started</span><strong>${formatOptionalValue(run.started_at)}</strong></div>
      <div><span>Finished</span><strong>${formatOptionalValue(run.finished_at)}</strong></div>
      <div><span>Correlation ID</span><strong>${formatOptionalValue(run.correlation_id)}</strong></div>
    </div>
    ${run.error_detail ? `<section class="workflow-run-error"><strong>Error detail</strong><pre>${escapeHtml(run.error_detail)}</pre></section>` : ""}
    ${failedStep ? `<section class="workflow-run-failed-step"><strong>Failed step</strong><span>${escapeHtml(failedStep.label)}</span></section>` : ""}
    <section class="workflow-run-steps">
      <strong>Steps</strong>
      ${stepRows || `<div class="workflow-empty">No persisted steps for this run.</div>`}
    </section>
  `;
}

async function inspectRun(root, host, runId) {
  setStatus(root, "Loading run details...");
  const detail = await host.apiGet(`/runs/${encodeURIComponent(runId)}`);
  renderRunDetail(root, detail);
  setStatus(root, "Run details loaded");
}

function setActiveWorkflow(root, workflowId) {
  root.selectedWorkflowId = workflowId;
  const workflow = (root.workflowDefinitions || []).find((item) => item.id === workflowId) || null;
  renderDiagram(root, workflow, root.workflowTemplates || []);
  const rows = root.querySelectorAll("[data-workflow-row-id]");
  for (const row of rows) {
    row.classList.toggle("active", row.dataset.workflowRowId === workflowId);
  }
}

function setStatus(root, message) {
  const status = root.querySelector("[data-workflow-status]");
  if (status) status.textContent = message;
}

function defaultRouteOptions() {
  return {
    models: [{ value: "auto", label: "Auto" }],
    targets: [{ value: "auto", label: "Auto" }],
  };
}

function normalizeRouteOptions(payload) {
  const defaults = defaultRouteOptions();
  const models = Array.isArray(payload?.models) ? payload.models : [];
  const targets = Array.isArray(payload?.targets) ? payload.targets : [];
  return {
    models: normalizeRouteOptionList(models, defaults.models),
    targets: normalizeRouteOptionList(targets, defaults.targets),
  };
}

function normalizeRouteOptionList(items, defaults) {
  const options = new Map();
  for (const item of defaults) {
    options.set(item.value, item.label);
  }
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const value = String(item.value || "").trim();
    const label = String(item.label || value).trim();
    if (value) options.set(value, label || value);
  }
  return Array.from(options.entries()).map(([value, label]) => ({ value, label }));
}

function ensureRouteOption(options, value, label) {
  const normalizedValue = String(value || "").trim() || "auto";
  if (options.some((item) => item.value === normalizedValue)) return options;
  return [...options, { value: normalizedValue, label: `${label}: ${normalizedValue}` }];
}

function populateSelect(select, options, selectedValue) {
  if (!select) return;
  select.innerHTML = "";
  for (const option of options) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    select.appendChild(element);
  }
  select.value = selectedValue;
}

function syncRouteSelects(root, modelValue, targetValue) {
  const routeOptions = root.workflowRouteOptions || defaultRouteOptions();
  const modelSelect = root.querySelector("[data-workflow-model-select]");
  const targetSelect = root.querySelector("[data-workflow-target-select]");
  const modelOptions = ensureRouteOption(routeOptions.models, modelValue, "Saved model");
  const targetOptions = ensureRouteOption(routeOptions.targets, targetValue, "Saved target");
  populateSelect(modelSelect, modelOptions, String(modelValue || "auto"));
  populateSelect(targetSelect, targetOptions, String(targetValue || "auto"));
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
    syncRouteSelects(root, String(parameters.model || "auto"), String(parameters.target || "auto"));
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
  setActiveWorkflow(root, workflow.id);
}

async function refreshWorkflows(root, host) {
  const [templates, workflows, runs, routeOptions] = await Promise.all([
    host.apiGet("/templates"),
    host.apiGet("/workflows"),
    host.apiGet("/runs"),
    host.apiGet("/route-options").catch((error) => {
      setStatus(root, `Route options unavailable: ${error.message}`);
      return defaultRouteOptions();
    }),
  ]);
  root.workflowRouteOptions = normalizeRouteOptions(routeOptions);
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
  if (form) {
    syncRouteSelects(root, form.elements.model?.value || "auto", form.elements.target?.value || "auto");
  }
  if (form && !form.elements.workflow_id.value && !form.elements.content.value && !form.elements.benchmark_id.value) {
    setParameterFields(root, selectedTemplate, defaultParameters(selectedTemplate));
  }
  root.workflowDefinitions = workflows.workflows;
  root.workflowTemplates = templates.templates;
  root.workflowRuns = runs.runs;
  renderSummary(root, workflows.workflows, runs.runs);
  renderList(root, "workflow-definitions", workflows.workflows, (item) => {
    const lastRun = workflowLastRun(item, runs.runs);
    const statusClass = item.enabled ? "enabled" : "disabled";
    return `
    <div class="workflow-row-main">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${escapeHtml(formatTemplateName(item.template_id, templates.templates))}</span>
      <span>${escapeHtml(describeTrigger(item))}</span>
    </div>
    <div class="workflow-row-meta">
      <span class="workflow-chip ${statusClass}">${escapeHtml(item.enabled ? "Enabled" : "Disabled")}</span>
      <span>${escapeHtml(lastRun ? lastRun.status : "No runs")}</span>
    </div>
    <div class="workflow-row-actions">
      <button type="button" data-workflow-action="inspect" data-workflow-id="${escapeHtml(item.id)}">Inspect</button>
      <button type="button" data-workflow-action="edit" data-workflow-id="${escapeHtml(item.id)}">Edit</button>
      <button type="button" data-workflow-action="run" data-workflow-id="${escapeHtml(item.id)}">Run</button>
      <button type="button" data-workflow-action="${item.enabled ? "disable" : "enable"}" data-workflow-id="${escapeHtml(item.id)}">${item.enabled ? "Disable" : "Enable"}</button>
    </div>
  `;
  }, "No workflows yet. Create one with the form on the left.");
  const scheduledWorkflows = workflows.workflows.filter(isScheduledWorkflow);
  renderList(root, "workflow-timers", scheduledWorkflows, (item) => {
    const lastRun = workflowLastRun(item, runs.runs);
    return `
    <div class="workflow-row-main">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${escapeHtml(describeTrigger(item))}</span>
      <span>${escapeHtml(formatTemplateName(item.template_id, templates.templates))}</span>
    </div>
    <div class="workflow-row-meta">
      <span class="workflow-chip ${item.enabled ? "enabled" : "disabled"}">${escapeHtml(item.enabled ? "Enabled" : "Disabled")}</span>
      <span>${escapeHtml(lastRun ? `Last: ${lastRun.status}` : "No timer runs")}</span>
    </div>
    <div class="workflow-row-actions">
      <button type="button" data-workflow-action="inspect" data-workflow-id="${escapeHtml(item.id)}">Inspect</button>
      <button type="button" data-workflow-action="edit" data-workflow-id="${escapeHtml(item.id)}">Edit</button>
      <button type="button" data-workflow-action="${item.enabled ? "disable" : "enable"}" data-workflow-id="${escapeHtml(item.id)}">${item.enabled ? "Disable" : "Enable"}</button>
    </div>
  `;
  }, "No scheduled workflows yet. Create a workflow with a daily or interval trigger.");
  renderList(root, "workflow-runs", runs.runs, (item) => `
    <div class="workflow-row-main">
      <strong>${escapeHtml(item.status)}</strong>
      <span>${escapeHtml(item.trigger_type)}: ${escapeHtml(item.trigger_detail)}</span>
    </div>
    <span>${escapeHtml(item.created_at || "")}</span>
    <div class="workflow-row-actions">
      <button type="button" data-workflow-action="inspect-run" data-workflow-run-id="${escapeHtml(item.id)}">Inspect</button>
    </div>
  `, "No workflow runs yet.");
  renderList(root, "workflow-timer-runs", runs.runs.filter((item) => item.trigger_type === "schedule"), (item) => `
    <div class="workflow-row-main">
      <strong>${escapeHtml(item.status)}</strong>
      <span>${escapeHtml(item.trigger_detail)}</span>
    </div>
    <span>${escapeHtml(item.created_at || "")}</span>
    <div class="workflow-row-actions">
      <button type="button" data-workflow-action="inspect-run" data-workflow-run-id="${escapeHtml(item.id)}">Inspect</button>
    </div>
  `, "No scheduled runs yet.");
  const selectedWorkflow = workflows.workflows.find((item) => item.id === root.selectedWorkflowId) || workflows.workflows[0] || null;
  renderDiagram(root, selectedWorkflow, templates.templates);
  if (selectedWorkflow) setActiveWorkflow(root, selectedWorkflow.id);
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
    if (!SUPPORTED_EVENT_TRIGGERS.has(eventType)) {
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
  if (action === "inspect") {
    setActiveWorkflow(root, workflowId);
    return;
  }
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

async function handleRunAction(root, host, action, runId) {
  if (action !== "inspect-run") return;
  await inspectRun(root, host, runId);
}

export function mountPage(root, host) {
  const refreshButton = root.querySelector("[data-workflow-action='refresh']");
  const newButton = root.querySelector("[data-workflow-action='new']");
  const cancelButton = root.querySelector("[data-workflow-action='cancel-edit']");
  const form = root.querySelector("[data-workflow-form='create']");
  const workflowLists = root.querySelectorAll("#workflow-definitions, #workflow-timers");
  const runLists = root.querySelectorAll("#workflow-runs, #workflow-timer-runs");
  const templateSelect = root.querySelector("[data-workflow-template-select]");
  const triggerType = root.querySelector("[data-workflow-trigger-type]");
  const tabButtons = root.querySelectorAll("[data-workflow-tab]");
  const refresh = () => {
    refreshWorkflows(root, host).catch((error) => {
      setStatus(root, error.message);
      console.error(error);
    });
  };
  const setActiveTab = (tabName) => {
    for (const button of tabButtons) {
      const active = button.dataset.workflowTab === tabName;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    }
    for (const panel of root.querySelectorAll("[data-workflow-panel]")) {
      panel.classList.toggle("active", panel.dataset.workflowPanel === tabName);
    }
  };
  const tabClicked = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const tabName = target.dataset.workflowTab;
    if (tabName) setActiveTab(tabName);
  };
  const submit = (event) => {
    event.preventDefault();
    if (!form) return;
    setStatus(root, form.elements.workflow_id.value ? "Saving..." : "Creating...");
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
  const newWorkflow = () => {
    if (!form) return;
    resetForm(root, form);
    setActiveTab("workflows");
    form.querySelector("[name='name']")?.focus();
  };
  const workflowAction = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.dataset.workflowAction;
    const workflowId = target.dataset.workflowId;
    if (!action || !workflowId) return;
    if (action === "inspect" || action === "edit") setActiveTab("workflows");
    handleWorkflowAction(root, host, action, workflowId).catch((error) => {
      setStatus(root, error.message);
      console.error(error);
    });
  };
  const runAction = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.dataset.workflowAction;
    const runId = target.dataset.workflowRunId;
    if (!action || !runId) return;
    handleRunAction(root, host, action, runId).catch((error) => {
      setStatus(root, error.message);
      console.error(error);
    });
  };
  refreshButton?.addEventListener("click", refresh);
  newButton?.addEventListener("click", newWorkflow);
  cancelButton?.addEventListener("click", cancelEdit);
  for (const list of workflowLists) list.addEventListener("click", workflowAction);
  for (const list of runLists) list.addEventListener("click", runAction);
  for (const button of tabButtons) button.addEventListener("click", tabClicked);
  form?.addEventListener("click", formAction);
  form?.addEventListener("submit", submit);
  templateSelect?.addEventListener("change", templateChanged);
  triggerType?.addEventListener("change", triggerChanged);
  syncTriggerFields(root);
  refresh();

  return () => {
    refreshButton?.removeEventListener("click", refresh);
    newButton?.removeEventListener("click", newWorkflow);
    cancelButton?.removeEventListener("click", cancelEdit);
    for (const list of workflowLists) list.removeEventListener("click", workflowAction);
    for (const list of runLists) list.removeEventListener("click", runAction);
    for (const button of tabButtons) button.removeEventListener("click", tabClicked);
    form?.removeEventListener("click", formAction);
    form?.removeEventListener("submit", submit);
    templateSelect?.removeEventListener("change", templateChanged);
    triggerType?.removeEventListener("change", triggerChanged);
  };
}
