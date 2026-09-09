import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  DEFAULT_GOLD_SETTINGS,
  GOLD_SETTINGS_VERSION,
  MINUTE_MS,
  computeGold,
  formatGold,
  goldForColor,
  isOutOfGold,
  liveGold,
  liveProgressByColor,
  msUntilBroke,
  parseGoldSettings,
  serializeGoldSettings,
  type GoldSettings,
} from "./gold";
import tasksReducer from "./tasksReducer";
import type Task from "../types/Task";

const MIN = MINUTE_MS;
const SEC = 1000;
const RED = "#f87171";
const BLUE = "#60a5fa";
const GREEN = "#4ade80";
const GRAY = "#9ca3af";

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: overrides.id ?? crypto.randomUUID(),
  text: "task",
  notes: "",
  status: "done",
  order: 0,
  duration: 0,
  events: [],
  ...overrides,
});

describe("computeGold", () => {
  it("pays for every millisecond, earning and spending alike", () => {
    // 15m red at 1/min → 15, 25m blue at 0.2/min → 5
    expect(computeGold({ [RED]: 15 * MIN, [BLUE]: 25 * MIN }, DEFAULT_GOLD_SETTINGS)).toBe(20);
    // then 4.25m on green at 1/min
    expect(
      computeGold(
        { [RED]: 15 * MIN, [BLUE]: 25 * MIN, [GREEN]: 4.25 * MIN },
        DEFAULT_GOLD_SETTINGS
      )
    ).toBeCloseTo(15.75);
  });

  it("pays partial minutes: 30 seconds is half a minute's gold", () => {
    expect(computeGold({ [RED]: 30 * SEC }, DEFAULT_GOLD_SETTINGS)).toBe(0.5);
    expect(computeGold({ [RED]: 1 * SEC }, DEFAULT_GOLD_SETTINGS)).toBeCloseTo(1 / 60);
    expect(computeGold({ [RED]: 10 * MIN - 1 }, DEFAULT_GOLD_SETTINGS)).toBeCloseTo(10, 4);
  });

  it("can go negative when spending outruns earning", () => {
    expect(computeGold({ [GRAY]: 5 * MIN }, DEFAULT_GOLD_SETTINGS)).toBe(-5);
    expect(computeGold({ [RED]: 2 * MIN, [GRAY]: 5 * MIN }, DEFAULT_GOLD_SETTINGS)).toBe(-3);
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
    expect(computeGold({ [RED]: 20 * MIN, [GREEN]: 5 * MIN }, settings)).toBe(60 - 20);
  });
});

describe("goldForColor", () => {
  it("returns zero for no time, no rule, or negative time", () => {
    expect(goldForColor(0, { mode: "earn", rate: 10 })).toBe(0);
    expect(goldForColor(MIN, undefined)).toBe(0);
    expect(goldForColor(-MIN, { mode: "spend", rate: 10 })).toBe(0);
  });

  it("is the same magnitude for earn and spend, opposite sign", () => {
    expect(goldForColor(90 * SEC, { mode: "earn", rate: 2 })).toBe(3);
    expect(goldForColor(90 * SEC, { mode: "spend", rate: 2 })).toBe(-3);
  });
});

describe("liveProgressByColor", () => {
  it("counts the active task's open session up to now", () => {
    const now = 100_000;
    const tasks: Task[] = [
      makeTask({
        status: "active",
        color: GREEN,
        events: [{ eventType: "start", timestamp: now - 4 * MIN }],
      }),
      makeTask({ duration: 12 * MIN, color: RED }),
      makeTask({ status: "ready" }),
    ];
    expect(liveProgressByColor(tasks, now)).toEqual({
      [GREEN]: 4 * MIN,
      [RED]: 12 * MIN,
    });
  });

  it("treats uncolored tasks as gray", () => {
    const tasks: Task[] = [makeTask({ duration: MIN })];
    expect(liveProgressByColor(tasks, 0)).toEqual({ [GRAY]: MIN });
  });
});

