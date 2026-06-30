import { useMemo, useState } from "react";
import { getModelProfiles, listModels } from "../../api/models";
import { getNodeModels } from "../../api/nodes";
import {
  asModels,
  asNodes,
  asProfileCatalog,
  firstProfileForFamily,
  familyForModel,
  modelIsLoaded,
  modelTarget,
  nodeModelsToChatModels,
  runningChatModelOptions,
} from "../../features/chat";
import { modelName } from "../../features/models";
import type { LocalModel, ModelProfileCatalog } from "../../types/models";

export function useChatModelSelection({
  initialModel,
  initialTarget,
  onError,
}: {
  initialModel: string;
  initialTarget: string;
  onError: (message: string) => void;
}) {
  const [models, setModels] = useState<LocalModel[]>([]);
  const [profileCatalog, setProfileCatalog] = useState<ModelProfileCatalog>({ families: [] });
  const [selectedFamily, setSelectedFamily] = useState("");
  const [selectedProfile, setSelectedProfile] = useState("");
  const [selectedModel, setSelectedModel] = useState(initialModel);
  const [target, setTarget] = useState(initialTarget || "auto");

  const runningModels = useMemo(() => runningChatModelOptions(models), [models]);
  const noModelLoaded = runningModels.length === 0;
  const selectedRunningModel = runningModels.find((model) => modelName(model) === selectedModel);
  const profileFamilies = profileCatalog.families.filter((family) => family.family && family.profiles.length);
  const selectedProfileFamily = profileFamilies.find((family) => family.family === selectedFamily);
  const targetOptions = ["auto", "local", target, ...runningModels.map(modelTarget)].filter((item, index, items) => item && items.indexOf(item) === index);

  async function refreshModels() {
    onError("");
    try {
      let items = asModels(await listModels());
      if (!items.length) {
        items = nodeModelsToChatModels(asNodes(await getNodeModels()));
      }
      const loadedItems = items.filter((model) => modelName(model) && modelIsLoaded(model));
      setModels(items);
      setSelectedModel((current) => loadedItems.some((model) => modelName(model) === current) ? current : modelName(loadedItems[0] || {}));
      setTarget((current) => current === "auto" && modelTarget(loadedItems[0] || {}) ? modelTarget(loadedItems[0] || {}) : current);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to load chat models");
    }
  }

  async function refreshProfileCatalog(model = selectedModel) {
    try {
      const catalog = asProfileCatalog(await getModelProfiles());
      setProfileCatalog(catalog);
      const preferredFamily = familyForModel(catalog, model) || catalog.families[0]?.family || "";
      setSelectedFamily((current) => current || preferredFamily);
      setSelectedProfile((current) => current || firstProfileForFamily(catalog, preferredFamily));
    } catch {
      setProfileCatalog({ families: [] });
    }
  }

  function selectModel(model: string) {
    setSelectedModel(model);
    const family = familyForModel(profileCatalog, model);
    if (family) {
      setSelectedFamily(family);
      setSelectedProfile(firstProfileForFamily(profileCatalog, family));
    }
  }

  return {
    models,
    profileCatalog,
    selectedFamily,
    selectedProfile,
    selectedModel,
    target,
    runningModels,
    noModelLoaded,
    selectedRunningModel,
    profileFamilies,
    selectedProfileFamily,
    targetOptions,
    refreshModels,
    refreshProfileCatalog,
    selectModel,
    setSelectedFamily,
    setSelectedProfile,
    setSelectedModel,
    setTarget,
  };
}
