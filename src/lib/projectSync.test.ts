import { expect, test } from "vitest";
import {
  dayTaskText,
  findDayTask,
  stripProjectPrefix,
  syncDayToProjects,
  syncProjectsToDay,
} from "./projectSync";
import { createTask } from "./tasksReducer";
import type Task from "../types/Task";
import type { ProjectsState } from "../types/Project";

const state: ProjectsState = {
  projects: [{ id: "p1", name: "Project X", order: 0, collapsed: false, archived: false }],
  tasks: [
    {
      id: "pt1",
      projectId: "p1",
      text: "do thing",
      notes: "shared",
      subtasks: [{ id: "s1", text: "step", done: false }],
      done: false,
      order: 0,
      points: 3,
    },
  ],
};

const linkedDayTask = (): Task => ({
  ...createTask(dayTaskText("Project X", "do thing")),
  notes: "shared",
  // The day copy gets its own copy of the list, so equality is structural
  subtasks: [{ id: "s1", text: "step", done: false }],
  projectTaskId: "pt1",
});

test("day task text carries the project name and can be stripped back", () => {
  expect(dayTaskText("Project X", "do thing")).toBe("Project X - do thing");
  expect(stripProjectPrefix("Project X - do thing", "Project X")).toBe("do thing");
  expect(stripProjectPrefix("do thing", "Project X")).toBe("do thing");
});

test("nothing to sync when the day task is unchanged or unlinked", () => {
  const day = linkedDayTask();
  expect(syncDayToProjects([day], [day], state)).toEqual([]);
  const plain = { ...createTask("plain"), status: "done" as const };
  expect(syncDayToProjects([createTask("plain")], [plain], state)).toEqual([]);
  // Newly assigned tasks are already in sync
  expect(syncDayToProjects([], [day], state)).toEqual([]);
});

test("completing, un-completing and note edits flow to the project task", () => {
  const day = linkedDayTask();
  const done = { ...day, status: "done" as const, notes: "more" };
  expect(syncDayToProjects([day], [done], state)).toEqual([
    { type: "SET_TASK_NOTES", taskId: "pt1", notes: "more" },
    { type: "SET_TASK_DONE", taskId: "pt1", done: true },
  ]);

  const doneState: ProjectsState = {
    ...state,
    tasks: [{ ...state.tasks[0], done: true }],
  };
  const reopened = { ...done, status: "working" as const };
  expect(syncDayToProjects([done], [reopened], doneState)).toEqual([
    { type: "SET_TASK_DONE", taskId: "pt1", done: false },
  ]);
  // Moving between working and ready isn't a completion change
  expect(
    syncDayToProjects([reopened], [{ ...reopened, status: "ready" }], state)
  ).toEqual([]);
});

test("renaming a day task drops the project prefix", () => {
  const day = linkedDayTask();
  const renamed = { ...day, text: "Project X - do other thing" };
  expect(syncDayToProjects([day], [renamed], state)).toEqual([
    { type: "SET_TASK_TEXT", taskId: "pt1", text: "do other thing" },
  ]);
  const noPrefix = { ...day, text: "loose" };
  expect(syncDayToProjects([day], [noPrefix], state)).toEqual([
    { type: "SET_TASK_TEXT", taskId: "pt1", text: "loose" },
  ]);
  // Only the prefix is not a rename
  const emptied = { ...day, text: "Project X - " };
  expect(syncDayToProjects([day], [emptied], state)).toEqual([]);
});

test("changes already present in the project are not echoed back", () => {
  const day = linkedDayTask();
  const done = { ...day, status: "done" as const };
  const doneState: ProjectsState = {
    ...state,
    tasks: [{ ...state.tasks[0], done: true }],
  };
  expect(syncDayToProjects([day], [done], doneState)).toEqual([]);
});

test("day tasks pointing at a deleted project task are left alone", () => {
  const day = linkedDayTask();
  const done = { ...day, status: "done" as const };
  expect(syncDayToProjects([day], [done], { ...state, tasks: [] })).toEqual([]);
  expect(syncProjectsToDay({ ...state, tasks: [] }, [done])).toEqual([]);
});

test("project changes are pushed to the linked day task", () => {
  const day = linkedDayTask();
  expect(syncProjectsToDay(state, [day])).toEqual([]);

  const changed: ProjectsState = {
    projects: [{ ...state.projects[0], name: "Renamed" }],
    tasks: [{ ...state.tasks[0], text: "new text", notes: "n2", done: true }],
  };
  expect(syncProjectsToDay(changed, [day, createTask("plain")])).toEqual([
    { task: day, text: "Renamed - new text", notes: "n2", done: true },
  ]);

  const doneDay = { ...day, status: "done" as const };
  expect(syncProjectsToDay(state, [doneDay])).toEqual([
    { task: doneDay, done: false },
  ]);
});

test("finds the day task standing in for a project task", () => {
  const day = linkedDayTask();
  expect(findDayTask([createTask("x"), day], "pt1")).toBe(day);
  expect(findDayTask([createTask("x")], "pt1")).toBeUndefined();
});

test("subtask changes on the day task flow to the project task", () => {
  const day = linkedDayTask();
  const ticked = {
    ...day,
    subtasks: [{ id: "s1", text: "step", done: true }],
  };
  expect(syncDayToProjects([day], [ticked], state)).toEqual([
    { type: "SET_SUBTASKS", taskId: "pt1", subtasks: ticked.subtasks },
  ]);
  // A fresh but identical array is not a change
  const copied = { ...day, subtasks: day.subtasks.map((s) => ({ ...s })) };
  expect(syncDayToProjects([day], [copied], state)).toEqual([]);
  // Already mirrored in the project: nothing to echo back
  const tickedState: ProjectsState = {
    ...state,
    tasks: [{ ...state.tasks[0], subtasks: ticked.subtasks }],
  };
  expect(syncDayToProjects([day], [ticked], tickedState)).toEqual([]);
});

test("project subtask changes are pushed to the linked day task", () => {
  const day = linkedDayTask();
  const reordered: ProjectsState = {
    ...state,
    tasks: [
      {
        ...state.tasks[0],
        subtasks: [
          { id: "s2", text: "new first", done: false },
          { id: "s1", text: "step", done: true },
        ],
      },
    ],
  };
  expect(syncProjectsToDay(reordered, [day])).toEqual([
    { task: day, subtasks: reordered.tasks[0].subtasks },
  ]);
  expect(syncProjectsToDay(state, [day])).toEqual([]);
});
