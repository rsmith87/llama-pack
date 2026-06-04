export function registerPlugin(app) {
  app.addRoute?.({
    path: "/ui/plugins/hello_plugin",
    label: "Hello Plugin",
  });
}
