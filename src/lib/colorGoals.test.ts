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

  it("caps fill at 1 and shows overage scaled to the goal", () => {
    expect(goalBarFractions(1.5 * HOUR, HOUR)).toEqual({ fill: 1, over: 0.5 });
  });

  it("caps overage at the full bar once a whole goal over", () => {
    expect(goalBarFractions(3 * HOUR, HOUR)).toEqual({ fill: 1, over: 1 });
  });

  it("handles a zero or negative target without dividing by zero", () => {
    expect(goalBarFractions(HOUR, 0)).toEqual({ fill: 0, over: 0 });
    expect(goalBarFractions(HOUR, -1)).toEqual({ fill: 0, over: 0 });
  });

  it("clamps negative worked time to zero", () => {
    expect(goalBarFractions(-HOUR, HOUR)).toEqual({ fill: 0, over: 0 });
  });
});
