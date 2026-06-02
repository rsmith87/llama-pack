import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:9137";
const apiProxy = {
  target: apiProxyTarget,
  changeOrigin: true,
};

export default defineConfig({
  plugins: [react()],
  base: "/ui/",
  server: {
    proxy: {
      "/lm-api": apiProxy,
      "/v1": apiProxy,
    },
  },
  build: {
    outDir: "../llama_manager/ui",
    emptyOutDir: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
