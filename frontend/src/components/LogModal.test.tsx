import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { LogModal } from "./LogModal";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function streamFrom(text: string) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

function okJson(payload: unknown) {
  return { ok: true, json: async () => payload };
}

it("streams chunk events into the log output", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: streamFrom('event: chunk\ndata: {"text":"line one\\n"}\n\nevent: chunk\ndata: {"text":"line two"}\n\n') }));
  const user = userEvent.setup();

  render(<LogModal open onClose={vi.fn()} />);
  await user.type(screen.getByLabelText("Identifier"), "qwen");
  await user.click(screen.getByRole("button", { name: "Load Logs" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/logs/qwen/stream?lines=200", expect.objectContaining({ method: "GET" })));
  expect((await screen.findByText(/line one/)).textContent).toBe("line one\nline two");
});

it("keeps streamed log output pinned to the bottom", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: streamFrom('event: chunk\ndata: {"text":"line one\\n"}\n\nevent: chunk\ndata: {"text":"line two"}\n\n') }));
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(320);
  const user = userEvent.setup();

  render(<LogModal open onClose={vi.fn()} />);
  await user.type(screen.getByLabelText("Identifier"), "qwen");
  await user.click(screen.getByRole("button", { name: "Load Logs" }));

  const output = await screen.findByText(/line one/);
  await waitFor(() => expect(output.scrollTop).toBe(320));
});

it("falls back to JSON logs when streaming fails", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockRejectedValueOnce(new Error("stream failed"))
    .mockResolvedValueOnce(okJson({ text: "fallback text" })));
  const user = userEvent.setup();

  render(<LogModal open onClose={vi.fn()} />);
  await user.selectOptions(screen.getByLabelText("Source"), "download");
  await user.type(screen.getByLabelText("Identifier"), "download-1");
  await user.click(screen.getByRole("button", { name: "Load Logs" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/downloads/download-1/logs?lines=200", expect.objectContaining({ method: "GET" })));
  expect(await screen.findByText("fallback text")).toBeInTheDocument();
});

it("clears the displayed log output without closing the modal", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: streamFrom('event: chunk\ndata: {"text":"old run output"}\n\n') }));
  const user = userEvent.setup();

  render(<LogModal open onClose={vi.fn()} />);
  await user.type(screen.getByLabelText("Identifier"), "qwen");
  await user.click(screen.getByRole("button", { name: "Load Logs" }));
  expect(await screen.findByText("old run output")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Clear displayed logs" }));

  expect(screen.queryByText("old run output")).not.toBeInTheDocument();
  expect(screen.getByText("Waiting for log output...")).toBeInTheDocument();
});

it("aborts the active stream when closing", async () => {
  const abortSpy = vi.spyOn(AbortController.prototype, "abort");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: new ReadableStream<Uint8Array>() }));
  const onClose = vi.fn();
  const user = userEvent.setup();

  render(<LogModal open onClose={onClose} />);
  await user.type(screen.getByLabelText("Identifier"), "qwen");
  await user.click(screen.getByRole("button", { name: "Load Logs" }));
  await user.click(screen.getByRole("button", { name: "Close logs" }));

  expect(abortSpy).toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});

it("hides Source and Identifier when opened with pinned selection", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: streamFrom('event: chunk\ndata: {"text":"prefilled log"}\n\n') }));

  render(<LogModal open onClose={vi.fn()} initialSelection={{ source: "model", identifier: "qwen", autoLoad: true, requestId: 1 }} />);

  expect(screen.queryByLabelText("Source")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Identifier")).not.toBeInTheDocument();
  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/lm-api/v1/logs/qwen/stream?lines=200", expect.objectContaining({ method: "GET" })));
  expect(await screen.findByText("prefilled log")).toBeInTheDocument();
});
