type ActiveModelLike = {
  pid?: unknown;
  running?: unknown;
  status?: unknown;
  process_state?: unknown;
};

export function isActiveModel(model: ActiveModelLike): boolean {
  return Boolean(model.pid || model.running || model.status === "running");
}

export function isLoadingModel(model: ActiveModelLike): boolean {
  return model.status === "starting";
}

export function isProblemModel(model: ActiveModelLike): boolean {
  return model.process_state === "stale";
}
