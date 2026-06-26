type ActiveModelLike = {
  pid?: unknown;
  running?: unknown;
  status?: unknown;
  process_state?: unknown;
};

export function isActiveModel(model: ActiveModelLike): boolean {
  if (model.running === true || model.status === "running") return true;
  if (model.running === false || model.status === "stopped" || model.process_state === "stale") return false;
  return Boolean(model.pid);
}

export function isLoadingModel(model: ActiveModelLike): boolean {
  return model.status === "starting";
}

export function isProblemModel(model: ActiveModelLike): boolean {
  return model.process_state === "stale";
}
