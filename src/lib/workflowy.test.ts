import { expect, test } from "vitest";
import {
  formatNoteWithDuration,
  getWorkflowyNodeUrl,
  matchesShortId,
  nodeToTaskData,
  parseNoteDuration,
  parseParentInput,
} from "./workflowy";

test("parseParentInput accepts a full node UUID", () => {
  expect(
    parseParentInput("1A2B3C4D-5E6F-7081-92A3-B4C5D6E7F809")
  ).toEqual({ kind: "uuid", id: "1a2b3c4d-5e6f-7081-92a3-b4c5d6e7f809" });
});

test("parseParentInput accepts a workflowy internal link", () => {
  expect(
    parseParentInput("https://workflowy.com/#/abc123def456")
  ).toEqual({ kind: "short", shortId: "abc123def456" });
  expect(
    parseParentInput("https://beta.workflowy.com/#/ABC123DEF456?q=x")
  ).toEqual({ kind: "short", shortId: "abc123def456" });
});

test("parseParentInput accepts a bare short id", () => {
  expect(parseParentInput("abc123def456")).toEqual({
    kind: "short",
    shortId: "abc123def456",
  });
});

test("parseParentInput rejects garbage", () => {
  expect(parseParentInput("")).toBeNull();
  expect(parseParentInput("not a node")).toBeNull();
  expect(parseParentInput("https://workflowy.com/")).toBeNull();
});

test("getWorkflowyNodeUrl uses the last 12 hex chars of the UUID", () => {
  expect(getWorkflowyNodeUrl("1a2b3c4d-5e6f-7081-92a3-b4c5d6e7f809")).toBe(
    "https://workflowy.com/#/b4c5d6e7f809"
  );
});

test("matchesShortId compares against the dashless UUID suffix", () => {
  const id = "1a2b3c4d-5e6f-7081-92a3-b4c5d6e7f809";
  expect(matchesShortId(id, "b4c5d6e7f809")).toBe(true);
  expect(matchesShortId(id, "B4C5D6E7F809")).toBe(true);
  expect(matchesShortId(id, "000000000000")).toBe(false);
});

test("note duration marker round-trips", () => {
  const note = formatNoteWithDuration("my notes\nsecond line", 83 * 60 * 1000);
  expect(note).toBe("⏱ 1h 23m — doro\nmy notes\nsecond line");
  expect(parseNoteDuration(note)).toEqual({
    durationMs: 83 * 60 * 1000,
    notes: "my notes\nsecond line",
  });
});

test("note marker handles minutes-only and hours-only durations", () => {
  expect(parseNoteDuration(formatNoteWithDuration("", 25 * 60 * 1000))).toEqual(
    { durationMs: 25 * 60 * 1000, notes: "" }
  );
  expect(parseNoteDuration(formatNoteWithDuration("", 2 * 3600 * 1000))).toEqual(
    { durationMs: 2 * 3600 * 1000, notes: "" }
  );
});

test("sub-minute durations write no marker", () => {
  expect(formatNoteWithDuration("just notes", 0)).toBe("just notes");
  expect(formatNoteWithDuration("", 0)).toBe("");
  expect(formatNoteWithDuration("just notes", 45 * 1000)).toBe("just notes");
});

test("notes without a marker are passed through unchanged", () => {
  expect(parseNoteDuration("plain workflowy note")).toEqual({
    durationMs: 0,
    notes: "plain workflowy note",
  });
  expect(parseNoteDuration(null)).toEqual({ durationMs: 0, notes: "" });
});

test("nodeToTaskData maps workflowy fields and strips inline tags", () => {
  const data = nodeToTaskData({
    id: "1a2b3c4d-5e6f-7081-92a3-b4c5d6e7f809",
    name: "Write <b>report</b>",
    note: "⏱ 45m — doro\ndetails here",
    completedAt: 1700000000,
  });
  expect(data).toEqual({
    workflowyId: "1a2b3c4d-5e6f-7081-92a3-b4c5d6e7f809",
    text: "Write report",
    notes: "details here",
    url: "https://workflowy.com/#/b4c5d6e7f809",
    completed: true,
    durationMs: 45 * 60 * 1000,
  });
});
