import tasksReducer from "./tasksReducer";
import { createTask } from "./tasksReducer";
import type Task from "../types/Task";
import { expect, test } from "vitest";

test("adds a new task to the list of tasks", () => {
  const tasks: Task[] = [];
  const newTasks = tasksReducer(tasks, {
    type: "ADD_TASK",
    text: "hey",
  });
  expect(newTasks.length).toBe(1);
  expect(newTasks[0].text).toBe("hey");
});

test("remove a task", () => {
  const tasks: Task[] = [
    createTask("foo"),
    createTask("bar"),
    createTask("baz"),
  ];

  const newTasks = tasksReducer(tasks, {
    type: "REMOVE_TASK",
    taskId: tasks[1].id,
  });

  expect(newTasks[0].text).toBe("foo");
  expect(newTasks[1].text).toBe("baz");
  expect(newTasks.length).toBe(2);
});

test("next task moves active task to working bucket and activates next working task", () => {
  const tasks: Task[] = [
    { ...createTask("foo"), active: true, status: "working", order: 1000 },
    { ...createTask("bar"), status: "working", order: 2000 },
    { ...createTask("baz"), status: "working", order: 3000 },
  ];

  const updated = tasksReducer(tasks, { type: "NEXT_TASK" });

  // foo should be moved to end of working with highest order
  const fooTask = updated.find((t) => t.text === "foo");
  expect(fooTask?.active).toBe(false);
  expect(fooTask?.status).toBe("working");

  // bar should become active (it was first in working bucket after foo)
  const barTask = updated.find((t) => t.text === "bar");
  expect(barTask?.active).toBe(true);
});
