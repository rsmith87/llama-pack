# Model Navigator Design

## Goal

Replace carousel-first GGUF browsing with a reusable drilldown navigator that makes downloaded models easy to scan, compare, select, and act on.

The main pain point is memory and orientation: when many GGUF files are shown in a carousel, it is hard to remember what models have already appeared by the time the user reaches the end. The new navigator should keep the full model inventory visible through stable grouping and selection state.

## Recommended Approach

Build a reusable `ModelNavigator` frontend component backed by pure grouping helpers.

The component presents inventory in three panes:

1. Model lines in a left rail, such as `Qwen3`, `Qwen2.5`, `Llama 3.3`, `DeepSeek R1`, and `Mistral Small 3.1`.
2. Models for the selected line in the middle pane, with repeated line prefixes removed from display names where safe.
3. Quants, details, and page-specific actions in the right pane.

The first integration target is the GGUF Library page. The Quantization page should be able to reuse the same component later with quantization-specific actions.

## Data Model

The grouping helper should transform flat GGUF-like records into this shape:

```ts
type ModelNavigatorLine = {
  id: string;
  label: string;
  models: ModelNavigatorModel[];
};

type ModelNavigatorModel = {
  id: string;
  label: string;
  sourceLabel: string;
  quants: ModelNavigatorQuant[];
  registeredCount: number;
  totalSizeGb: number;
};

type ModelNavigatorQuant = {
  id: string;
  label: string;
  file: GgufFile | QuantizationFile;
  quantType: string | null;
  status: "running" | "configured" | "available" | "file-only" | "unknown";
};
```

Exact names can change during implementation, but the boundary should stay clear: grouping logic is pure and UI rendering is separate.

## Grouping Rules

Model lines should be specific generations or release lines, not broad vendors.

Use the strongest available source in this order:

1. Repository ID or model metadata, if present.
2. Model directory or immediate parent folder.
3. Registered model name.
4. Filename.

Parsing should identify stable line tokens such as:

- `Qwen3`
- `Qwen2.5`
- `Llama 3.3`
- `Llama 3.1`
- `DeepSeek R1`
- `Mistral Small 3.1`
- `Gemma 3`
- `Phi 4`

Quant suffixes, GGUF suffixes, and noise tokens should be stripped when forming model labels. For example:

`Qwen3-Coder-30B-A3B-Instruct-Q4_K_M.gguf`

Should group as:

- Line: `Qwen3`
- Model: `Coder 30B A3B Instruct`
- Quant: `Q4_K_M`

If the parser cannot confidently identify a line, place the record under `Other`.

## Manual Reclassification

The UI should allow records in `Other` to be reclassified by the user.

Initial behavior:

- Show a `Reclassify` action for models or quants in `Other`.
- Let the user pick an existing line or type a new line label.
- Apply the override in the current frontend grouping state.

Persisted behavior can be added once the UI proves useful:

- Store overrides in a small frontend-local preference store first, or add backend metadata if model grouping needs to be shared across browsers and machines.
- Override keys should use stable file IDs or repository/folder identity when available, falling back to normalized path.
- Overrides should affect grouping only. They should not rename files, change configured model names, or mutate runtime model settings.

## Component Contract

`ModelNavigator` should be reusable by accepting:

- A list of flat records.
- A grouping adapter or pre-grouped line data.
- Current selection state and selection callbacks.
- Optional filters such as `all`, `configured`, `running`, and `available`.
- Render slots or action callbacks for the detail pane.

GGUF Library can provide actions such as:

- Add model
- Edit model
- Remove model
- Delete GGUF
- Transfer
- Open chat

Quantization can later provide:

- Select quant type
- Start quantization
- Show output path
- Show quantization status

## UI Behavior

The navigator should preserve orientation:

- Selecting a line updates the model pane without hiding the line list.
- Selecting a model updates the quant/detail pane without losing the model list.
- Searches should be scoped and predictable: line search in the left rail, model search in the middle pane.
- Empty states should distinguish between no inventory, no models in a line, and search filters hiding all results.
- The layout should use existing app tokens and strong text contrast in light mode.

On smaller screens, the component can collapse into a stacked layout:

1. Line selector
2. Model list
3. Quant/detail panel

The component should avoid modal-only browsing. Modals can still be used for editing model settings and transfer setup.

## Error Handling

Malformed or incomplete records should not break the navigator.

- Missing names fall back to file IDs or paths.
- Missing quant types display as `Unknown`.
- Ambiguous line parsing falls back to `Other`.
- Manual overrides should be validated as non-empty display labels.

## Testing

Add focused tests for the pure grouping helper:

- Quant suffix stripping.
- Specific generation extraction.
- Ambiguous records falling into `Other`.
- Manual override application.
- Stable sorting of lines, models, and quants.

Add component tests for:

- Selecting a line, model, and quant.
- Searching lines and models.
- Rendering `Other` with reclassification controls.
- Invoking page-specific action callbacks.

For final UI verification, run the frontend test suite and inspect the page in the browser at desktop and mobile widths.

## Out Of Scope

This design does not require a backend migration for the first version.

It also does not require changing GGUF file locations, renaming files, changing configured model names, or replacing the existing model cards everywhere in the app.
