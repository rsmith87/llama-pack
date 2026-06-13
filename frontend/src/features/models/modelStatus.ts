type ActiveModelLike = {
  pid?: unknown;
  running?: unknown;
  status?: unknown;
};

export function isActiveModel(model: ActiveModelLike): boolean {
  return Boolean(model.pid || model.running || model.status === "running");
}

export function isLoadingModel(model: ActiveModelLike): boolean {
  return model.status === "starting";
}
