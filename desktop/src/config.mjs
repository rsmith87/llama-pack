const DEFAULT_APP_URL = "http://127.0.0.1:5173/ui/";
const DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 1500;
const START_STACK_COMMAND = "scripts/dev_fullstack.sh";

export function resolveDesktopConfig(env) {
  const appUrl = env.LLAMA_PACK_DESKTOP_URL || DEFAULT_APP_URL;
  return {
    appUrl,
    healthCheckTimeoutMs: DEFAULT_HEALTH_CHECK_TIMEOUT_MS,
  };
}

export function buildStartStackCommand() {
  return START_STACK_COMMAND;
}

export function isInternalNavigationUrl(candidateUrl, appUrl) {
  const candidate = new URL(candidateUrl);
  const app = new URL(appUrl);
  return candidate.protocol === "file:" || candidate.origin === app.origin;
}
