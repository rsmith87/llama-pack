# Workflows Plugin

`llama_pack_workflows` is an optional controller-mode plugin for scheduled and
event-triggered workflows over Llama Pack resources.

Enable it with:

```yaml
enabled_plugins:
  - llama_pack_workflows

plugins:
  llama_pack_workflows:
    path: ./plugins/llama_pack_workflows
    enabled: true
```

The first version supports:

- built-in workflow templates
- manual workflow runs
- simple daily UTC and interval-minute schedules
- chat completion event triggers
- run history with step records
- a plugin UI page under `/ui/plugins/llama_pack_workflows`

This plugin is intentionally not a general-purpose SaaS automation platform.
It should automate Llama Pack resources and local AI tasks. Broad connectors,
approval flows, arbitrary user code, and external business process automation
belong in a separate app that calls Llama Pack through its API.

## Built-In Templates

`thread_prompt_chain` runs a multi-step prompt chain through the existing
thread workflow service. Required parameters:

- `content`
- `steps`
- `model`
- `target`

`scheduled_benchmark` is available as an operator template definition. Execution
adapters for benchmark-specific runs can be added as a later focused workflow
action.

## Plugin Data

Workflow definitions, triggers, runs, and run steps are stored in the plugin
database under the runtime `log_dir`:

```text
logs/plugins/llama_pack_workflows/state/llama_pack_workflows.db
```

Core continues to own durable jobs, threads, chat routing, nodes, and plugin
lifecycle. The workflows plugin owns workflow templates, schedules, event
matching, run history, and plugin UI.
