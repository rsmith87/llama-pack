import { describe, expect, it } from "vitest";
import { PROMPT_TEMPLATE_OPTIONS } from "../../constants";
import {
  filterNodes,
  mergeNodeInventory,
  nodeSummary,
  nodeEditFormDefaults,
  nodeEditMarkup,
  nodeVisibilityDetails,
  receivedBadgeText,
  sortModelsForDisplay,
  suggestedGgufModelName,
  suggestedPromptTemplate,
  transferDestinationOptions,
} from "../../features/nodes/nodesView";

const nodes = [
  {
    name: "mac-agent",
    url: "http://mac:9000",
    reachable: true,
    registration: "static",
    agent_config_source: "/etc/mac.yaml",
    models: [{ name: "qwen" }, { name: "gemma" }],
  },
  {
    name: "win-agent",
    url: "http://win:9000",
    reachable: false,
    registration: "dynamic",
    controller_config_source: "controller.yaml",
    models: [],
  },
];

describe("nodes view helpers", () => {
  it("filters nodes by text, status, and registration", () => {
    expect(filterNodes(nodes, { query: "mac", status: "reachable", registration: "static" })).toEqual([nodes[0]]);
    expect(filterNodes(nodes, { status: "offline" })).toEqual([nodes[1]]);
    expect(filterNodes(nodes, { query: "controller" })).toEqual([nodes[1]]);
  });

  it("summarizes reachable nodes and model count", () => {
    expect(nodeSummary(nodes)).toEqual({ reachable: 1, total: 2, models: 2 });
  });

  it("explains reachable node visibility with heartbeat, TLS, model source, and action target", () => {
    expect(
      nodeVisibilityDetails({
        name: "mac-agent",
        reachable: true,
        heartbeat_fresh: true,
        heartbeat_age_seconds: 42,
        cert_expires_in_seconds: 60 * 60 * 24 * 12,
        models: [{ name: "qwen" }],
        models_source: "agent",
      }),
    ).toEqual({
      reachability: "Controller can reach this agent.",
      heartbeat: "Heartbeat fresh, 42s old.",
      cert: "TLS certificate valid for 12d.",
      placement: "1 model reported by agent.",
      actionTarget: "Actions run on mac-agent through the controller.",
      error: "",
    });
  });

  it("explains offline node visibility with stale heartbeat and explicit error", () => {
    expect(
      nodeVisibilityDetails({
        name: "win-agent",
        reachable: false,
        heartbeat_fresh: false,
        heartbeat_age_seconds: 3700,
        cert_expires_in_seconds: -10,
        models: [],
        error: "ConnectError: refused",
      }),
    ).toEqual({
      reachability: "Controller cannot reach this agent.",
      heartbeat: "Heartbeat stale, 62m old.",
      cert: "TLS certificate expired.",
      placement: "No models reported.",
      actionTarget: "Actions are unavailable until win-agent is reachable.",
      error: "ConnectError: refused",
    });
  });

  it("merges configured inventory with aggregate model status", () => {
    expect(
      mergeNodeInventory(
        [
          {
            name: "win-agent",
            url: "http://win:9000",
            registration: "static",
          },
          {
            name: "mac-agent",
            url: "http://mac:9000",
            registration: "dynamic",
          },
        ],
        [
          {
            name: "win-agent",
            reachable: true,
            models: [{ name: "qwen" }],
            models_source: "worker",
          },
        ],
      ),
    ).toEqual([
      {
        name: "mac-agent",
        url: "http://mac:9000",
        registration: "dynamic",
        reachable: false,
        models: [],
      },
      {
        name: "win-agent",
        url: "http://win:9000",
        registration: "static",
        reachable: true,
        models: [{ name: "qwen" }],
        models_source: "worker",
      },
    ]);
  });

  it("defaults GGUF model names from the file stem before the directory", () => {
    expect(
      suggestedGgufModelName({
        name: "qwen3-q4-k-m",
        model_dir: "qwen3",
      }),
    ).toBe("qwen3-q4-k-m");
    expect(suggestedGgufModelName({ model_dir: "qwen3" })).toBe("qwen3");
  });

  it("infers GGUF prompt templates from model names", () => {
    expect(suggestedPromptTemplate({ name: "Meta-Llama-3.1-8B-Instruct" })).toBe("llama3");
    expect(suggestedPromptTemplate({ model_dir: "gemma-3-4b-it" })).toBe("gemma");
    expect(suggestedPromptTemplate({ filename: "gpt-oss-20b-Q4_K_M.gguf" })).toBe("gpt-oss");
    expect(suggestedPromptTemplate({ name: "Qwen2.5-Coder-Instruct" })).toBe("qwen");
    expect(suggestedPromptTemplate({ name: "mistral-7b" })).toBe("");
  });

  it("lists the backend default prompt template aliases for GGUF imports", () => {
    expect(PROMPT_TEMPLATE_OPTIONS.map((option) => option.value)).toEqual([
      "",
      "llama3",
      "llama-3",
      "chatml",
      "qwen",
      "gemma",
      "gpt-oss",
      "gptoss",
    ]);
  });

  it("sorts favorite models first, then by name", () => {
    expect(
      sortModelsForDisplay([
        { name: "qwen", favorite: false },
        { name: "mistral", favorite: true },
        { name: "gemma", favorite: true },
      ]).map((model) => model.name),
    ).toEqual(["gemma", "mistral", "qwen"]);
  });

  it("builds node edit defaults and only shows edit actions for full cards", () => {
    expect(nodeEditFormDefaults({ name: "win", url: "http://win:9000", verify_tls: false })).toEqual({
      name: "win",
      url: "http://win:9000",
      api_key: "",
      verify_tls: false,
    });
    expect(nodeEditFormDefaults({ name: "mac", url: "http://mac:9000" }).verify_tls).toBe(true);
    expect(nodeEditMarkup(nodes[0], { compact: false })).toContain('data-edit-node="mac-agent"');
    expect(nodeEditMarkup(nodes[0], { compact: false })).toContain("Edit Node");
    expect(nodeEditMarkup(nodes[0], { compact: true })).toBe("");
  });

  it("filters transfer destinations to reachable nodes excluding source", () => {
    const options = transferDestinationOptions(
      [
        { name: "source", reachable: true },
        { name: "dest", reachable: true },
        { name: "offline", reachable: false },
      ],
      "source",
    );

    expect(options).toEqual([{ name: "dest", reachable: true }]);
  });

  it("builds received badge text for transferred files", () => {
    expect(receivedBadgeText({ recently_received: true, received_from_node: "source" })).toBe("Received from source");
    expect(receivedBadgeText({ recently_received: false })).toBe("");
  });
});
