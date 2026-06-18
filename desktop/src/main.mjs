import { app, BrowserWindow, Menu, shell } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { buildStartStackCommand, isInternalNavigationUrl, resolveDesktopConfig } from "./config.mjs";
import { buildOfflinePageLoadOptions } from "./offlinePage.mjs";
import { isAppReachable } from "./readiness.mjs";
import { buildWindowOptions } from "./windowOptions.mjs";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const desktopConfig = resolveDesktopConfig(process.env);

function createWindow() {
  return new BrowserWindow(buildWindowOptions());
}

async function loadShell(window) {
  const reachable = await isAppReachable(desktopConfig.appUrl, desktopConfig.healthCheckTimeoutMs);
  if (reachable) {
    console.info(`Loading Llama Pack web UI from ${desktopConfig.appUrl}`);
    await window.loadURL(desktopConfig.appUrl);
    return;
  }

  console.warn(
    `Llama Pack web UI is unavailable at ${desktopConfig.appUrl}. ` +
      `Start it with ${buildStartStackCommand()}.`,
  );
  await window.loadFile(
    join(moduleDir, "offline.html"),
    buildOfflinePageLoadOptions(desktopConfig.appUrl, buildStartStackCommand()),
  );
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);

  const window = createWindow();
  window.once("ready-to-show", () => window.show());

  window.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.warn(`[renderer:${level}] ${sourceId}:${line} ${message}`);
  });

  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
    console.error(`Renderer failed to load ${validatedUrl}: ${errorCode} ${errorDescription}`);
    if (isMainFrame && !validatedUrl.startsWith("file://")) {
      loadShell(window);
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (isInternalNavigationUrl(url, desktopConfig.appUrl)) {
      return;
    }
    event.preventDefault();
    shell.openExternal(url);
  });

  await loadShell(window);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const nextWindow = createWindow();
      loadShell(nextWindow);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
