import type { PageIcon } from "../../routes/pages";

export type MenuIconName = PageIcon | "logs" | "menu" | "close";

export function MenuIcon({ icon }: { icon: MenuIconName }) {
  return (
    <svg className={`nav-icon icon-${icon} ml-1`} viewBox="0 0 24 24" aria-hidden="true">
      {icon === "dashboard" ? <path d="M4 12.5 12 5l8 7.5V20h-5v-5H9v5H4v-7.5Z" /> : null}
      {icon === "setup" ? <path d="M5 5h14v5H5V5Zm0 9h6v5H5v-5Zm9 0h5v5h-5v-5Z" /> : null}
      {icon === "chat" ? <path d="M5 6h14v9H9l-4 4V6Z" /> : null}
      {icon === "nodes" ? <path d="M6 7h5v5H6V7Zm7 5h5v5h-5v-5ZM7 14h3v3H7v-3Zm4-4h3m-4 6h3" /> : null}
      {icon === "library" ? <path d="M5 5h5v14H5V5Zm7 0h7v4h-7V5Zm0 6h7v8h-7v-8Z" /> : null}
      {icon === "convert" ? <path d="M6 8h10l-3-3m3 3-3 3M18 16H8l3 3m-3-3 3-3" /> : null}
      {icon === "download" ? <path d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14" /> : null}
      {icon === "quantize" ? <path d="M6 6h12v4H6V6Zm0 8h5v4H6v-4Zm7 0h5v4h-5v-4Z" /> : null}
      {icon === "controller" ? <path d="M5 7h14v10H5V7Zm4 3v4m3-4v4m3-4v4" /> : null}
      {icon === "runtime" ? <path d="M5 5h14v14H5V5Zm4 4h6M9 12h6M9 15h3" /> : null}
      {icon === "embeddings" ? <path d="M12 4v16M5 8l14 8M19 8 5 16" /> : null}
      {icon === "audit" ? <path d="M6 4h9l3 3v13H6V4Zm3 7h6M9 15h6" /> : null}
      {icon === "benchmark" ? <path d="M4 18h3v-6H4v6Zm6 0h3V8h-3v10Zm6 0h3V4h-3v14Z" /> : null}
      {icon === "api-keys" ? <path d="M7 11a4 4 0 1 1 8 0 4 4 0 0 1-8 0Zm4-6V3m0 16v-2m6-5h2M3 11h2m8.5-3.5 1.5-1.5M5 19l3-3m9 0 2 2M5 5l2 2" /> : null}
      {icon === "plugins" ? <path d="M8 4h8v5H8V4Zm-3 11h6v5H5v-5Zm8 0h6v5h-6v-5Zm-1-6v3m-4 0h8M8 12v3m8-3v3" /> : null}
      {icon === "settings" ? <path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0-4v3m0 10v3M4 12h3m10 0h3" /> : null}
      {icon === "docs" ? <path d="M7 4h10v16H7V4Zm3 4h4M10 10h4M10 14h2" /> : null}
      {icon === "logs" ? <path d="M5 5h14v14H5V5Zm4 5h6M9 14h4" /> : null}
      {icon === "menu" ? <path d="M5 7h14M5 12h14M5 17h14" /> : null}
      {icon === "close" ? <path d="M7 7l10 10M17 7 7 17" /> : null}
    </svg>
  );
}
