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

  test("override mid-session restarts session from override timestamp", () => {
    // User is working (start at 0), overrides duration at 100, then stops at 300
    // Expected: override value (42) + time after override (300 - 100 = 200) = 242
    const events = [
      { eventType: "start", timestamp: 0 },
      { eventType: "duration_override", timestamp: 100, duration: 42 },
      { eventType: "stop", timestamp: 300 },
    ];
    expect(getDuration(events)).toBe(242);
  });

  test("override mid-session with no subsequent stop (getDuration ignores open tail)", () => {
    // User is working, overrides, but never stops — getDuration doesn't count open sessions
    const events = [
      { eventType: "start", timestamp: 0 },
      { eventType: "duration_override", timestamp: 100, duration: 42 },
    ];
    // getDuration only counts closed pairs; the implicit restart is open, so just 42
    // (getLiveDuration would add the open tail)
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

  // ── Mid-session override scenarios ──

  test("mid-session override then stop: counts time after override", () => {
    // Realistic scenario: user starts, works 100ms, overrides to 30m, works 200ms more, pauses
    const thirtyMin = 30 * 60 * 1000;
    const events = [
      { eventType: "start", timestamp: 1000 },
      { eventType: "duration_override", timestamp: 1100, duration: thirtyMin },
      { eventType: "stop", timestamp: 1300 },
    ];
    expect(getDuration(events)).toBe(thirtyMin + 200);
  });

  test("mid-session override then more start/stop cycles", () => {
    const events = [
      { eventType: "start", timestamp: 100 },
      { eventType: "duration_override", timestamp: 200, duration: 500 },
      { eventType: "stop", timestamp: 400 },        // +200, total = 700
      { eventType: "start", timestamp: 500 },
      { eventType: "stop", timestamp: 600 },         // +100, total = 800
    ];
    expect(getDuration(events)).toBe(800);
  });

  test("override when not in a session does not create phantom session", () => {
    // Override happens between sessions — no active curStart
    const events = [
      { eventType: "start", timestamp: 100 },
      { eventType: "stop", timestamp: 200 },          // +100
      { eventType: "duration_override", timestamp: 300, duration: 50 },
      // No start after override, then a stop arrives — should be orphaned
      { eventType: "stop", timestamp: 400 },
    ];
    expect(getDuration(events)).toBe(50);
  });

  test("two overrides mid-session: second one also continues session", () => {
    const events = [
      { eventType: "start", timestamp: 100 },
      { eventType: "duration_override", timestamp: 200, duration: 50 },
      // curStart restarted to 200
      { eventType: "duration_override", timestamp: 300, duration: 10 },
      // curStart restarted to 300 (was 200, not null)
      { eventType: "stop", timestamp: 500 },          // +200
    ];
    expect(getDuration(events)).toBe(210); // 10 + 200
  });

  test("realistic full workflow: start, work, override, continue, pause, resume, pause", () => {
    const fiveMin = 5 * 60 * 1000;
    const events = [
      { eventType: "start", timestamp: 1000 },
      // User works for a while, then overrides to 5 minutes
      { eventType: "duration_override", timestamp: 2000, duration: fiveMin },
      // Continues working, then pauses
      { eventType: "stop", timestamp: 3000 },          // +1000 after override
      // Resumes later
      { eventType: "start", timestamp: 5000 },
      { eventType: "stop", timestamp: 6000 },           // +1000
    ];
    expect(getDuration(events)).toBe(fiveMin + 2000);
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

  test("override mid-session continues accumulating (live)", () => {
    // User is working (start at 0), overrides to 42 at timestamp 100, still running at 200
    // Expected: 42 + (200 - 100) = 142
    const events = [
      { eventType: "start", timestamp: 0 },
      { eventType: "duration_override", timestamp: 100, duration: 42 },
    ];
    expect(getLiveDuration(events, 200)).toBe(142);
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

  // ── Mid-session override scenarios (live) ──

  test("mid-session override: live display keeps ticking", () => {
    // User starts at 1000, overrides to 5min at 2000, still running at 3000
    const fiveMin = 5 * 60 * 1000;
    const events = [
      { eventType: "start", timestamp: 1000 },
      { eventType: "duration_override", timestamp: 2000, duration: fiveMin },
    ];
    // At now=3000: fiveMin + (3000 - 2000) = fiveMin + 1000
    expect(getLiveDuration(events, 3000)).toBe(fiveMin + 1000);
  });

  test("mid-session override then stop then new open session (live)", () => {
    const events = [
      { eventType: "start", timestamp: 100 },
      { eventType: "duration_override", timestamp: 200, duration: 500 },
      { eventType: "stop", timestamp: 400 },        // +200, total = 700
      { eventType: "start", timestamp: 500 },        // open session
    ];
    // At now=600: 700 + (600 - 500) = 800
    expect(getLiveDuration(events, 600)).toBe(800);
  });

  test("override when not in session: no phantom ticking (live)", () => {
    const events = [
      { eventType: "start", timestamp: 100 },
      { eventType: "stop", timestamp: 200 },
      { eventType: "duration_override", timestamp: 300, duration: 50 },
    ];
    // No open session, so live = 50 regardless of now
    expect(getLiveDuration(events, 1000)).toBe(50);
  });

  test("two mid-session overrides: live display uses last override as base (live)", () => {
    const events = [
      { eventType: "start", timestamp: 100 },
      { eventType: "duration_override", timestamp: 200, duration: 50 },
      { eventType: "duration_override", timestamp: 300, duration: 10 },
    ];
    // curStart was restarted at each override: 200 then 300
    // At now=500: 10 + (500 - 300) = 210
    expect(getLiveDuration(events, 500)).toBe(210);
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
