export function mount(container, host) {
  const root = document.createElement("section");
  root.className = "hello-plugin";
  root.innerHTML = `
    <div class="hello-plugin__header">
      <span class="hello-plugin__eyebrow">Loaded plugin bundle</span>
      <h3>Hello Plugin</h3>
    </div>
    <dl class="hello-plugin__meta">
      <div>
        <dt>Plugin ID</dt>
        <dd data-testid="hello-plugin-id"></dd>
      </div>
      <div>
        <dt>API namespace</dt>
        <dd>/lm-api/v1/plugins/${host.pluginId}</dd>
      </div>
    </dl>
    <button class="hello-plugin__button" type="button">Refresh plugin status</button>
  `;

  root.querySelector("[data-testid='hello-plugin-id']").textContent = host.pluginId;
  const refreshButton = root.querySelector("button");
  refreshButton.addEventListener("click", host.refreshPluginStatus);
  container.replaceChildren(root);

  return () => {
    refreshButton.removeEventListener("click", host.refreshPluginStatus);
    root.remove();
  };
}
