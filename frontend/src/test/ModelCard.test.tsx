import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ModelCard } from "../components/ModelCard";
import { modelActionTargetLabel, modelPlacementDetails } from "../features/models";

it("highlights stale startup failure cards and their logs action", () => {
  render(
    <ModelCard
      model={{
        name: "qwen-local",
        status: "stopped",
        process_state: "stale",
      }}
      onLogs={() => undefined}
    />,
  );

  const logsButton = screen.getByRole("button", { name: "View startup problem logs for qwen-local" });
  expect(logsButton).toHaveClass("model-logs-problem");
  expect(logsButton.closest(".library-card")).toHaveClass("problem");
});

it("expands model profile details from the card", async () => {
  const user = userEvent.setup();

  render(
    <ModelCard
      model={{
        name: "qwen-local",
        status: "available",
        model_profiles: [
          {
            profile_key: "default",
            label: "Default",
            kind: "base",
            ctx: 32768,
            gpu_layers: 48,
            resource_tier: "balanced",
            kv_cache_policy: "q8_0",
            cost_tier: "medium",
            strengths: ["coding", "tool-use"],
            extra_args: ["--flash-attn"],
          },
          {
            profile_key: "long",
            label: "Long Context",
            ctx: 65536,
          },
        ],
      }}
    />,
  );

  expect(screen.queryByText("Long Context")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Show profiles for qwen-local" }));

  const panel = screen.getByRole("region", { name: "Profiles for qwen-local" });
  expect(within(panel).getByText("Default")).toBeInTheDocument();
  expect(within(panel).getByText("Long Context")).toBeInTheDocument();
  expect(within(panel).getByText(/ctx 32,768/)).toBeInTheDocument();
  expect(within(panel).getByText(/48 GPU layers/)).toBeInTheDocument();
  expect(within(panel).getByText("balanced")).toBeInTheDocument();
  expect(within(panel).getByText("q8_0")).toBeInTheDocument();
  expect(within(panel).getByText("coding, tool-use")).toBeInTheDocument();
  expect(within(panel).getByText("--flash-attn")).toBeInTheDocument();
});

describe("model action targets", () => {
  it("labels local runtime actions", () => {
    expect(modelActionTargetLabel({ resolvedNode: "", hasControllerAction: false, reachable: true })).toBe("Actions run on local runtime.");
  });

  it("labels controller-mediated agent actions", () => {
    expect(modelActionTargetLabel({ resolvedNode: "linux-2080ti", hasControllerAction: true, reachable: true })).toBe("Actions run on agent linux-2080ti through the controller.");
  });

  it("labels offline agent actions as unavailable", () => {
    expect(modelActionTargetLabel({ resolvedNode: "linux-2080ti", hasControllerAction: true, reachable: false })).toBe("Actions unavailable until agent linux-2080ti is reachable.");
  });

  it("shows action target text on model cards", () => {
    render(
      <ModelCard
        model={{ name: "qwen-local", status: "running" }}
        resolvedNode="linux-2080ti"
        actionTargetLabel="Actions run on agent linux-2080ti through the controller."
        onStart={() => undefined}
      />,
    );

    expect(screen.getByText("Actions run on agent linux-2080ti through the controller.")).toBeInTheDocument();
  });
});

describe("model placement details", () => {
  it("describes configured GGUF deployments and running process placement", () => {
    expect(
      modelPlacementDetails({
        registered: true,
        registered_as: "qwen3",
        file_id: "file-123",
        path: "/models/qwen3/model.gguf",
        status: "running",
        port: 8081,
        pid: 12345,
        model_deployments: [
          { node_name: "linux-2080ti", host: "10.0.0.8", port: 8081, profile_key: "default", enabled: true },
        ],
      }),
    ).toEqual([
      "Configured as qwen3.",
      "GGUF file present: file-123.",
      "Deployment linux-2080ti 10.0.0.8:8081 (default).",
      "Running process on port 8081, pid 12345.",
    ]);
  });

  it("describes discovered files without deployments or running processes", () => {
    expect(
      modelPlacementDetails({
        registered: false,
        path: "/models/custom/model.gguf",
        status: "discovered",
      }),
    ).toEqual([
      "Not configured as a runnable model.",
      "GGUF file present.",
      "No deployment registered.",
      "No running process reported.",
    ]);
  });

  it("shows placement detail text on model cards", () => {
    render(
      <ModelCard
        model={{
          name: "qwen-local",
          status: "running",
          registered: true,
          registered_as: "qwen3",
          file_id: "file-123",
          model_deployments: [{ host: "127.0.0.1", port: 8081, enabled: true }],
          port: 8081,
        }}
      />,
    );

    expect(screen.getByText("127.0.0.1:8081")).toBeInTheDocument();
  });
});
