export interface ColorGoal {
  color: string;
  target: number; // ms
}

/**
 * Fractions for rendering a goal bar of fixed length. Until the goal is met
 * the bar represents the target, so `fill` is worked/target and `over` is 0.
 * Once the goal is exceeded the full bar represents the accumulated time
 * instead: `fill` is the goal's share of it and `over` the excess share, so
 * the two always sum to the whole bar and the overflow only approaches
 * (never reaches) the full width.
 */
export const goalBarFractions = (
  worked: number,
  target: number
): { fill: number; over: number } => {
  if (target <= 0) return { fill: 0, over: 0 };
  const clamped = Math.max(worked, 0);
  if (clamped <= target) return { fill: clamped / target, over: 0 };
  return { fill: target / clamped, over: (clamped - target) / clamped };
};

export const loadGoals = (): ColorGoal[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem("doroColorGoals") || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (g): g is ColorGoal =>
        g != null &&
        typeof g.color === "string" &&
        typeof g.target === "number" &&
        g.target > 0
    );
  } catch {
    return [];
  }
};
