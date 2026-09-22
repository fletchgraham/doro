// The settings modal's stores: feature flags plus the Todoist and Workflowy
// integration settings. Theme lives in useTheme, gold rates in gold.ts.

export const FEATURES_KEY = "doroFeatures";

export type FeatureName = "gold" | "accomplishable" | "goals";

export type FeatureFlags = Record<FeatureName, boolean>;

export interface FeatureDefinition {
  name: FeatureName;
  label: string;
  description: string;
}

// Rendered in this order in the settings modal
export const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  {
    name: "gold",
    label: "Gold economy",
    description:
      "Earn gold on some task colors and spend it on others. Off, the timer never runs out of gold.",
  },
  {
    name: "accomplishable",
    label: "Accomplishable color coding",
    description:
      "Enter the time you have left and each task turns green or red by whether its estimate still fits.",
  },
  {
    name: "goals",
    label: "Goals",
    description:
      "Set a target time per color and watch a progress bar fill as you work.",
  },
];

// Every feature is on by default so nothing disappears for existing users.
// Accomplishable coloring used to be a switch on the timer page, so its
// first value is carried over from that switch (off by default).
export const DEFAULT_FEATURES: FeatureFlags = {
  gold: true,
  accomplishable: false,
  goals: true,
};

export const LEGACY_ACCOMPLISHABLE_KEY = "doroShowAccomplishable";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === "object" && !Array.isArray(value);

/**
 * Parse stored feature flags, falling back per flag so a malformed or
 * partial record never loses the other flags. `legacyAccomplishable` is the
 * old "Show accomplishable" switch's stored value, honoured only when no
 * flags have been stored yet.
 */
export const parseFeatureFlags = (
  raw: string | null,
  legacyAccomplishable: string | null = null
): FeatureFlags => {
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  const flags = { ...DEFAULT_FEATURES };
  if (!isRecord(parsed)) {
    if (legacyAccomplishable === "true") flags.accomplishable = true;
    return flags;
  }
  for (const def of FEATURE_DEFINITIONS) {
    const value = parsed[def.name];
    if (typeof value === "boolean") flags[def.name] = value;
  }
  return flags;
};

export const loadFeatureFlags = (): FeatureFlags =>
  parseFeatureFlags(
    localStorage.getItem(FEATURES_KEY),
    localStorage.getItem(LEGACY_ACCOMPLISHABLE_KEY)
  );

export const saveFeatureFlags = (flags: FeatureFlags): void => {
  localStorage.setItem(FEATURES_KEY, JSON.stringify(flags));
};

// --- Todoist ---

export interface TodoistSettings {
  enabled: boolean;
  token: string;
  // Only tasks carrying this label are imported; blank imports all of today
  label: string;
}

export const TODOIST_ENABLED_KEY = "doroTodoistEnabled";
export const TODOIST_TOKEN_KEY = "doroTodoistToken";
export const TODOIST_LABEL_KEY = "doroTodoistLabel";

/**
 * Todoist mode is new; before it, having a token was the mode. Without a
 * stored choice a saved token switches it on so existing imports keep
 * working.
 */
export const parseTodoistSettings = (
  enabled: string | null,
  token: string | null,
  label: string | null
): TodoistSettings => ({
  enabled: enabled === null ? !!token : enabled === "true",
  token: token ?? "",
  label: label ?? "",
});

export const loadTodoistSettings = (): TodoistSettings =>
  parseTodoistSettings(
    localStorage.getItem(TODOIST_ENABLED_KEY),
    localStorage.getItem(TODOIST_TOKEN_KEY),
    localStorage.getItem(TODOIST_LABEL_KEY)
  );

export const saveTodoistSettings = (settings: TodoistSettings): void => {
  localStorage.setItem(TODOIST_ENABLED_KEY, String(settings.enabled));
  if (settings.token) localStorage.setItem(TODOIST_TOKEN_KEY, settings.token);
  else localStorage.removeItem(TODOIST_TOKEN_KEY);
  localStorage.setItem(TODOIST_LABEL_KEY, settings.label);
};

// --- Workflowy ---

export interface WorkflowySettings {
  enabled: boolean;
  apiKey: string;
  // What the user pasted: a node link, short id or UUID
  parentInput: string;
  // The UUID that input resolved to; cleared whenever the input changes
  parentId: string;
}

export const WORKFLOWY_ENABLED_KEY = "doroWorkflowyEnabled";
export const WORKFLOWY_API_KEY_KEY = "doroWorkflowyApiKey";
export const WORKFLOWY_PARENT_INPUT_KEY = "doroWorkflowyParentInput";
export const WORKFLOWY_PARENT_ID_KEY = "doroWorkflowyParentId";

export const loadWorkflowySettings = (): WorkflowySettings => ({
  enabled: localStorage.getItem(WORKFLOWY_ENABLED_KEY) === "true",
  apiKey: localStorage.getItem(WORKFLOWY_API_KEY_KEY) ?? "",
  parentInput: localStorage.getItem(WORKFLOWY_PARENT_INPUT_KEY) ?? "",
  parentId: localStorage.getItem(WORKFLOWY_PARENT_ID_KEY) ?? "",
});

export const saveWorkflowySettings = (settings: WorkflowySettings): void => {
  localStorage.setItem(WORKFLOWY_ENABLED_KEY, String(settings.enabled));
  if (settings.apiKey)
    localStorage.setItem(WORKFLOWY_API_KEY_KEY, settings.apiKey);
  else localStorage.removeItem(WORKFLOWY_API_KEY_KEY);
  localStorage.setItem(WORKFLOWY_PARENT_INPUT_KEY, settings.parentInput);
  if (settings.parentId)
    localStorage.setItem(WORKFLOWY_PARENT_ID_KEY, settings.parentId);
  else localStorage.removeItem(WORKFLOWY_PARENT_ID_KEY);
};
