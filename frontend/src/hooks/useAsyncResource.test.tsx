import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAsyncResource } from "./useAsyncResource";

describe("useAsyncResource", () => {
  it("starts in loading state with the initial data and no error", () => {
    const { result } = renderHook(() => useAsyncResource(async () => "fetched", "initial"));
    expect(result.current.data).toBe("initial");
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe("");
  });

  it("exposes resolved data after the fetcher resolves", async () => {
    const fetcher = vi.fn().mockResolvedValue("fetched");
    const { result } = renderHook(() => useAsyncResource(fetcher, "initial"));
    await act(async () => {
      await result.current.refresh();
    });
    expect(fetcher).toHaveBeenCalled();
    expect(result.current.data).toBe("fetched");
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("");
  });

  it("captures the thrown error's message on failure", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useAsyncResource(fetcher, "initial"));
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.error).toBe("boom");
    expect(result.current.loading).toBe(false);
  });

  it("falls back to a generic message when the throw value is not an Error", async () => {
    const fetcher = vi.fn().mockRejectedValue("string-throw");
    const { result } = renderHook(() => useAsyncResource(fetcher, "initial"));
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.error).toBe("Request failed");
  });

  it("clears a previous error after a successful manual refresh", async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error("first"))
      .mockResolvedValue("ok");
    const { result } = renderHook(() => useAsyncResource(fetcher, "initial"));
    // Let the mount-time auto-fetch drain so its rejected value is consumed.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current.error).toBe("first");
    expect(result.current.data).toBe("initial");
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.error).toBe("");
    expect(result.current.data).toBe("ok");
  });
});
