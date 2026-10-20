import { useEffect, useState } from "react";
import { todayKey } from "../lib/dates";

// Today's date key, rolling over at local midnight. Timers in a hidden
// tab can be frozen past midnight, so waking up re-checks it as well.
export default function useToday(): string {
  const [today, setToday] = useState(todayKey);

  useEffect(() => {
    const check = () => setToday(todayKey());
    const now = new Date();
    const midnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1
    );
    const timeout = setTimeout(check, midnight.getTime() - now.getTime() + 50);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [today]);

  return today;
}
