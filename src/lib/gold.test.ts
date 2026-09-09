import { describe, it, expect } from "vitest";
import {
  DEFAULT_GOLD_SETTINGS,
  GOLD_INTERVAL_MS,
  computeGold,
  formatGold,
  goldForColor,
  isOutOfGold,
  liveProgressByColor,
  msUntilBroke,
  parseGoldSettings,
  type GoldSettings,
} from "./gold";
import type Task from "../types/Task";

const MIN = 60 * 1000;
const RED = "#f87171";
const BLUE = "#60a5fa";
const GREEN = "#4ade80";
const GRAY = "#9ca3af";

describe("computeGold", () => {
  it("earns in whole 10-minute blocks and spends continuously", () => {
    // 15m red → one block of 10, 25m blue → two blocks of 2
    expect(computeGold({ [RED]: 15 * MIN, [BLUE]: 25 * MIN }, DEFAULT_GOLD_SETTINGS)).toBe(14);
    // then 4.25m on green at 1 gold/min
    expect(
      computeGold(
        { [RED]: 15 * MIN, [BLUE]: 25 * MIN, [GREEN]: 4.25 * MIN },
        DEFAULT_GOLD_SETTINGS
      )
    ).toBeCloseTo(9.75);
  });

  it("pays nothing before the first block completes", () => {
    expect(computeGold({ [RED]: 10 * MIN - 1 }, DEFAULT_GOLD_SETTINGS)).toBe(0);
    expect(computeGold({ [RED]: 10 * MIN }, DEFAULT_GOLD_SETTINGS)).toBe(10);
  });

  it("can go negative when spending outruns earning", () => {
    expect(computeGold({ [GRAY]: 5 * MIN }, DEFAULT_GOLD_SETTINGS)).toBe(-5);
  });

  it("ignores colors without a rule and zero-rate colors", () => {
    const settings: GoldSettings = {
      ...DEFAULT_GOLD_SETTINGS,
      [GREEN]: { mode: "spend", rate: 0 },
    };
    expect(computeGold({ "#123456": 60 * MIN, [GREEN]: 60 * MIN }, settings)).toBe(0);
  });

  it("uses custom rates", () => {
    const settings: GoldSettings = {
      [RED]: { mode: "earn", rate: 3 },
      [GREEN]: { mode: "spend", rate: 4 },
    };
    expect(computeGold({ [RED]: 20 * MIN, [GREEN]: 5 * MIN }, settings)).toBe(6 - 2);
  });
});

describe("goldForColor", () => {
  it("returns zero for no time, no rule, or negative time", () => {
    expect(goldForColor(0, { mode: "earn", rate: 10 })).toBe(0);
    expect(goldForColor(MIN, undefined)).toBe(0);
    expect(goldForColor(-MIN, { mode: "spend", rate: 10 })).toBe(0);
  });
});

describe("liveProgressByColor", () => {
  it("counts the active task's open session up to now", () => {
    const now = 100_000;
    const tasks: Task[] = [
      {
        id: "1",
        text: "a",
        notes: "",
        status: "active",
        order: 0,
        duration: 0,
        color: GREEN,
        events: [{ eventType: "start", timestamp: now - 4 * MIN }],
      },
      {
        id: "2",
        text: "b",
        notes: "",
        status: "done",
        order: 1,
        duration: 12 * MIN,
        color: RED,
        events: [],
      },
      {
        id: "3",
        text: "c",
        notes: "",
        status: "ready",
        order: 2,
        duration: 0,
        events: [],
      },
    ];
    expect(liveProgressByColor(tasks, now)).toEqual({
      [GREEN]: 4 * MIN,
      [RED]: 12 * MIN,
    });
  });

  it("treats uncolored tasks as gray", () => {
    const tasks: Task[] = [
      { id: "1", text: "a", notes: "", status: "done", order: 0, duration: MIN, events: [] },
    ];
    expect(liveProgressByColor(tasks, 0)).toEqual({ [GRAY]: MIN });
  });
});

describe("msUntilBroke", () => {
  it("is null for earning or neutral colors", () => {
    expect(msUntilBroke(10, { mode: "earn", rate: 10 })).toBeNull();
    expect(msUntilBroke(10, { mode: "spend", rate: 0 })).toBeNull();
    expect(msUntilBroke(10, undefined)).toBeNull();
  });

  it("scales gold by the spend rate", () => {
    expect(msUntilBroke(14, { mode: "spend", rate: 10 })).toBe(14 * MIN);
    expect(msUntilBroke(5, { mode: "spend", rate: 20 })).toBe(2.5 * MIN);
    expect(msUntilBroke(1, { mode: "spend", rate: 1 })).toBe(GOLD_INTERVAL_MS);
  });

  it("is zero once gold is gone", () => {
    expect(msUntilBroke(0, { mode: "spend", rate: 10 })).toBe(0);
    expect(msUntilBroke(-3, { mode: "spend", rate: 10 })).toBe(0);
  });
});

describe("isOutOfGold", () => {
  it("treats tiny positive noise as gone", () => {
    expect(isOutOfGold(0)).toBe(true);
    expect(isOutOfGold(1e-9)).toBe(true);
    expect(isOutOfGold(-1)).toBe(true);
    expect(isOutOfGold(0.01)).toBe(false);
  });
});

describe("formatGold", () => {
  it("shows integers plainly and fractions to two decimals", () => {
    expect(formatGold(14)).toBe("14");
    expect(formatGold(9.75)).toBe("9.75");
    expect(formatGold(9.7)).toBe("9.7");
    expect(formatGold(9.7333)).toBe("9.73");
  });

  it("never shows negative zero", () => {
    expect(formatGold(-0.001)).toBe("0");
    expect(formatGold(-0)).toBe("0");
    expect(formatGold(-0.02)).toBe("-0.02");
  });
});

describe("parseGoldSettings", () => {
  it("falls back to defaults for empty or broken storage", () => {
    expect(parseGoldSettings(null)).toEqual(DEFAULT_GOLD_SETTINGS);
    expect(parseGoldSettings("not json")).toEqual(DEFAULT_GOLD_SETTINGS);
    expect(parseGoldSettings("[1,2]")).toEqual(DEFAULT_GOLD_SETTINGS);
  });

  it("overlays valid stored rules on the defaults", () => {
    const parsed = parseGoldSettings(
      JSON.stringify({
        [RED]: { mode: "spend", rate: 5 },
        [GREEN]: { mode: "earn", rate: "nope" },
        [BLUE]: { mode: "sideways", rate: 1 },
        [GRAY]: { mode: "spend", rate: -1 },
      })
    );
    expect(parsed[RED]).toEqual({ mode: "spend", rate: 5 });
    expect(parsed[GREEN]).toEqual(DEFAULT_GOLD_SETTINGS[GREEN]);
    expect(parsed[BLUE]).toEqual(DEFAULT_GOLD_SETTINGS[BLUE]);
    expect(parsed[GRAY]).toEqual(DEFAULT_GOLD_SETTINGS[GRAY]);
  });

  it("defaults red and blue to earning and the rest to spending", () => {
    expect(DEFAULT_GOLD_SETTINGS[RED]).toEqual({ mode: "earn", rate: 10 });
    expect(DEFAULT_GOLD_SETTINGS[BLUE]).toEqual({ mode: "earn", rate: 2 });
    expect(DEFAULT_GOLD_SETTINGS[GREEN]).toEqual({ mode: "spend", rate: 10 });
    expect(DEFAULT_GOLD_SETTINGS[GRAY]).toEqual({ mode: "spend", rate: 10 });
  });
});
