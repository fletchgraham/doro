import { expect, test, describe } from "vitest";
import getDuration, { getLiveDuration } from "./getDuration";

// ── Original getDuration tests ──

test("it works", () => {
  const events = [
    { eventType: "start", timestamp: 5 },
    { eventType: "stop", timestamp: 10 },
  ];
  const dur = getDuration(events);

  expect(dur).toBe(5);
});

test("one start event", () => {
  const events = [{ eventType: "start", timestamp: 5 }];

  expect(getDuration(events)).toBe(0);
});

test("one stop event", () => {
  const events = [{ eventType: "stop", timestamp: 5 }];

  expect(getDuration(events)).toBe(0);
});

test("ignore multiple stops", () => {
  const events = [
    { eventType: "start", timestamp: 5 },
    { eventType: "stop", timestamp: 10 },
    { eventType: "stop", timestamp: 12 },
    { eventType: "stop", timestamp: 13 },
    { eventType: "start", timestamp: 14 },
  ];
  expect(getDuration(events)).toBe(5);
});

test("many normal open and closed starts and stops", () => {
  const events = [
    { eventType: "start", timestamp: 5 },
    { eventType: "stop", timestamp: 10 },
    { eventType: "start", timestamp: 12 },
    { eventType: "stop", timestamp: 13 },
    { eventType: "start", timestamp: 14 },
    { eventType: "stop", timestamp: 17 },
  ];
  expect(getDuration(events)).toBe(9);
});

test("ignore multiple starts", () => {
  const events = [
    { eventType: "start", timestamp: 5 },
    { eventType: "start", timestamp: 10 },
    { eventType: "start", timestamp: 12 },
    { eventType: "stop", timestamp: 15 },
  ];
  expect(getDuration(events)).toBe(3);
});

test("no events", () => expect(getDuration([])).toBe(0));

// ── duration_override tests ──

describe("duration_override", () => {
  test("override resets accumulated duration", () => {
    const events = [
      { eventType: "start", timestamp: 0 },
      { eventType: "stop", timestamp: 100 },
      { eventType: "duration_override", timestamp: 200, duration: 50 },
    ];
    expect(getDuration(events)).toBe(50);
  });

  test("override to zero clears all duration", () => {
    const events = [
      { eventType: "start", timestamp: 0 },
      { eventType: "stop", timestamp: 1000 },
      { eventType: "duration_override", timestamp: 2000, duration: 0 },
    ];
    expect(getDuration(events)).toBe(0);
  });

  test("work after override adds to override value", () => {
    const events = [
      { eventType: "start", timestamp: 0 },
      { eventType: "stop", timestamp: 100 },
      { eventType: "duration_override", timestamp: 200, duration: 50 },
      { eventType: "start", timestamp: 300 },
      { eventType: "stop", timestamp: 320 },
    ];
    expect(getDuration(events)).toBe(70); // 50 + 20
  });

  test("multiple overrides - last one wins for base", () => {
    const events = [
      { eventType: "start", timestamp: 0 },
      { eventType: "stop", timestamp: 100 },
      { eventType: "duration_override", timestamp: 200, duration: 50 },
      { eventType: "start", timestamp: 300 },
      { eventType: "stop", timestamp: 310 },
      { eventType: "duration_override", timestamp: 400, duration: 25 },
    ];
    // First override sets to 50, then 10 added (60), then second override resets to 25
    expect(getDuration(events)).toBe(25);
  });

  test("multiple overrides with work after last one", () => {
    const events = [
      { eventType: "start", timestamp: 0 },
      { eventType: "stop", timestamp: 100 },
      { eventType: "duration_override", timestamp: 200, duration: 50 },
      { eventType: "duration_override", timestamp: 300, duration: 10 },
      { eventType: "start", timestamp: 400 },
      { eventType: "stop", timestamp: 430 },
    ];
    expect(getDuration(events)).toBe(40); // 10 + 30
  });

  test("override during open start session discards that session", () => {
    const events = [
      { eventType: "start", timestamp: 0 },
      // No stop - session is open
      { eventType: "duration_override", timestamp: 100, duration: 42 },
    ];
    expect(getDuration(events)).toBe(42);
  });

  test("override with no previous events", () => {
    const events = [
      { eventType: "duration_override", timestamp: 100, duration: 300 },
    ];
    expect(getDuration(events)).toBe(300);
  });

  test("override with undefined duration defaults to 0", () => {
    const events = [
      { eventType: "start", timestamp: 0 },
      { eventType: "stop", timestamp: 100 },
      { eventType: "duration_override", timestamp: 200 },
    ];
    expect(getDuration(events)).toBe(0);
  });

  test("override followed by orphaned stops", () => {
    const events = [
      { eventType: "duration_override", timestamp: 100, duration: 50 },
      { eventType: "stop", timestamp: 200 },
      { eventType: "stop", timestamp: 300 },
    ];
    expect(getDuration(events)).toBe(50);
  });

  test("complex sequence with override in the middle", () => {
    const events = [
      { eventType: "start", timestamp: 0 },
      { eventType: "stop", timestamp: 10 },    // +10
      { eventType: "start", timestamp: 20 },
      { eventType: "stop", timestamp: 35 },    // +15, total = 25
      { eventType: "duration_override", timestamp: 40, duration: 100 },
      { eventType: "start", timestamp: 50 },
      { eventType: "stop", timestamp: 55 },    // +5, total = 105
      { eventType: "start", timestamp: 60 },
      { eventType: "stop", timestamp: 70 },    // +10, total = 115
    ];
    expect(getDuration(events)).toBe(115);
  });

  test("override with large duration value", () => {
    const oneHour = 60 * 60 * 1000;
    const events = [
      { eventType: "duration_override", timestamp: 100, duration: oneHour },
    ];
    expect(getDuration(events)).toBe(oneHour);
  });
});

