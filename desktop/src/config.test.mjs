import test from "node:test";
import assert from "node:assert/strict";

import { buildStartStackCommand, isInternalNavigationUrl, resolveDesktopConfig } from "./config.mjs";

test("resolveDesktopConfig uses the default local Vite URL", () => {
  const config = resolveDesktopConfig({});

  assert.equal(config.appUrl, "http://127.0.0.1:5173/ui/");
  assert.equal(config.healthCheckTimeoutMs, 1500);
});

test("resolveDesktopConfig accepts an explicit app URL", () => {
  const config = resolveDesktopConfig({
    LLAMA_PACK_DESKTOP_URL: "http://127.0.0.1:6000/ui/",
  });

  assert.equal(config.appUrl, "http://127.0.0.1:6000/ui/");
});

test("buildStartStackCommand returns a project-relative command", () => {
  const command = buildStartStackCommand();

  assert.equal(command, "scripts/dev_fullstack.sh");
});

test("isInternalNavigationUrl allows the configured app origin", () => {
  const allowed = isInternalNavigationUrl(
    "http://127.0.0.1:6000/ui/models",
    "http://127.0.0.1:6000/ui/",
  );

  assert.equal(allowed, true);
});

test("isInternalNavigationUrl rejects external origins", () => {
  const allowed = isInternalNavigationUrl(
    "https://example.com/",
    "http://127.0.0.1:6000/ui/",
  );

  assert.equal(allowed, false);
});
