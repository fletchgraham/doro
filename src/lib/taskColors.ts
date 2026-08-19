// Task colors (Tailwind 400-level). The hex values carry identity across
// the app — tasks store the hex directly.
export const TASK_COLORS = [
  { name: "gray", hex: "#9ca3af" },
  { name: "red", hex: "#f87171" },
  { name: "orange", hex: "#fb923c" },
  { name: "yellow", hex: "#facc15" },
  { name: "green", hex: "#4ade80" },
  { name: "blue", hex: "#60a5fa" },
  { name: "purple", hex: "#c084fc" },
];

// Tasks with no color set are treated as gray everywhere time is
// aggregated by color.
export const DEFAULT_COLOR = "#9ca3af";

export const colorLabel = (hex: string): string => {
  const found = TASK_COLORS.find((c) => c.hex === hex);
  return found ? found.name.charAt(0).toUpperCase() + found.name.slice(1) : hex;
};
