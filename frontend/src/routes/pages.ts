export type BuiltInPageKey = "dashboard" | "setup" | "chat" | "nodes" | "models" | "gguf-library" | "hf-to-gguf" | "hf-downloads" | "quantization" | "controller-ops" | "runtime-overview" | "tool-loop-evals" | "embeddings" | "plugins" | "audit" | "benchmarks" | "api-keys" | "settings" | "docs";
export type PageKey = BuiltInPageKey | string;
export type PageIcon =
  | "dashboard"
  | "setup"
  | "chat"
  | "nodes"
  | "library"
  | "convert"
  | "download"
  | "quantize"
  | "controller"
  | "runtime"
  | "benchmark"
  | "embeddings"
  | "audit"
  | "api-keys"
  | "plugins"
  | "settings"
  | "docs";
export type AppMode = "agent" | "controller";
export type NavSectionKey = "gateway" | "operations" | "models" | "runtime" | "plugins" | "system";
export type NavSection = { key: NavSectionKey; label: string };
export type PageDefinition = {
  key: PageKey;
  label: string;
  path: string;
  icon: PageIcon;
  section: NavSectionKey;
  hideInModes?: AppMode[];
  hideFromPrimary?: boolean;
  navLabel?: string;
  pluginId?: string;
  pluginName?: string;
  secondaryNavigation?: Array<{ label: string; path: string }>;
};
export type PageNavigationOptions = { search?: string };

export const navSections: NavSection[] = [
  { key: "gateway", label: "Gateway" },
  { key: "operations", label: "Operations" },
  { key: "models", label: "Models" },
  { key: "runtime", label: "Runtime" },
  { key: "plugins", label: "Plugins" },
  { key: "system", label: "System" },
];

export const modelLifecycleNavigation: Array<{ label: string; path: string }> = [
  { label: "Overview", path: "/ui/models" },
  { label: "Library", path: "/ui/gguf-library" },
  { label: "Acquire", path: "/ui/hf-downloads" },
  { label: "Convert", path: "/ui/hf-to-gguf" },
  { label: "Quantize", path: "/ui/quantization" },
  { label: "Evaluate", path: "/ui/benchmarks" },
];

export const pages: PageDefinition[] = [
  { key: "chat", label: "Chat", path: "/ui/chat", icon: "chat", section: "gateway" },
  { key: "api-keys", label: "App Keys", path: "/ui/api-keys", icon: "api-keys", section: "gateway", hideInModes: ["agent"] },
  { key: "audit", label: "Audit", path: "/ui/audit", icon: "audit", section: "gateway", hideInModes: ["agent"] },
  { key: "dashboard", label: "Dashboard", path: "/", icon: "dashboard", section: "operations" },
  { key: "nodes", label: "Nodes", path: "/ui/nodes", icon: "nodes", section: "operations", hideInModes: ["agent"] },
  { key: "controller-ops", label: "Controller Ops", path: "/ui/controller-ops", icon: "controller", section: "operations", hideInModes: ["agent"] },
  { key: "models", label: "Models", path: "/ui/models", icon: "library", section: "models", secondaryNavigation: modelLifecycleNavigation },
  { key: "gguf-library", label: "Library", path: "/ui/gguf-library", icon: "library", section: "models", hideFromPrimary: true, secondaryNavigation: modelLifecycleNavigation },
  { key: "hf-downloads", label: "Acquire", path: "/ui/hf-downloads", icon: "download", section: "models", hideFromPrimary: true, secondaryNavigation: modelLifecycleNavigation },
  { key: "hf-to-gguf", label: "Convert", path: "/ui/hf-to-gguf", icon: "convert", section: "models", hideFromPrimary: true, secondaryNavigation: modelLifecycleNavigation },
  { key: "quantization", label: "Quantize", path: "/ui/quantization", icon: "quantize", section: "models", hideFromPrimary: true, secondaryNavigation: modelLifecycleNavigation },
  { key: "benchmarks", label: "Evaluate", path: "/ui/benchmarks", icon: "benchmark", section: "models", hideInModes: ["agent"], hideFromPrimary: true, secondaryNavigation: modelLifecycleNavigation },
  { key: "runtime-overview", label: "Overview", path: "/ui/runtime", icon: "runtime", section: "runtime" },
  { key: "tool-loop-evals", label: "Tool Loop Evals", path: "/ui/tool-loop-evals", icon: "benchmark", section: "runtime" },
  { key: "embeddings", label: "Embeddings", path: "/ui/embeddings", icon: "embeddings", section: "runtime" },
  { key: "plugins", label: "Plugins", path: "/ui/plugins", icon: "plugins", section: "plugins", hideInModes: ["agent"] },
  { key: "setup", label: "Setup", path: "/ui/setup", icon: "setup", section: "system" },
  { key: "settings", label: "Settings", path: "/ui/settings", icon: "settings", section: "system" },
  { key: "docs", label: "Docs", path: "/ui/docs", icon: "docs", section: "system" },
];

export function pagesForMode(mode: string): PageDefinition[] {
  const normalizedMode = mode === "agent" || mode === "controller" ? mode : "";
  return pages.filter((page) => !normalizedMode || !page.hideInModes?.includes(normalizedMode));
}

export function pagesBySectionForMode(mode: string, extraPages: PageDefinition[] = []): Array<NavSection & { pages: PageDefinition[] }> {
  const visible = [...pagesForMode(mode), ...extraPages];
  return navSections
    .map((section) => ({
      ...section,
      pages: visible.filter((page) => page.section === section.key && !page.hideFromPrimary),
    }))
    .filter((section) => section.pages.length > 0);
}

export function pageForKey(key: PageKey, extraPages: PageDefinition[] = []): PageDefinition {
  return [...pages, ...extraPages].find((page) => page.key === key) || pages.find((page) => page.key === "dashboard") || pages[0];
}

export function pageForPath(pathname: string, extraPages: PageDefinition[] = []): PageDefinition {
  return [...pages, ...extraPages].find((page) => page.path === pathname) || pageForKey("dashboard");
}

export function pageForCurrentPath(
  pathname: string,
  extraPages: PageDefinition[] = [],
): PageDefinition {
  const match = [...pages, ...extraPages].find((p) => p.path === pathname);
  if (match) return match;
  // Handle plugin pages that don't appear in the static list
  if (pathname.startsWith("/ui/plugins/")) {
    const pluginId = pathname.slice("/ui/plugins/".length).split("/")[0];
    if (pluginId) {
      const pluginMatch = extraPages.find((p) => p.pluginId === pluginId && p.path === pathname);
      if (pluginMatch) return pluginMatch;
      return {
        key: `plugin:${pluginId}:${pathname}`,
        label: "Plugin",
        path: pathname,
        icon: "settings",
        section: "plugins",
        pluginId,
        pluginName: "Plugin",
        hideFromPrimary: true,
      };
    }
  }
  return pageForKey("dashboard");
}

export function pathForPage(page: PageDefinition, options: PageNavigationOptions = {}): string {
  const search = options.search?.trim();
  if (!search) return page.path;
  return `${page.path}?${search.startsWith("?") ? search.slice(1) : search}`;
}
