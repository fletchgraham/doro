import { expect, test } from "vitest";
import {
  addSubtask,
  moveSubtask,
  normalizeSubtasks,
  removeSubtask,
  sameSubtasks,
  setSubtaskDone,
  setSubtaskText,
  subtaskProgress,
} from "./subtasks";
import type Subtask from "../types/Subtask";

const list: Subtask[] = [
  { id: "a", text: "one", done: false },
  { id: "b", text: "two", done: true },
  { id: "c", text: "three", done: false },
];

test("adds at the bottom, unchecked", () => {
  const next = addSubtask(list, "four");
  expect(next.map((s) => s.text)).toEqual(["one", "two", "three", "four"]);
  expect(next[3].done).toBe(false);
  expect(next[3].id).toBeTruthy();
});

test("renames and checks by id without touching the others", () => {
  expect(setSubtaskText(list, "b", "TWO")[1]).toEqual({
    id: "b",
    text: "TWO",
    done: true,
  });
  expect(setSubtaskDone(list, "a", true)[0].done).toBe(true);
  expect(setSubtaskDone(list, "b", false)[1].done).toBe(false);
  expect(setSubtaskText(list, "zzz", "x")).toEqual(list);
});

test("moves to an index, clamped to the list", () => {
  const ids = (l: Subtask[]) => l.map((s) => s.id);
  expect(ids(moveSubtask(list, "c", 0))).toEqual(["c", "a", "b"]);
  expect(ids(moveSubtask(list, "a", 2))).toEqual(["b", "c", "a"]);
  expect(ids(moveSubtask(list, "a", 1))).toEqual(["b", "a", "c"]);
  expect(ids(moveSubtask(list, "a", 99))).toEqual(["b", "c", "a"]);
  expect(ids(moveSubtask(list, "c", -5))).toEqual(["c", "a", "b"]);
  // No-ops return the same array
  expect(moveSubtask(list, "b", 1)).toBe(list);
  expect(moveSubtask(list, "nope", 0)).toBe(list);
});

test("removes by id", () => {
  expect(removeSubtask(list, "b").map((s) => s.id)).toEqual(["a", "c"]);
});

test("compares structurally", () => {
  expect(sameSubtasks(list, list.map((s) => ({ ...s })))).toBe(true);
  expect(sameSubtasks(list, setSubtaskDone(list, "a", true))).toBe(false);
  expect(sameSubtasks(list, moveSubtask(list, "c", 0))).toBe(false);
  expect(sameSubtasks(list, list.slice(1))).toBe(false);
  expect(sameSubtasks([], [])).toBe(true);
});

test("counts progress", () => {
  expect(subtaskProgress(list)).toEqual({ done: 1, total: 3 });
  expect(subtaskProgress([])).toEqual({ done: 0, total: 0 });
});

test("normalizes persisted data, dropping junk and duplicates", () => {
  expect(normalizeSubtasks(undefined)).toEqual([]);
  expect(normalizeSubtasks("nope")).toEqual([]);
  expect(
    normalizeSubtasks([
      { id: "a", text: "one", done: true },
      { id: "b", text: "two" },
      { id: "a", text: "dup", done: false },
      { text: "no id" },
      null,
      { id: 3, text: "numeric id" },
    ])
  ).toEqual([
    { id: "a", text: "one", done: true },
    { id: "b", text: "two", done: false },
  ]);
});
