import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { ModelCard } from "../components/ModelCard";

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
