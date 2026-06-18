export function buildWindowOptions() {
  return {
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 680,
    title: "Llama Pack",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      partition: "llama-pack-desktop-dev",
      sandbox: true,
    },
  };
}
