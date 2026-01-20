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

test("one start event", () => {
  const events = [{ eventType: "start", timestamp: 5 }];

  expect(getDuration(events)).toBe(0);
});

test("one stop event", () => {
  const events = [{ eventType: "stop", timestamp: 5 }];

  expect(getDuration(events)).toBe(0);
});

test("ignore multiple stops", () => {
  const events = [
    { eventType: "start", timestamp: 5 },
    { eventType: "stop", timestamp: 10 },
    { eventType: "stop", timestamp: 12 },
    { eventType: "stop", timestamp: 13 },
    { eventType: "start", timestamp: 14 },
  ];
  expect(getDuration(events)).toBe(5);
});

test("many normal open and closed starts and stops", () => {
  const events = [
    { eventType: "start", timestamp: 5 },
    { eventType: "stop", timestamp: 10 },
    { eventType: "start", timestamp: 12 },
    { eventType: "stop", timestamp: 13 },
    { eventType: "start", timestamp: 14 },
    { eventType: "stop", timestamp: 17 },
  ];
  expect(getDuration(events)).toBe(9);
});

test("ignore multiple starts", () => {
  const events = [
    { eventType: "start", timestamp: 5 },
    { eventType: "start", timestamp: 10 },
    { eventType: "start", timestamp: 12 },
    { eventType: "stop", timestamp: 15 },
  ];
  expect(getDuration(events)).toBe(3);
});

test("no events", () => expect(getDuration([])).toBe(0));