// Manual time edits go through the reducer as duration_override events,
// exactly as the inline time editors do. Gold has to follow wherever the
// durations go, with nothing left over from before the edit.
describe("liveGold with manual time edits", () => {
  const T0 = 1_700_000_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const at = (ms: number) => vi.setSystemTime(T0 + ms);
  const override = (tasks: Task[], task: Task, duration: number) =>
    tasksReducer(tasks, { type: "OVERRIDE_DURATION", taskId: task.id, duration });

  it("re-prices a finished task when its time is edited down", () => {
    const red = makeTask({ color: RED, duration: 20 * MIN });
    let tasks = [red];
    expect(liveGold(tasks, DEFAULT_GOLD_SETTINGS)).toBe(20);
    tasks = override(tasks, red, 5 * MIN);
    expect(liveGold(tasks, DEFAULT_GOLD_SETTINGS)).toBe(5);
  });

  it("re-prices a finished task when its time is edited up", () => {
    const red = makeTask({
      color: RED,
      duration: 3 * MIN,
      events: [
        { eventType: "start", timestamp: T0 - 10 * MIN },
        { eventType: "stop", timestamp: T0 - 7 * MIN },
      ],
    });
    let tasks = [red];
    expect(liveGold(tasks, DEFAULT_GOLD_SETTINGS)).toBe(3);
    tasks = override(tasks, red, 45 * MIN);
    expect(liveGold(tasks, DEFAULT_GOLD_SETTINGS)).toBe(45);
  });

  it("drops a task's contribution entirely when its time is set to zero", () => {
    const red = makeTask({ color: RED, duration: 20 * MIN });
    const green = makeTask({ color: GREEN, duration: 8 * MIN });
    let tasks = [red, green];
    expect(liveGold(tasks, DEFAULT_GOLD_SETTINGS)).toBe(12);
    tasks = override(tasks, green, 0);
    expect(liveGold(tasks, DEFAULT_GOLD_SETTINGS)).toBe(20);
    tasks = override(tasks, red, 0);
    expect(liveGold(tasks, DEFAULT_GOLD_SETTINGS)).toBe(0);
  });

  it("uses the edited time exactly on a paused active task and does not tick", () => {
    const active = makeTask({
      status: "active",
      color: RED,
      duration: 2 * MIN,
      events: [
        { eventType: "start", timestamp: T0 - 5 * MIN },
        { eventType: "stop", timestamp: T0 - 3 * MIN },
      ],
    });
    let tasks = [active];
    tasks = override(tasks, active, 90 * SEC);
    expect(liveGold(tasks, DEFAULT_GOLD_SETTINGS, T0)).toBe(1.5);
    // Still paused an hour later: no phantom session after the edit
    expect(liveGold(tasks, DEFAULT_GOLD_SETTINGS, T0 + 60 * MIN)).toBe(1.5);
  });

  it("continues from the edited time when the active task is running", () => {
    const active = makeTask({
      status: "active",
      color: RED,
      events: [{ eventType: "start", timestamp: T0 - 10 * MIN }],
    });
    let tasks = [active];
    expect(liveGold(tasks, DEFAULT_GOLD_SETTINGS, T0)).toBe(10);
    // Edit mid-session down to 1 minute
    tasks = override(tasks, active, 1 * MIN);
    expect(liveGold(tasks, DEFAULT_GOLD_SETTINGS, T0)).toBe(1);
    // Keeps ticking from the override instant, not from the original start
    expect(liveGold(tasks, DEFAULT_GOLD_SETTINGS, T0 + 30 * SEC)).toBe(1.5);
    expect(liveGold(tasks, DEFAULT_GOLD_SETTINGS, T0 + 4 * MIN)).toBe(5);
  });

  it("adds later work on top of the edited time", () => {
    const active = makeTask({ status: "active", color: RED });
    let tasks = [active];
    tasks = override(tasks, active, 7 * MIN);
    at(1 * MIN);
    tasks = tasksReducer(tasks, { type: "LOG_START" });
    at(3 * MIN);
    expect(liveGold(tasks, DEFAULT_GOLD_SETTINGS)).toBe(9);
    tasks = tasksReducer(tasks, { type: "LOG_PAUSE" });
    at(10 * MIN);
    expect(liveGold(tasks, DEFAULT_GOLD_SETTINGS)).toBe(9);
    // Edit again after working: the last edit wins outright
    tasks = override(tasks, active, 2 * MIN);
    expect(liveGold(tasks, DEFAULT_GOLD_SETTINGS)).toBe(2);
  });

  it("re-prices under the new color when a task changes color after an edit", () => {
    const task = makeTask({ color: RED });
    let tasks = override([task], task, 6 * MIN);
    expect(liveGold(tasks, DEFAULT_GOLD_SETTINGS)).toBe(6);
    tasks = tasksReducer(tasks, { type: "SET_COLOR", taskId: task.id, color: GREEN });
    expect(liveGold(tasks, DEFAULT_GOLD_SETTINGS)).toBe(-6);
    tasks = tasksReducer(tasks, { type: "SET_COLOR", taskId: task.id, color: BLUE });
    expect(liveGold(tasks, DEFAULT_GOLD_SETTINGS)).toBeCloseTo(1.2);
  });

  it("re-prices the whole day when a rate changes", () => {
    const red = makeTask({ color: RED, duration: 10 * MIN });
    const green = makeTask({ color: GREEN, duration: 4 * MIN });
    const tasks = [red, green];
    expect(liveGold(tasks, DEFAULT_GOLD_SETTINGS)).toBe(6);
    const doubled: GoldSettings = {
      ...DEFAULT_GOLD_SETTINGS,
      [RED]: { mode: "earn", rate: 2 },
    };
    expect(liveGold(tasks, doubled)).toBe(16);
    const neutralGreen: GoldSettings = {
      ...DEFAULT_GOLD_SETTINGS,
      [GREEN]: { mode: "spend", rate: 0 },
    };
    expect(liveGold(tasks, neutralGreen)).toBe(10);
  });

  it("an edit on a spending task can push the balance below zero and back", () => {
    const red = makeTask({ color: RED, duration: 5 * MIN });
    const gray = makeTask({ duration: 2 * MIN });
    let tasks = [red, gray];
    expect(liveGold(tasks, DEFAULT_GOLD_SETTINGS)).toBe(3);
    expect(isOutOfGold(liveGold(tasks, DEFAULT_GOLD_SETTINGS))).toBe(false);
    tasks = override(tasks, gray, 9 * MIN);
    expect(liveGold(tasks, DEFAULT_GOLD_SETTINGS)).toBe(-4);
    expect(isOutOfGold(liveGold(tasks, DEFAULT_GOLD_SETTINGS))).toBe(true);
    tasks = override(tasks, gray, 1 * MIN);
    expect(liveGold(tasks, DEFAULT_GOLD_SETTINGS)).toBe(4);
    expect(msUntilBroke(liveGold(tasks, DEFAULT_GOLD_SETTINGS), DEFAULT_GOLD_SETTINGS[GRAY])).toBe(4 * MIN);
  });

  it("survives a page refresh: the same tasks give the same gold", () => {
    const red = makeTask({ color: RED });
    const green = makeTask({ color: GREEN });
    let tasks = override([red, green], red, 25 * MIN);
    tasks = override(tasks, green, 90 * SEC);
    const before = liveGold(tasks, DEFAULT_GOLD_SETTINGS);
    expect(before).toBe(23.5);

    // What useTasks does: JSON through localStorage and back
    const reloaded: Task[] = JSON.parse(JSON.stringify(tasks));
    expect(liveGold(reloaded, DEFAULT_GOLD_SETTINGS)).toBe(before);
  });

  it("survives a refresh mid-session: an open session keeps counting from its start", () => {
    const active = makeTask({ status: "active", color: RED });
    let tasks = override([active], active, 3 * MIN);
    at(1 * MIN);
    tasks = tasksReducer(tasks, { type: "LOG_START" });
    at(2 * MIN);
    const reloaded: Task[] = JSON.parse(JSON.stringify(tasks));
    expect(liveGold(reloaded, DEFAULT_GOLD_SETTINGS)).toBe(4);
    at(5 * MIN);
    expect(liveGold(reloaded, DEFAULT_GOLD_SETTINGS)).toBe(7);
  });
});

