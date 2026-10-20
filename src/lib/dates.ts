// Days are addressed by local-calendar keys ("2026-10-19"), so a task
// belongs to the day it was planned for wherever the clock's timezone
// puts midnight. Keys sort and compare as plain strings.

const pad = (n: number) => String(n).padStart(2, "0");

export const toDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const todayKey = (): string => toDateKey(new Date());

export const parseDateKey = (key: string): Date => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const isDateKey = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value);

export const addDays = (key: string, days: number): string => {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};

// Weeks start on Monday
export const startOfWeek = (key: string): string => {
  const offset = (parseDateKey(key).getDay() + 6) % 7;
  return addDays(key, -offset);
};

export const weekDays = (monday: string): string[] =>
  Array.from({ length: 7 }, (_, i) => addDays(monday, i));

// "Monday, Oct 19"
export const formatDay = (key: string): string =>
  parseDateKey(key).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

// "Oct 19 – 25, 2026", "Oct 26 – Nov 1, 2026" or, across a year,
// "Dec 28, 2026 – Jan 3, 2027"
export const formatWeekRange = (monday: string): string => {
  const start = parseDateKey(monday);
  const end = parseDateKey(addDays(monday, 6));
  const month = (date: Date) =>
    date.toLocaleDateString(undefined, { month: "short" });
  const startText = `${month(start)} ${start.getDate()}`;
  const endText = `${end.getDate()}, ${end.getFullYear()}`;
  if (start.getFullYear() !== end.getFullYear()) {
    return `${startText}, ${start.getFullYear()} – ${month(end)} ${endText}`;
  }
  if (start.getMonth() !== end.getMonth()) {
    return `${startText} – ${month(end)} ${endText}`;
  }
  return `${startText} – ${endText}`;
};
