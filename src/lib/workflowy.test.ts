import { expect, test } from "vitest";
import {
  getWorkflowyNodeUrl,
  matchesShortId,
  nodeToTaskData,
  parseParentInput,
  stripLegacyNoteMarker,
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

test("stripLegacyNoteMarker drops the old doro time marker line", () => {
  expect(stripLegacyNoteMarker("⏱ 1h 23m — doro\nmy notes\nsecond line")).toBe(
    "my notes\nsecond line"
  );
  expect(stripLegacyNoteMarker("⏱ 25m — doro")).toBe("");
  expect(stripLegacyNoteMarker("⏱ 2h — doro\n")).toBe("");
});

test("stripLegacyNoteMarker passes notes without a marker through unchanged", () => {
  expect(stripLegacyNoteMarker("plain workflowy note")).toBe(
    "plain workflowy note"
  );
  expect(stripLegacyNoteMarker("notes first\n⏱ 5m — doro")).toBe(
    "notes first\n⏱ 5m — doro"
  );
  expect(stripLegacyNoteMarker(null)).toBe("");
  expect(stripLegacyNoteMarker(undefined)).toBe("");
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
  });
});

test("nodeToTaskData keeps plain notes and marks open nodes incomplete", () => {
  const data = nodeToTaskData({
    id: "1a2b3c4d-5e6f-7081-92a3-b4c5d6e7f809",
    name: "Call the bank",
    note: "ask about the fee",
    completedAt: null,
  });
  expect(data.notes).toBe("ask about the fee");
  expect(data.completed).toBe(false);
});
