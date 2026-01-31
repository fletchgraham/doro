import { describe, it, expect, vi } from "vitest";
import { calculateDropOrder } from "./calculateDropOrder";
import type Task from "../types/Task";

const createTestTask = (id: string, order: number): Task => ({
  id,
  text: `Task ${id}`,
  notes: "",
  events: [],
  status: "working",
  duration: 0,
  order,
});

describe("calculateDropOrder", () => {
  describe("empty list cases", () => {
    it("returns Date.now() for empty target list", () => {
      const now = Date.now();
      vi.setSystemTime(now);
      const result = calculateDropOrder([], 0, "moving-task");
      expect(result).toBe(now);
      vi.useRealTimers();
    });

    it("works when only task in list is the one being moved", () => {
      const now = Date.now();
      vi.setSystemTime(now);
      const tasks = [createTestTask("moving", 5000)];
      const result = calculateDropOrder(tasks, 0, "moving");
      expect(result).toBe(now);
      vi.useRealTimers();
    });
  });

  describe("beginning of list", () => {
    it("dropping at index 0 returns firstTask.order - 1000", () => {
      const tasks = [
        createTestTask("1", 5000),
        createTestTask("2", 6000),
        createTestTask("3", 7000),
      ];
      const result = calculateDropOrder(tasks, 0, "moving-task");
      expect(result).toBe(4000); // 5000 - 1000
    });

    it("works with single task in list", () => {
      const tasks = [createTestTask("1", 5000)];
      const result = calculateDropOrder(tasks, 0, "moving-task");
      expect(result).toBe(4000); // 5000 - 1000
    });

    it("works with multiple tasks in list", () => {
      const tasks = [
        createTestTask("1", 1000),
        createTestTask("2", 2000),
        createTestTask("3", 3000),
      ];
      const result = calculateDropOrder(tasks, 0, "moving-task");
      expect(result).toBe(0); // 1000 - 1000
    });
  });

  describe("end of list", () => {
    it("dropping at end returns lastTask.order + 1000", () => {
      const tasks = [
        createTestTask("1", 1000),
        createTestTask("2", 2000),
        createTestTask("3", 3000),
      ];
      const result = calculateDropOrder(tasks, 3, "moving-task");
      expect(result).toBe(4000); // 3000 + 1000
    });

    it("dropping past end (index > length) treated as end", () => {
      const tasks = [
        createTestTask("1", 1000),
        createTestTask("2", 2000),
      ];
      const result = calculateDropOrder(tasks, 100, "moving-task");
      expect(result).toBe(3000); // 2000 + 1000
    });
  });

  describe("between items", () => {
    it("returns average of adjacent task orders", () => {
      const tasks = [
        createTestTask("1", 1000),
        createTestTask("2", 3000),
        createTestTask("3", 5000),
      ];
      const result = calculateDropOrder(tasks, 1, "moving-task");
      expect(result).toBe(2000); // (1000 + 3000) / 2
    });

    it("works with varying order gaps (large gaps)", () => {
      const tasks = [
        createTestTask("1", 0),
        createTestTask("2", 10000),
      ];
      const result = calculateDropOrder(tasks, 1, "moving-task");
      expect(result).toBe(5000); // (0 + 10000) / 2
    });

    it("works with varying order gaps (small gaps)", () => {
      const tasks = [
        createTestTask("1", 1000),
        createTestTask("2", 1002),
      ];
      const result = calculateDropOrder(tasks, 1, "moving-task");
      expect(result).toBe(1001); // (1000 + 1002) / 2
    });

    it("handles fractional averages correctly", () => {
      const tasks = [
        createTestTask("1", 1000),
        createTestTask("2", 1001),
      ];
      const result = calculateDropOrder(tasks, 1, "moving-task");
      expect(result).toBe(1000.5); // (1000 + 1001) / 2
    });
  });

  describe("exclusion logic", () => {
    it("excludes the moving task from order calculations", () => {
      const tasks = [
        createTestTask("1", 1000),
        createTestTask("moving", 2000),
        createTestTask("3", 3000),
      ];
      // When moving task is excluded, list becomes [1000, 3000]
      // Dropping at index 1 should average 1000 and 3000
      const result = calculateDropOrder(tasks, 1, "moving");
      expect(result).toBe(2000); // (1000 + 3000) / 2
    });

    it("correct behavior when moving within same list - to beginning", () => {
      const tasks = [
        createTestTask("1", 1000),
        createTestTask("2", 2000),
        createTestTask("moving", 3000),
      ];
      // Moving task excluded, list is [1000, 2000]
      // Dropping at 0 means before first item
      const result = calculateDropOrder(tasks, 0, "moving");
      expect(result).toBe(0); // 1000 - 1000
    });

    it("correct behavior when moving within same list - to end", () => {
      const tasks = [
        createTestTask("moving", 1000),
        createTestTask("2", 2000),
        createTestTask("3", 3000),
      ];
      // Moving task excluded, list is [2000, 3000]
      // Dropping at end
      const result = calculateDropOrder(tasks, 3, "moving");
      expect(result).toBe(4000); // 3000 + 1000
    });

    it("correct behavior when moving within same list - between items", () => {
      const tasks = [
        createTestTask("1", 1000),
        createTestTask("moving", 2000),
        createTestTask("3", 3000),
        createTestTask("4", 4000),
      ];
      // Moving task excluded, list is [1000, 3000, 4000]
      // Dropping at index 2 (between 3000 and 4000)
      const result = calculateDropOrder(tasks, 2, "moving");
      expect(result).toBe(3500); // (3000 + 4000) / 2
    });
  });
});