describe("msUntilBroke", () => {
  it("is null for earning or neutral colors", () => {
    expect(msUntilBroke(10, { mode: "earn", rate: 10 })).toBeNull();
    expect(msUntilBroke(10, { mode: "spend", rate: 0 })).toBeNull();
    expect(msUntilBroke(10, undefined)).toBeNull();
  });

  it("scales gold by the per-minute spend rate", () => {
    expect(msUntilBroke(14, { mode: "spend", rate: 1 })).toBe(14 * MIN);
    expect(msUntilBroke(5, { mode: "spend", rate: 2 })).toBe(2.5 * MIN);
    expect(msUntilBroke(0.5, { mode: "spend", rate: 1 })).toBe(30 * SEC);
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
    expect(parseGoldSettings(JSON.stringify({ version: GOLD_SETTINGS_VERSION }))).toEqual(
      DEFAULT_GOLD_SETTINGS
    );
    expect(
      parseGoldSettings(JSON.stringify({ version: GOLD_SETTINGS_VERSION, rules: [1] }))
    ).toEqual(DEFAULT_GOLD_SETTINGS);
  });

  it("overlays valid stored rules on the defaults", () => {
    const parsed = parseGoldSettings(
      JSON.stringify({
        version: GOLD_SETTINGS_VERSION,
        rules: {
          [RED]: { mode: "spend", rate: 5 },
          [GREEN]: { mode: "earn", rate: "nope" },
          [BLUE]: { mode: "sideways", rate: 1 },
          [GRAY]: { mode: "spend", rate: -1 },
        },
      })
    );
    expect(parsed[RED]).toEqual({ mode: "spend", rate: 5 });
    expect(parsed[GREEN]).toEqual(DEFAULT_GOLD_SETTINGS[GREEN]);
    expect(parsed[BLUE]).toEqual(DEFAULT_GOLD_SETTINGS[BLUE]);
    expect(parsed[GRAY]).toEqual(DEFAULT_GOLD_SETTINGS[GRAY]);
  });

  it("converts unversioned per-10-minute rates to per minute", () => {
    const parsed = parseGoldSettings(
      JSON.stringify({
        [RED]: { mode: "earn", rate: 10 },
        [BLUE]: { mode: "earn", rate: 2 },
        [GREEN]: { mode: "spend", rate: 25 },
        [GRAY]: { mode: "spend", rate: "nope" },
      })
    );
    expect(parsed[RED]).toEqual({ mode: "earn", rate: 1 });
    expect(parsed[BLUE]).toEqual({ mode: "earn", rate: 0.2 });
    expect(parsed[GREEN]).toEqual({ mode: "spend", rate: 2.5 });
    expect(parsed[GRAY]).toEqual(DEFAULT_GOLD_SETTINGS[GRAY]);
  });

  it("round-trips through serializeGoldSettings unchanged", () => {
    const settings: GoldSettings = {
      ...DEFAULT_GOLD_SETTINGS,
      [RED]: { mode: "earn", rate: 0.75 },
      [GREEN]: { mode: "spend", rate: 0 },
    };
    expect(parseGoldSettings(serializeGoldSettings(settings))).toEqual(settings);
    expect(JSON.parse(serializeGoldSettings(settings)).version).toBe(GOLD_SETTINGS_VERSION);
  });

  it("defaults red and blue to earning and the rest to spending, per minute", () => {
    expect(DEFAULT_GOLD_SETTINGS[RED]).toEqual({ mode: "earn", rate: 1 });
    expect(DEFAULT_GOLD_SETTINGS[BLUE]).toEqual({ mode: "earn", rate: 0.2 });
    expect(DEFAULT_GOLD_SETTINGS[GREEN]).toEqual({ mode: "spend", rate: 1 });
    expect(DEFAULT_GOLD_SETTINGS[GRAY]).toEqual({ mode: "spend", rate: 1 });
  });
});
