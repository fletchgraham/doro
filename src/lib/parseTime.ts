/**
 * Parse a time string like "20m", "3h", "1h30m" into milliseconds.
 * Bare numbers are treated as minutes.
 * Returns null if the input cannot be parsed.
 */
export function parseTime(input: string): number | null {
  if (!input || typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  // Try to match hours and minutes pattern: "1h30m", "1h 30m", "2h", "45m"
  const hoursMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*h/);
  const minutesMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*m/);

  if (hoursMatch || minutesMatch) {
    const hours = hoursMatch ? parseFloat(hoursMatch[1]) : 0;
    const minutes = minutesMatch ? parseFloat(minutesMatch[1]) : 0;
    return (hours * 60 + minutes) * 60 * 1000;
  }

  // Bare number = minutes
  const bareNumber = parseFloat(trimmed);
  if (!isNaN(bareNumber) && bareNumber >= 0) {
    return bareNumber * 60 * 1000;
  }

  return null;
}

/**
 * Format milliseconds as a readable time string like "1h 30m" or "45m".
 * Returns empty string for 0 or undefined.
 */
export function formatEstimate(ms: number | undefined): string {
  if (!ms || ms <= 0) {
    return "";
  }

  const totalMinutes = Math.round(ms / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${minutes}m`;
  }
}
