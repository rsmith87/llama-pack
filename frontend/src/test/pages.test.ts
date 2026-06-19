import { describe, expect, it } from "vitest";
import {
  navSections,
  pageForKey,
  pageForPath,
  pages,
  pagesBySectionForMode,
  pagesForMode
} from "../routes/pages";

describe("page route model", () => {
  it("defines stable metadata for every React nav page without legacy fallbacks", () => {
    expect(pages.map((page) => page.key)).toEqual([
      "chat",
      "api-keys",
      "audit",
      "dashboard",
      "nodes",
      "projects",
      "controller-ops",
      "models",
      "gguf-library",
      "hf-downloads",
      "hf-to-gguf",
      "quantization",
      "benchmarks",
      "runtime-overview",
      "tool-loop-evals",
      "embeddings",
      "plugins",
      "setup",
      "settings",
      "docs",
    ]);
    expect(pageForKey("dashboard")).toEqual({ key: "dashboard", label: "Dashboard", path: "/", icon: "dashboard", section: "operations" });
    expect(pageForKey("setup")).toEqual({ key: "setup", label: "Setup", path: "/ui/setup", icon: "setup", section: "system" });
    expect(pageForKey("chat")).toEqual({ key: "chat", label: "Chat", path: "/ui/chat", icon: "chat", section: "gateway" });
    expect(pages.every((page) => !("legacyUrl" in page) && !("status" in page))).toBe(true);
    expect(pages.every((page) => page.icon)).toBe(true);
    expect(pages.every((page) => page.section)).toBe(true);
  });

  it("resolves paths and falls back to dashboard", () => {
    expect(pageForPath("/").key).toBe("dashboard");
    expect(pageForPath("/ui/nodes").key).toBe("nodes");
    expect(pageForPath("/ui/models").key).toBe("models");
    expect(pageForPath("/ui/gguf-library").key).toBe("gguf-library");
    expect(pageForPath("/unknown").key).toBe("dashboard");
  });

  it("round-trips page keys to paths", () => {
    for (const page of pages) {
      expect(pageForPath(page.path).key).toBe(page.key);
    }
  });

  it("hides controller-only pages in agent mode", () => {
    expect(pagesForMode("agent").map((page) => page.key)).not.toContain("nodes");
    expect(pagesForMode("agent").map((page) => page.key)).not.toContain("projects");
    expect(pagesForMode("agent").map((page) => page.key)).not.toContain("controller-ops");
    expect(pagesForMode("agent").map((page) => page.key)).not.toContain("audit");
    expect(pagesForMode("controller").map((page) => page.key)).toEqual(pages.map((page) => page.key));
  });

  it("groups navigation by product area", () => {
    expect(navSections.map((section) => section.key)).toEqual(["gateway", "operations", "models", "runtime", "plugins", "system"]);
    expect(pagesBySectionForMode("controller").map((section) => ({
      label: section.label,
      pages: section.pages.map((page) => page.key),
    }))).toEqual([
      { label: "Gateway", pages: ["chat", "api-keys", "audit"] },
      { label: "Operations", pages: ["dashboard", "nodes", "projects", "controller-ops"] },
      { label: "Models", pages: ["models"] },
      { label: "Runtime", pages: ["runtime-overview", "tool-loop-evals", "embeddings"] },
      { label: "Plugins", pages: ["plugins"] },
      { label: "System", pages: ["setup", "settings", "docs"] },
    ]);
    expect(pagesBySectionForMode("agent").map((section) => ({
      label: section.label,
      pages: section.pages.map((page) => page.key),
    }))).toEqual([
      { label: "Gateway", pages: ["chat"] },
      { label: "Operations", pages: ["dashboard"] },
      { label: "Models", pages: ["models"] },
      { label: "Runtime", pages: ["runtime-overview", "tool-loop-evals", "embeddings"] },
      { label: "System", pages: ["setup", "settings", "docs"] },
    ]);
  });

  it("keeps model lifecycle routes addressable behind the primary Models entry", () => {
    expect(pageForKey("models").secondaryNavigation?.map((item) => item.label)).toEqual([
      "Overview",
      "Library",
      "Acquire",
      "Convert",
      "Quantize",
      "Evaluate",
    ]);
    expect(pageForKey("gguf-library").hideFromPrimary).toBe(true);
    expect(pageForKey("hf-downloads").label).toBe("Acquire");
    expect(pageForKey("hf-to-gguf").label).toBe("Convert");
    expect(pageForKey("quantization").label).toBe("Quantize");
    expect(pageForKey("benchmarks").label).toBe("Evaluate");
    expect(pagesForMode("agent").map((page) => page.key)).not.toContain("benchmarks");
    expect(pageForPath("/ui/benchmarks").key).toBe("benchmarks");
  });
});
