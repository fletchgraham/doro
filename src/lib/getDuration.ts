const getDuration = (
  events: { eventType: string; timestamp: number; duration?: number }[],
): number => {
  let total = 0;
  let curStart: number | null = null;

  for (const event of events) {
    if (event.eventType === "duration_override") {
      total = event.duration ?? 0;
      // If there was an active session, restart it from the override timestamp
      // so time after the override continues to accumulate
      curStart = curStart !== null ? event.timestamp : null;
      continue;
    }

    if (event.eventType === "start") {
      curStart = event.timestamp;
    }

    if (curStart !== null && event.eventType === "stop") {
      total += event.timestamp - curStart;
      curStart = null;
    }
  }

  return total;
};

/**
 * Like getDuration, but also accounts for an open (unfinished) start session
 * by treating `now` as the current stop time.
 */
export const getLiveDuration = (
  events: { eventType: string; timestamp: number; duration?: number }[],
  now: number = Date.now(),
): number => {
  let total = 0;
  let curStart: number | null = null;

  for (const event of events) {
    if (event.eventType === "duration_override") {
      total = event.duration ?? 0;
      curStart = curStart !== null ? event.timestamp : null;
      continue;
    }

    if (event.eventType === "start") {
      curStart = event.timestamp;
    }

    if (curStart !== null && event.eventType === "stop") {
      total += event.timestamp - curStart;
      curStart = null;
    }
  }

  if (curStart !== null) {
    total += now - curStart;
  }

  return total;
};

export default getDuration;
