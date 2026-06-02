type ActiveModelLike = {
  pid?: unknown;
  running?: unknown;
  status?: unknown;
};

export function isActiveModel(model: ActiveModelLike): boolean {
  return Boolean(model.pid || model.running || model.status === "running");
}