// ── getLiveDuration tests ──

describe("getLiveDuration", () => {
  test("same as getDuration when no open session", () => {
    const events = [
      { eventType: "start", timestamp: 0 },
      { eventType: "stop", timestamp: 100 },
    ];
    expect(getLiveDuration(events, 200)).toBe(100);
  });

  test("includes open session time", () => {
    const events = [
      { eventType: "start", timestamp: 100 },
    ];
    expect(getLiveDuration(events, 150)).toBe(50);
  });

  test("includes open session after completed sessions", () => {
    const events = [
      { eventType: "start", timestamp: 0 },
      { eventType: "stop", timestamp: 10 },
      { eventType: "start", timestamp: 20 },
    ];
    expect(getLiveDuration(events, 30)).toBe(20); // 10 + 10
  });

  test("no events returns 0", () => {
    expect(getLiveDuration([], 100)).toBe(0);
  });

  test("override with open session after", () => {
    const events = [
      { eventType: "start", timestamp: 0 },
      { eventType: "stop", timestamp: 100 },
      { eventType: "duration_override", timestamp: 200, duration: 50 },
      { eventType: "start", timestamp: 300 },
    ];
    expect(getLiveDuration(events, 320)).toBe(70); // 50 + 20
  });

  test("override discards open session before it", () => {
    const events = [
      { eventType: "start", timestamp: 0 },
      { eventType: "duration_override", timestamp: 100, duration: 42 },
    ];
    expect(getLiveDuration(events, 200)).toBe(42);
  });

  test("override then new open session", () => {
    const events = [
      { eventType: "duration_override", timestamp: 0, duration: 100 },
      { eventType: "start", timestamp: 50 },
    ];
    expect(getLiveDuration(events, 80)).toBe(130); // 100 + 30
  });

  test("multiple starts - uses last start for open session", () => {
    const events = [
      { eventType: "start", timestamp: 0 },
      { eventType: "start", timestamp: 10 },
      { eventType: "start", timestamp: 20 },
    ];
    // curStart keeps getting overwritten: 0 -> 10 -> 20
    expect(getLiveDuration(events, 30)).toBe(10); // 30 - 20
  });

  test("defaults to Date.now when no now argument", () => {
    const now = Date.now();
    const events = [
      { eventType: "start", timestamp: now - 1000 },
    ];
    const result = getLiveDuration(events);
    // Should be approximately 1000ms (within 100ms tolerance)
    expect(result).toBeGreaterThanOrEqual(900);
    expect(result).toBeLessThanOrEqual(1200);
  });
});
