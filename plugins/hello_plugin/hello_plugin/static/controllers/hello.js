export function mountPage(root, host) {
  const idTarget = root.querySelector("[data-testid='hello-plugin-id']");
  const apiTarget = root.querySelector("[data-testid='hello-plugin-api']");
  const refreshButton = root.querySelector("[data-action='refresh-status']");

  if (idTarget) idTarget.textContent = host.pluginId;
  if (apiTarget) apiTarget.textContent = `/lm-api/v1/plugins/${host.pluginId}`;
  if (refreshButton) refreshButton.addEventListener("click", host.refreshPluginStatus);

  return () => {
    if (refreshButton) refreshButton.removeEventListener("click", host.refreshPluginStatus);
  };
}
