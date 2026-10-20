import { expect, test } from "vitest";
import {
  addDays,
  formatWeekRange,
  isDateKey,
  parseDateKey,
  startOfWeek,
  toDateKey,
  weekDays,
} from "./dates";

test("date keys use the local calendar date", () => {
  expect(toDateKey(new Date(2026, 9, 5, 23, 59))).toBe("2026-10-05");
  expect(toDateKey(parseDateKey("2026-01-31"))).toBe("2026-01-31");
});

test("addDays crosses months and years", () => {
  expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  expect(addDays("2026-10-19", 0)).toBe("2026-10-19");
});

test("weeks start on Monday", () => {
  expect(startOfWeek("2026-10-19")).toBe("2026-10-19"); // Monday
  expect(startOfWeek("2026-10-21")).toBe("2026-10-19"); // Wednesday
  expect(startOfWeek("2026-10-25")).toBe("2026-10-19"); // Sunday
  expect(startOfWeek("2027-01-01")).toBe("2026-12-28"); // across a year
});

test("weekDays lists Monday to Sunday", () => {
  expect(weekDays("2026-10-19")).toEqual([
    "2026-10-19",
    "2026-10-20",
    "2026-10-21",
    "2026-10-22",
    "2026-10-23",
    "2026-10-24",
    "2026-10-25",
  ]);
});

test("isDateKey tells date keys from other ids", () => {
  expect(isDateKey("2026-10-19")).toBe(true);
  expect(isDateKey("working")).toBe(false);
  expect(isDateKey("5f0c-uuid")).toBe(false);
});

test("week ranges read naturally within and across months and years", () => {
  expect(formatWeekRange("2026-10-19")).toBe("Oct 19 – 25, 2026");
  expect(formatWeekRange("2026-10-26")).toBe("Oct 26 – Nov 1, 2026");
  expect(formatWeekRange("2026-12-28")).toBe("Dec 28, 2026 – Jan 3, 2027");
});
