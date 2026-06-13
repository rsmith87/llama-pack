import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { buildModelNavigatorLines, type ModelLineOverride, type ModelNavigatorRecord } from "../../features/models/modelNavigator";
import { ModelNavigator } from "./index";

const records: ModelNavigatorRecord[] = [
  { id: "qwen-q4", filename: "Qwen3-Coder-30B-A3B-Instruct-Q4_K_M.gguf", registered: true, size_bytes: 1024 ** 3 },
  { id: "qwen-q5", filename: "Qwen3-Coder-30B-A3B-Instruct-Q5_K_M.gguf", size_bytes: 2 * 1024 ** 3 },
  { id: "custom-q4", filename: "custom-local-model-Q4_K_M.gguf" },
];

it("selects lines, models, and quants without hiding neighboring context", async () => {
  const user = userEvent.setup();
  const onQuantSelect = vi.fn();
  render(
    <ModelNavigator
      lines={buildModelNavigatorLines(records)}
      selectedQuantId="qwen-q4"
      onSelectQuant={onQuantSelect}
      renderDetail={({ selectedModel, selectedQuant }) => (
        <div>
          <h3>{selectedModel?.label}</h3>
          <p>{selectedQuant?.label}</p>
        </div>
      )}
    />,
  );

  expect(screen.getByRole("button", { name: /Qwen3/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Other/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Coder 30B A3B Instruct/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Q4_K_M/ })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /Q5_K_M/ }));
  expect(onQuantSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "qwen-q5" }));
});

it("searches model lines and models separately", async () => {
  const user = userEvent.setup();
  render(<ModelNavigator lines={buildModelNavigatorLines(records)} />);

  await user.type(screen.getByLabelText("Search model lines"), "Other");
  expect(screen.queryByRole("button", { name: /Qwen3/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Other/ })).toBeInTheDocument();

  await user.clear(screen.getByLabelText("Search model lines"));
  await user.type(screen.getByLabelText("Search models in Qwen3"), "coder");
  expect(screen.getByRole("button", { name: /Coder 30B A3B Instruct/ })).toBeInTheDocument();
});

it("submits reclassification for Other records", async () => {
  const user = userEvent.setup();
  const onReclassify = vi.fn();
  render(<ModelNavigator lines={buildModelNavigatorLines(records)} onReclassify={onReclassify} />);

  await user.click(screen.getByRole("button", { name: /Other/ }));
  await user.click(screen.getByRole("button", { name: /custom local model/ }));
  const detail = screen.getByLabelText("Selected model details");
  await user.type(within(detail).getByLabelText("New model line"), "Custom Local");
  await user.click(within(detail).getByRole("button", { name: "Reclassify" }));

  expect(onReclassify).toHaveBeenCalledWith({ recordId: "custom-q4", lineLabel: "Custom Local" } satisfies ModelLineOverride);
});
