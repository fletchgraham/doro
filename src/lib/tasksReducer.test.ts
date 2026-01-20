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

test("next task moves active to end of list, sets it inactive, then sets new 0 to active", () => {
  const tasks: Task[] = [
    createTask("foo"),
    createTask("bar"),
    createTask("baz"),
  ];
  tasks[0].active = true;
  const updated = tasksReducer(tasks, {
    type: "NEXT_TASK",
  });
  expect(updated[0].active).toBe(true);
  expect(updated[0].text).toBe("bar");
  expect(updated[2].active).toBe(false);
  expect(updated[2].text).toBe("foo");
});
