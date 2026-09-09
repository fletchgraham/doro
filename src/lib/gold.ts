import type Task from "../types/Task";
import { getLiveDuration } from "./getDuration";
import { DEFAULT_COLOR, TASK_COLORS } from "./taskColors";

// Rates are expressed as gold per this much time worked
export const GOLD_INTERVAL_MS = 10 * 60 * 1000;

// Below this, gold counts as gone. Covers floating point noise when the
// out-of-gold timeout fires right on the boundary.
export const GOLD_EPSILON = 1e-6;

export interface GoldRule {
  // Earning colors pay out in whole GOLD_INTERVAL_MS blocks; spending
  // colors drain gold continuously as time accrues.
  mode: "earn" | "spend";
  // Gold per GOLD_INTERVAL_MS. Zero makes the color neutral.
  rate: number;
}

// Keyed by task color hex (see TASK_COLORS)
export type GoldSettings = Record<string, GoldRule>;

export const DEFAULT_GOLD_SETTINGS: GoldSettings = Object.fromEntries(
  TASK_COLORS.map((c) => {
    if (c.name === "red") return [c.hex, { mode: "earn", rate: 10 }];
    if (c.name === "blue") return [c.hex, { mode: "earn", rate: 2 }];
    return [c.hex, { mode: "spend", rate: 10 }];
  })
);
const isRule = (value: unknown): value is GoldRule =>
  value != null &&
  typeof value === "object" &&
  ((value as GoldRule).mode === "earn" || (value as GoldRule).mode === "spend") &&
  typeof (value as GoldRule).rate === "number" &&
  Number.isFinite((value as GoldRule).rate) &&
  (value as GoldRule).rate >= 0;

/**
 * Parse stored settings, falling back to defaults for anything missing or
 * malformed so every known color always has a rule.
 */
export const parseGoldSettings = (raw: string | null): GoldSettings => {
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  const result: GoldSettings = { ...DEFAULT_GOLD_SETTINGS };
  if (parsed == null || typeof parsed !== "object") return result;
  for (const [color, rule] of Object.entries(parsed as Record<string, unknown>)) {
    if (isRule(rule)) result[color] = { mode: rule.mode, rate: rule.rate };
  }
  return result;
};

export const loadGoldSettings = (): GoldSettings =>
  parseGoldSettings(localStorage.getItem("doroGoldSettings"));

/** Gold earned by an amount of time on a color, may be negative for spending */
export const goldForColor = (ms: number, rule: GoldRule | undefined): number => {
  if (!rule || rule.rate <= 0 || ms <= 0) return 0;
  if (rule.mode === "earn") {
    return Math.floor(ms / GOLD_INTERVAL_MS) * rule.rate;
  }
  return -(ms / GOLD_INTERVAL_MS) * rule.rate;
};

/**
 * Live gold balance from time worked per color. Earning colors only pay in
 * whole blocks; spending colors charge for every millisecond.
 */
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
  return (Math.max(gold, 0) / rule.rate) * GOLD_INTERVAL_MS;
};

/** Up to two decimals, no trailing zeros, and never "-0" */
export const formatGold = (gold: number): string => {
  const rounded = Math.round(gold * 100) / 100;
  if (rounded === 0) return "0";
  return String(rounded);
};
