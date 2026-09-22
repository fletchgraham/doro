import { createContext, useContext, useEffect, useState } from "react";
import {
  loadFeatureFlags,
  loadTodoistSettings,
  loadWorkflowySettings,
  saveFeatureFlags,
  saveTodoistSettings,
  saveWorkflowySettings,
  type FeatureFlags,
  type FeatureName,
  type TodoistSettings,
  type WorkflowySettings,
} from "../lib/settings";

// Everything the settings modal edits, apart from the theme (useTheme) and
// gold rates (App), which have their own stores.
const useSettings = () => {
  const [features, setFeatures] = useState<FeatureFlags>(loadFeatureFlags);
  const [todoist, setTodoistState] =
    useState<TodoistSettings>(loadTodoistSettings);
  const [workflowy, setWorkflowyState] =
    useState<WorkflowySettings>(loadWorkflowySettings);

  useEffect(() => {
    saveFeatureFlags(features);
  }, [features]);
  useEffect(() => {
    saveTodoistSettings(todoist);
  }, [todoist]);
  useEffect(() => {
    saveWorkflowySettings(workflowy);
  }, [workflowy]);

  const setFeature = (name: FeatureName, on: boolean) =>
    setFeatures((f) => ({ ...f, [name]: on }));

  const setTodoist = (patch: Partial<TodoistSettings>) =>
    setTodoistState((s) => ({ ...s, ...patch }));

  // The parent node input is what the user pasted; the id it resolved to
  // is only valid for that input, so changing one forgets the other
  const setWorkflowy = (patch: Partial<WorkflowySettings>) =>
    setWorkflowyState((s) => {
      const next = { ...s, ...patch };
      if (
        patch.parentInput !== undefined &&
        patch.parentInput !== s.parentInput &&
        patch.parentId === undefined
      ) {
        next.parentId = "";
      }
      return next;
    });

  return {
    features,
    setFeature,
    todoist,
    setTodoist,
    workflowy,
    setWorkflowy,
  };
};

export type SettingsManager = ReturnType<typeof useSettings>;

// Settings are consulted deep in the task lists (accomplishable coloring,
// the Todoist import), so they travel by context like templates do
export const SettingsContext = createContext<SettingsManager | null>(null);

export const useSettingsContext = (): SettingsManager => {
  const manager = useContext(SettingsContext);
  if (!manager) {
    throw new Error("useSettingsContext needs a SettingsContext provider");
  }
  return manager;
};

export const useFeatures = (): FeatureFlags => useSettingsContext().features;

export default useSettings;
