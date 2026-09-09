import type Task from "../types/Task";
import { getLiveDuration } from "./getDuration";
import { DEFAULT_COLOR, TASK_COLORS } from "./taskColors";

// Rates are expressed as gold per minute worked
export const MINUTE_MS = 60 * 1000;

// Below this, gold counts as gone. Covers floating point noise when the
// out-of-gold timeout fires right on the boundary.
export const GOLD_EPSILON = 1e-6;

export const GOLD_SETTINGS_KEY = "doroGoldSettings";

// Bumped when the stored shape or the meaning of `rate` changes. Version 1
// was a bare color→rule map with rates per ten minutes.
export const GOLD_SETTINGS_VERSION = 2;
const LEGACY_INTERVAL_MINUTES = 10;

export interface GoldRule {
  // Earning colors add gold, spending colors drain it. Both accrue
  // continuously: every millisecond worked counts.
  mode: "earn" | "spend";
  // Gold per minute. Zero makes the color neutral.
  rate: number;
}

// Keyed by task color hex (see TASK_COLORS)
export type GoldSettings = Record<string, GoldRule>;

export const DEFAULT_GOLD_SETTINGS: GoldSettings = Object.fromEntries(
  TASK_COLORS.map((c) => {
    if (c.name === "red") return [c.hex, { mode: "earn", rate: 1 }];
    if (c.name === "blue") return [c.hex, { mode: "earn", rate: 0.2 }];
    return [c.hex, { mode: "spend", rate: 1 }];
  })
);

const isRule = (value: unknown): value is GoldRule =>
  value != null &&
  typeof value === "object" &&
  ((value as GoldRule).mode === "earn" || (value as GoldRule).mode === "spend") &&
  typeof (value as GoldRule).rate === "number" &&
  Number.isFinite((value as GoldRule).rate) &&
  (value as GoldRule).rate >= 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === "object" && !Array.isArray(value);

/**
 * Parse stored settings, falling back to defaults for anything missing or
 * malformed so every known color always has a rule. Version 1 storage
 * (no version marker) carried rates per ten minutes and is converted.
 */
export const parseGoldSettings = (raw: string | null): GoldSettings => {
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  const result: GoldSettings = { ...DEFAULT_GOLD_SETTINGS };
  if (!isRecord(parsed)) return result;

  const versioned = parsed.version === GOLD_SETTINGS_VERSION;
  const rules = versioned ? parsed.rules : parsed;
  if (!isRecord(rules)) return result;
  const scale = versioned ? 1 : 1 / LEGACY_INTERVAL_MINUTES;

  for (const [color, rule] of Object.entries(rules)) {
    if (isRule(rule)) result[color] = { mode: rule.mode, rate: rule.rate * scale };
  }
  return result;
};

export const serializeGoldSettings = (settings: GoldSettings): string =>
  JSON.stringify({ version: GOLD_SETTINGS_VERSION, rules: settings });

export const loadGoldSettings = (): GoldSettings =>
  parseGoldSettings(localStorage.getItem(GOLD_SETTINGS_KEY));

export const saveGoldSettings = (settings: GoldSettings): void =>
  localStorage.setItem(GOLD_SETTINGS_KEY, serializeGoldSettings(settings));

/** Gold earned by an amount of time on a color, negative for spending */
export const goldForColor = (ms: number, rule: GoldRule | undefined): number => {
  if (!rule || rule.rate <= 0 || ms <= 0) return 0;
  const gold = (ms / MINUTE_MS) * rule.rate;
  return rule.mode === "earn" ? gold : -gold;
};

/** Gold balance from time worked per color */
export const computeGold = (
  progress: Record<string, number>,
  settings: GoldSettings
): number => {
  let gold = 0;
  for (const [color, ms] of Object.entries(progress)) {
    gold += goldForColor(ms, settings[color]);
  }
  return gold;
};

/**
 * Time worked per color right now: the active task counts its open
 * session up to `now`, everything else its recorded duration.
 */
export const liveProgressByColor = (
  tasks: Task[],
  now: number = Date.now()
): Record<string, number> => {
  const progress: Record<string, number> = {};
  for (const task of tasks) {
    const dur =
      task.status === "active" ? getLiveDuration(task.events, now) : task.duration;
    if (dur <= 0) continue;
    const color = task.color || DEFAULT_COLOR;
    progress[color] = (progress[color] || 0) + dur;
  }
  return progress;
};

/**
 * The whole gold balance, straight from the tasks. Nothing about gold is
 * stored, so this is the same number before and after a reload.
 */
export const liveGold = (
  tasks: Task[],
  settings: GoldSettings,
  now: number = Date.now()
): number => computeGold(liveProgressByColor(tasks, now), settings);

export const isSpendingRule = (rule: GoldRule | undefined): rule is GoldRule =>
  !!rule && rule.mode === "spend" && rule.rate > 0;

export const isOutOfGold = (gold: number): boolean => gold <= GOLD_EPSILON;

/**
 * How long a spending color can keep running before `gold` hits zero, or
 * null when the color doesn't spend gold at all.
 */
export const msUntilBroke = (
  gold: number,
  rule: GoldRule | undefined
): number | null => {
  if (!isSpendingRule(rule)) return null;
  return (Math.max(gold, 0) / rule.rate) * MINUTE_MS;
};

/** Up to two decimals, no trailing zeros, and never "-0" */
export const formatGold = (gold: number): string => {
  const rounded = Math.round(gold * 100) / 100;
  if (rounded === 0) return "0";
  return String(rounded);
};
