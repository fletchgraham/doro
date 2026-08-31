import { describe, it, expect } from "vitest";
import { goalBarFractions } from "./colorGoals";

const HOUR = 60 * 60 * 1000;

describe("goalBarFractions", () => {
  it("is empty with no time worked", () => {
    expect(goalBarFractions(0, HOUR)).toEqual({ fill: 0, over: 0 });
  });

  it("fills proportionally under the goal", () => {
    expect(goalBarFractions(HOUR / 2, HOUR)).toEqual({ fill: 0.5, over: 0 });
  });

  it("fills exactly at the goal with no overage", () => {
    expect(goalBarFractions(HOUR, HOUR)).toEqual({ fill: 1, over: 0 });
  });

  it("splits the bar as shares of accumulated time once over the goal", () => {
    expect(goalBarFractions(1.5 * HOUR, HOUR)).toEqual({
      fill: 1 / 1.5,
      over: 0.5 / 1.5,
    });
    expect(goalBarFractions(2 * HOUR, HOUR)).toEqual({ fill: 0.5, over: 0.5 });
  });

  it("never lets overage take the whole bar", () => {
    const { fill, over } = goalBarFractions(10 * HOUR, HOUR);
    expect(fill).toBeCloseTo(0.1);
    expect(over).toBeCloseTo(0.9);
    expect(fill + over).toBeCloseTo(1);
  });

  it("handles a zero or negative target without dividing by zero", () => {
    expect(goalBarFractions(HOUR, 0)).toEqual({ fill: 0, over: 0 });
    expect(goalBarFractions(HOUR, -1)).toEqual({ fill: 0, over: 0 });
  });

  it("clamps negative worked time to zero", () => {
    expect(goalBarFractions(-HOUR, HOUR)).toEqual({ fill: 0, over: 0 });
  });
});
