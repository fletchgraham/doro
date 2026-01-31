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
    const result = getAccomplishable([], HOUR);
    expect(result.size).toBe(0);
  });

  it("marks single task within budget as accomplishable", () => {
    const tasks = [createTestTask("1", 30 * MINUTE)];
    const result = getAccomplishable(tasks, HOUR);

    expect(result.get("1")).toEqual({
      taskId: "1",
      remainingWork: 30 * MINUTE,
      cumulativeWork: 30 * MINUTE,
      isAccomplishable: true,
    });
  });

  it("marks single task over budget as not accomplishable", () => {
    const tasks = [createTestTask("1", 2 * HOUR)];
    const result = getAccomplishable(tasks, HOUR);

    expect(result.get("1")?.isAccomplishable).toBe(false);
  });

  it("calculates cumulative work correctly for multiple tasks", () => {
    const tasks = [
      createTestTask("1", 30 * MINUTE),
      createTestTask("2", 30 * MINUTE),
      createTestTask("3", 30 * MINUTE),
    ];
    const result = getAccomplishable(tasks, HOUR);

    expect(result.get("1")?.cumulativeWork).toBe(30 * MINUTE);
    expect(result.get("2")?.cumulativeWork).toBe(60 * MINUTE);
    expect(result.get("3")?.cumulativeWork).toBe(90 * MINUTE);
  });

  it("marks tasks green/red based on cumulative budget", () => {
    const tasks = [
      createTestTask("1", 30 * MINUTE),
      createTestTask("2", 30 * MINUTE),
      createTestTask("3", 30 * MINUTE),
    ];
    // 1 hour budget: first 2 fit, third doesn't
    const result = getAccomplishable(tasks, HOUR);

    expect(result.get("1")?.isAccomplishable).toBe(true);
    expect(result.get("2")?.isAccomplishable).toBe(true);
    expect(result.get("3")?.isAccomplishable).toBe(false);
  });

  it("respects task order", () => {
    const tasks = [
      createTestTask("1", 45 * MINUTE),
      createTestTask("2", 45 * MINUTE),
    ];
    const result = getAccomplishable(tasks, HOUR);

    // First task fits, second doesn't
    expect(result.get("1")?.isAccomplishable).toBe(true);
    expect(result.get("2")?.isAccomplishable).toBe(false);
  });

  it("accounts for actual duration worked", () => {
    // Task estimated at 1h, but 30m already done
    const tasks = [createTestTask("1", HOUR, 30 * MINUTE)];
    const result = getAccomplishable(tasks, 30 * MINUTE);

    expect(result.get("1")?.remainingWork).toBe(30 * MINUTE);
    expect(result.get("1")?.isAccomplishable).toBe(true);
  });

  it("treats tasks with no estimate as 20 minutes (default)", () => {
    const tasks = [
      createTestTask("1", undefined),
      createTestTask("2", 30 * MINUTE),
    ];
    const result = getAccomplishable(tasks, 50 * MINUTE);

    expect(result.get("1")?.remainingWork).toBe(20 * MINUTE);
    expect(result.get("1")?.isAccomplishable).toBe(true);
    expect(result.get("2")?.remainingWork).toBe(30 * MINUTE);
    expect(result.get("2")?.isAccomplishable).toBe(true);
  });

  it("treats duration > estimate as 0 remaining work", () => {
    // Estimated 30m but worked 45m already
    const tasks = [createTestTask("1", 30 * MINUTE, 45 * MINUTE)];
    const result = getAccomplishable(tasks, 0);

    expect(result.get("1")?.remainingWork).toBe(0);
    expect(result.get("1")?.isAccomplishable).toBe(true);
  });

  it("handles exact budget match as accomplishable", () => {
    const tasks = [createTestTask("1", HOUR)];
    const result = getAccomplishable(tasks, HOUR);

    expect(result.get("1")?.isAccomplishable).toBe(true);
  });

  it("handles mixed estimate/no-estimate tasks", () => {
    const tasks = [
      createTestTask("1", 20 * MINUTE),
      createTestTask("2", undefined), // defaults to 20min
      createTestTask("3", 30 * MINUTE),
      createTestTask("4", 20 * MINUTE),
    ];
    const result = getAccomplishable(tasks, 90 * MINUTE);

    expect(result.get("1")?.cumulativeWork).toBe(20 * MINUTE);
    expect(result.get("2")?.cumulativeWork).toBe(40 * MINUTE); // no-estimate adds 20min default
    expect(result.get("3")?.cumulativeWork).toBe(70 * MINUTE);
    expect(result.get("4")?.cumulativeWork).toBe(90 * MINUTE);

    expect(result.get("1")?.isAccomplishable).toBe(true);
    expect(result.get("2")?.isAccomplishable).toBe(true);
    expect(result.get("3")?.isAccomplishable).toBe(true);
    expect(result.get("4")?.isAccomplishable).toBe(true);
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
    const result = getAccomplishable(tasks, HOUR);

    // Verify cumulative values
    expect(result.get("1")?.cumulativeWork).toBe(20 * MINUTE);
    expect(result.get("2")?.cumulativeWork).toBe(40 * MINUTE);
    expect(result.get("3")?.cumulativeWork).toBe(60 * MINUTE);
    expect(result.get("4")?.cumulativeWork).toBe(80 * MINUTE);
    expect(result.get("5")?.cumulativeWork).toBe(100 * MINUTE);
    expect(result.get("6")?.cumulativeWork).toBe(110 * MINUTE);
    expect(result.get("7")?.cumulativeWork).toBe(115 * MINUTE);

    // First 3 tasks fit in 60 minutes, rest don't
    expect(result.get("1")?.isAccomplishable).toBe(true);
    expect(result.get("2")?.isAccomplishable).toBe(true);
    expect(result.get("3")?.isAccomplishable).toBe(true);
    expect(result.get("4")?.isAccomplishable).toBe(false);
    expect(result.get("5")?.isAccomplishable).toBe(false);
    expect(result.get("6")?.isAccomplishable).toBe(false);
    expect(result.get("7")?.isAccomplishable).toBe(false);
  });
});
