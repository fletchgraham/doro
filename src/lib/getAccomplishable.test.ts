import { describe, it, expect } from "vitest";
import { getAccomplishable } from "./getAccomplishable";
import type Task from "../types/Task";

const createTestTask = (
  id: string,
  estimate: number | undefined,
  duration: number = 0
): Task => ({
  id,
  text: `Task ${id}`,
  notes: "",
  events: [],
  status: "working",
  duration,
  order: 0,
  estimate,
});

describe("getAccomplishable", () => {
  const MINUTE = 60 * 1000;
  const HOUR = 60 * MINUTE;

  it("returns empty map for empty task list", () => {
    const { results, totalRemainingWork } = getAccomplishable([], HOUR);
    expect(results.size).toBe(0);
    expect(totalRemainingWork).toBe(0);
  });

  it("marks single task within budget as accomplishable", () => {
    const tasks = [createTestTask("1", 30 * MINUTE)];
    const { results } = getAccomplishable(tasks, HOUR);

    expect(results.get("1")).toEqual({
      taskId: "1",
      remainingWork: 30 * MINUTE,
      cumulativeWork: 30 * MINUTE,
      isAccomplishable: true,
    });
  });

  it("marks single task over budget as not accomplishable", () => {
    const tasks = [createTestTask("1", 2 * HOUR)];
    const { results } = getAccomplishable(tasks, HOUR);

    expect(results.get("1")?.isAccomplishable).toBe(false);
  });

  it("calculates cumulative work correctly for multiple tasks", () => {
    const tasks = [
      createTestTask("1", 30 * MINUTE),
      createTestTask("2", 30 * MINUTE),
      createTestTask("3", 30 * MINUTE),
    ];
    const { results } = getAccomplishable(tasks, HOUR);

    expect(results.get("1")?.cumulativeWork).toBe(30 * MINUTE);
    expect(results.get("2")?.cumulativeWork).toBe(60 * MINUTE);
    expect(results.get("3")?.cumulativeWork).toBe(90 * MINUTE);
  });

  it("marks tasks green/red based on cumulative budget", () => {
    const tasks = [
      createTestTask("1", 30 * MINUTE),
      createTestTask("2", 30 * MINUTE),
      createTestTask("3", 30 * MINUTE),
    ];
    // 1 hour budget: first 2 fit, third doesn't
    const { results } = getAccomplishable(tasks, HOUR);

    expect(results.get("1")?.isAccomplishable).toBe(true);
    expect(results.get("2")?.isAccomplishable).toBe(true);
    expect(results.get("3")?.isAccomplishable).toBe(false);
  });

  it("respects task order", () => {
    const tasks = [
      createTestTask("1", 45 * MINUTE),
      createTestTask("2", 45 * MINUTE),
    ];
    const { results } = getAccomplishable(tasks, HOUR);

    // First task fits, second doesn't
    expect(results.get("1")?.isAccomplishable).toBe(true);
    expect(results.get("2")?.isAccomplishable).toBe(false);
  });

  it("accounts for actual duration worked", () => {
    // Task estimated at 1h, but 30m already done
    const tasks = [createTestTask("1", HOUR, 30 * MINUTE)];
    const { results } = getAccomplishable(tasks, 30 * MINUTE);

    expect(results.get("1")?.remainingWork).toBe(30 * MINUTE);
    expect(results.get("1")?.isAccomplishable).toBe(true);
  });

  it("treats tasks with no estimate as 20 minutes (default)", () => {
    const tasks = [
      createTestTask("1", undefined),
      createTestTask("2", 30 * MINUTE),
    ];
    const { results } = getAccomplishable(tasks, 50 * MINUTE);

    expect(results.get("1")?.remainingWork).toBe(20 * MINUTE);
    expect(results.get("1")?.isAccomplishable).toBe(true);
    expect(results.get("2")?.remainingWork).toBe(30 * MINUTE);
    expect(results.get("2")?.isAccomplishable).toBe(true);
  });

  it("treats duration > estimate as 0 remaining work", () => {
    // Estimated 30m but worked 45m already
    const tasks = [createTestTask("1", 30 * MINUTE, 45 * MINUTE)];
    const { results } = getAccomplishable(tasks, 0);

    expect(results.get("1")?.remainingWork).toBe(0);
    expect(results.get("1")?.isAccomplishable).toBe(true);
  });

  it("handles exact budget match as accomplishable", () => {
    const tasks = [createTestTask("1", HOUR)];
    const { results } = getAccomplishable(tasks, HOUR);

    expect(results.get("1")?.isAccomplishable).toBe(true);
  });

  it("handles mixed estimate/no-estimate tasks", () => {
    const tasks = [
      createTestTask("1", 20 * MINUTE),
      createTestTask("2", undefined), // defaults to 20min
      createTestTask("3", 30 * MINUTE),
      createTestTask("4", 20 * MINUTE),
    ];
    const { results } = getAccomplishable(tasks, 90 * MINUTE);

    expect(results.get("1")?.cumulativeWork).toBe(20 * MINUTE);
    expect(results.get("2")?.cumulativeWork).toBe(40 * MINUTE); // no-estimate adds 20min default
    expect(results.get("3")?.cumulativeWork).toBe(70 * MINUTE);
    expect(results.get("4")?.cumulativeWork).toBe(90 * MINUTE);

    expect(results.get("1")?.isAccomplishable).toBe(true);
    expect(results.get("2")?.isAccomplishable).toBe(true);
    expect(results.get("3")?.isAccomplishable).toBe(true);
    expect(results.get("4")?.isAccomplishable).toBe(true);
  });

  it("user scenario: 1h budget with 5x20m, 1x10m, 1x5m tasks", () => {
    const tasks = [
      createTestTask("1", 20 * MINUTE),
      createTestTask("2", 20 * MINUTE),
      createTestTask("3", 20 * MINUTE),
      createTestTask("4", 20 * MINUTE),
      createTestTask("5", 20 * MINUTE),
      createTestTask("6", 10 * MINUTE),
      createTestTask("7", 5 * MINUTE),
    ];
    // Total: 115 minutes. With 1 hour budget, only first 3 (60 min) should be green
    const { results } = getAccomplishable(tasks, HOUR);

    // Verify cumulative values
    expect(results.get("1")?.cumulativeWork).toBe(20 * MINUTE);
    expect(results.get("2")?.cumulativeWork).toBe(40 * MINUTE);
    expect(results.get("3")?.cumulativeWork).toBe(60 * MINUTE);
    expect(results.get("4")?.cumulativeWork).toBe(80 * MINUTE);
    expect(results.get("5")?.cumulativeWork).toBe(100 * MINUTE);
    expect(results.get("6")?.cumulativeWork).toBe(110 * MINUTE);
    expect(results.get("7")?.cumulativeWork).toBe(115 * MINUTE);

    // First 3 tasks fit in 60 minutes, rest don't
    expect(results.get("1")?.isAccomplishable).toBe(true);
    expect(results.get("2")?.isAccomplishable).toBe(true);
    expect(results.get("3")?.isAccomplishable).toBe(true);
    expect(results.get("4")?.isAccomplishable).toBe(false);
    expect(results.get("5")?.isAccomplishable).toBe(false);
    expect(results.get("6")?.isAccomplishable).toBe(false);
    expect(results.get("7")?.isAccomplishable).toBe(false);
  });

  describe("totalRemainingWork", () => {
    it("returns 0 for empty task list", () => {
      const { totalRemainingWork } = getAccomplishable([], HOUR);
      expect(totalRemainingWork).toBe(0);
    });

    it("sums remaining work for all tasks", () => {
      const tasks = [
        createTestTask("1", 30 * MINUTE),
        createTestTask("2", 20 * MINUTE),
        createTestTask("3", 10 * MINUTE),
      ];
      const { totalRemainingWork } = getAccomplishable(tasks, HOUR);
      expect(totalRemainingWork).toBe(60 * MINUTE);
    });

    it("subtracts duration already worked", () => {
      const tasks = [
        createTestTask("1", 30 * MINUTE, 10 * MINUTE),
        createTestTask("2", 20 * MINUTE, 5 * MINUTE),
      ];
      // remaining: 20m + 15m = 35m
      const { totalRemainingWork } = getAccomplishable(tasks, HOUR);
      expect(totalRemainingWork).toBe(35 * MINUTE);
    });

    it("clamps overworked tasks to 0 remaining", () => {
      const tasks = [
        createTestTask("1", 30 * MINUTE, 45 * MINUTE), // overworked
        createTestTask("2", 20 * MINUTE),
      ];
      // remaining: 0 + 20m = 20m
      const { totalRemainingWork } = getAccomplishable(tasks, HOUR);
      expect(totalRemainingWork).toBe(20 * MINUTE);
    });

    it("uses default estimate for tasks without one", () => {
      const tasks = [createTestTask("1", undefined)];
      const { totalRemainingWork } = getAccomplishable(tasks, HOUR);
      expect(totalRemainingWork).toBe(20 * MINUTE);
    });

    it("equals last task's cumulativeWork", () => {
      const tasks = [
        createTestTask("1", 30 * MINUTE),
        createTestTask("2", 45 * MINUTE),
        createTestTask("3", 15 * MINUTE),
      ];
      const { results, totalRemainingWork } = getAccomplishable(tasks, HOUR);
      expect(totalRemainingWork).toBe(results.get("3")!.cumulativeWork);
    });
  });

  describe("over/under budget delta", () => {
    it("under budget: totalRemainingWork < timeBudget", () => {
      const tasks = [createTestTask("1", 30 * MINUTE)];
      const budget = HOUR;
      const { totalRemainingWork } = getAccomplishable(tasks, budget);
      const delta = budget - totalRemainingWork;
      expect(delta).toBe(30 * MINUTE);
      expect(delta).toBeGreaterThan(0);
    });

    it("over budget: totalRemainingWork > timeBudget", () => {
      const tasks = [
        createTestTask("1", 40 * MINUTE),
        createTestTask("2", 40 * MINUTE),
      ];
      const budget = HOUR;
      const { totalRemainingWork } = getAccomplishable(tasks, budget);
      const delta = budget - totalRemainingWork;
      expect(delta).toBe(-20 * MINUTE);
      expect(delta).toBeLessThan(0);
    });

    it("exactly on budget: totalRemainingWork === timeBudget", () => {
      const tasks = [
        createTestTask("1", 30 * MINUTE),
        createTestTask("2", 30 * MINUTE),
      ];
      const budget = HOUR;
      const { totalRemainingWork } = getAccomplishable(tasks, budget);
      const delta = budget - totalRemainingWork;
      expect(delta).toBe(0);
    });

    it("partially worked tasks affect delta", () => {
      // 2h estimated, 1h30m done, 30m remaining — fits in 1h budget with 30m to spare
      const tasks = [createTestTask("1", 2 * HOUR, 90 * MINUTE)];
      const budget = HOUR;
      const { totalRemainingWork } = getAccomplishable(tasks, budget);
      const delta = budget - totalRemainingWork;
      expect(totalRemainingWork).toBe(30 * MINUTE);
      expect(delta).toBe(30 * MINUTE);
    });

    it("all tasks completed: 0 remaining, fully under budget", () => {
      const tasks = [
        createTestTask("1", 30 * MINUTE, 30 * MINUTE),
        createTestTask("2", 20 * MINUTE, 25 * MINUTE),
      ];
      const budget = HOUR;
      const { totalRemainingWork } = getAccomplishable(tasks, budget);
      expect(totalRemainingWork).toBe(0);
      expect(budget - totalRemainingWork).toBe(HOUR);
    });

    it("realistic scenario: 3h budget, mixed progress", () => {
      const tasks = [
        createTestTask("1", 45 * MINUTE, 45 * MINUTE), // done, 0 remaining
        createTestTask("2", 30 * MINUTE, 10 * MINUTE), // 20m remaining
        createTestTask("3", HOUR),                      // 60m remaining
        createTestTask("4", undefined),                 // default 20m remaining
        createTestTask("5", 45 * MINUTE),               // 45m remaining
      ];
      const budget = 3 * HOUR;
      const { totalRemainingWork } = getAccomplishable(tasks, budget);
      // 0 + 20 + 60 + 20 + 45 = 145 minutes
      expect(totalRemainingWork).toBe(145 * MINUTE);
      // 180 - 145 = 35 minutes under
      expect(budget - totalRemainingWork).toBe(35 * MINUTE);
    });
  });
});
