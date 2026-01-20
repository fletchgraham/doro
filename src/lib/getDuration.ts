const getDuration = (
  events: { eventType: string; timestamp: number }[],
): number => {
  let total = 0;
  let curStart: number | null = null;

  for (const event of events) {
    if (event.eventType === "start") {
      curStart = event.timestamp;
    }

    if (curStart && event.eventType === "stop") {
      total += event.timestamp - curStart;
      curStart = null;
    }
  }

  return total;
};

export default getDuration;
