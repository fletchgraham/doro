import { describe, it, expect } from "vitest";
import { parseTime, formatEstimate } from "./parseTime";

describe("parseTime", () => {
  it("parses minutes with m suffix", () => {
    expect(parseTime("20m")).toBe(20 * 60 * 1000);
    expect(parseTime("45m")).toBe(45 * 60 * 1000);
    expect(parseTime("5m")).toBe(5 * 60 * 1000);
  });

  it("parses hours with h suffix", () => {
    expect(parseTime("3h")).toBe(3 * 60 * 60 * 1000);
    expect(parseTime("1h")).toBe(60 * 60 * 1000);
    expect(parseTime("8h")).toBe(8 * 60 * 60 * 1000);
  });

  it("parses combined hours and minutes", () => {
    expect(parseTime("1h30m")).toBe(90 * 60 * 1000);
    expect(parseTime("1h 30m")).toBe(90 * 60 * 1000);
    expect(parseTime("2h15m")).toBe(135 * 60 * 1000);
  });

  it("treats bare numbers as minutes", () => {
    expect(parseTime("90")).toBe(90 * 60 * 1000);
    expect(parseTime("30")).toBe(30 * 60 * 1000);
    expect(parseTime("5")).toBe(5 * 60 * 1000);
  });

  it("handles whitespace", () => {
    expect(parseTime("  20m  ")).toBe(20 * 60 * 1000);
    expect(parseTime("1h  30m")).toBe(90 * 60 * 1000);
  });

  it("is case insensitive", () => {
    expect(parseTime("20M")).toBe(20 * 60 * 1000);
    expect(parseTime("3H")).toBe(3 * 60 * 60 * 1000);
    expect(parseTime("1H30M")).toBe(90 * 60 * 1000);
  });

  it("returns null for empty input", () => {
    expect(parseTime("")).toBeNull();
    expect(parseTime("   ")).toBeNull();
  });

  it("returns null for invalid input", () => {
    expect(parseTime("invalid")).toBeNull();
    expect(parseTime("abc")).toBeNull();
    expect(parseTime("h")).toBeNull();
    expect(parseTime("m")).toBeNull();
  });

  it("handles decimal values", () => {
    expect(parseTime("1.5h")).toBe(90 * 60 * 1000);
    expect(parseTime("0.5h")).toBe(30 * 60 * 1000);
  });
});

describe("formatEstimate", () => {
  it("formats minutes only", () => {
    expect(formatEstimate(20 * 60 * 1000)).toBe("20m");
    expect(formatEstimate(45 * 60 * 1000)).toBe("45m");
  });

  it("formats hours only", () => {
    expect(formatEstimate(60 * 60 * 1000)).toBe("1h");
    expect(formatEstimate(3 * 60 * 60 * 1000)).toBe("3h");
  });

  it("formats hours and minutes", () => {
    expect(formatEstimate(90 * 60 * 1000)).toBe("1h 30m");
    expect(formatEstimate(135 * 60 * 1000)).toBe("2h 15m");
  });

  it("returns empty string for zero or undefined", () => {
    expect(formatEstimate(0)).toBe("");
    expect(formatEstimate(undefined)).toBe("");
  });

  it("rounds to nearest minute", () => {
    expect(formatEstimate(90 * 60 * 1000 + 30 * 1000)).toBe("1h 31m");
  });

  it("round-trips with parseTime", () => {
    const times = ["20m", "3h", "1h 30m", "45m", "2h"];
    for (const time of times) {
      const ms = parseTime(time);
      expect(formatEstimate(ms!)).toBe(time);
    }
  });
});
