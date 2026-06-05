import { describe, expect, it } from "vitest";
import { navSections, pageForKey, pageForPath, pages, pagesBySectionForMode, pagesForMode } from "./pages";

describe("page route model", () => {
  it("defines stable metadata for every React nav page without legacy fallbacks", () => {
    expect(pages.map((page) => page.key)).toEqual([
      "chat",
      "api-keys",
      "audit",
      "dashboard",
      "nodes",
      "controller-ops",
      "gguf-library",
      "hf-downloads",
      "hf-to-gguf",
      "quantization",
      "benchmarks",
      "runtime-overview",
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
    expect(pageForPath("/unknown").key).toBe("dashboard");
  });

  it("round-trips page keys to paths", () => {
    for (const page of pages) {
      expect(pageForPath(page.path).key).toBe(page.key);
    }
  });

  it("hides controller-only pages in agent mode", () => {
    expect(pagesForMode("agent").map((page) => page.key)).not.toContain("nodes");
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
      { label: "Operations", pages: ["dashboard", "nodes", "controller-ops"] },
      { label: "Models", pages: ["gguf-library", "hf-downloads", "hf-to-gguf", "quantization", "benchmarks"] },
      { label: "Runtime", pages: ["runtime-overview", "embeddings"] },
      { label: "Plugins", pages: ["plugins"] },
      { label: "System", pages: ["setup", "settings", "docs"] },
    ]);
    expect(pagesBySectionForMode("agent").map((section) => ({
      label: section.label,
      pages: section.pages.map((page) => page.key),
    }))).toEqual([
      { label: "Gateway", pages: ["chat"] },
      { label: "Operations", pages: ["dashboard"] },
      { label: "Models", pages: ["gguf-library", "hf-downloads", "hf-to-gguf", "quantization"] },
      { label: "Runtime", pages: ["runtime-overview", "embeddings"] },
      { label: "System", pages: ["setup", "settings", "docs"] },
    ]);
  });
});
