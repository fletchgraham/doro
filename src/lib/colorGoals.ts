export interface ColorGoal {
  color: string;
  target: number; // ms
}

/**
 * Fractions for rendering a goal bar of fixed length. `fill` is how much of
 * the bar shows the goal color; `over` is how much of the right end turns
 * red once the goal is exceeded. The bar never grows past its full length,
 * so the red portion is scaled to the goal and caps at the whole bar once
 * you're a full goal's worth over (2x the target).
 */
export const goalBarFractions = (
  worked: number,
  target: number
): { fill: number; over: number } => {
  if (target <= 0) return { fill: 0, over: 0 };
  const fill = Math.min(Math.max(worked, 0) / target, 1);
  const over = worked > target ? Math.min((worked - target) / target, 1) : 0;
  return { fill, over };
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
