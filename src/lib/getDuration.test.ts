import { expect, test } from "vitest";
import getDuration from "./getDuration";

test("it works", () => {
  const events = [
    { eventType: "start", timestamp: 5 },
    { eventType: "stop", timestamp: 10 },
  ];
  const dur = getDuration(events);

  expect(dur).toBe(5);
});
