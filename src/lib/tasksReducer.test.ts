import tasksReducer from "./tasksReducer";
import type Task from "../types/Task";
import { expect, test } from "vitest";

test("adds a new task to the list of tasks", () => {
  const tasks: Task[] = [];
  const newTasks = tasksReducer(tasks, {
    type: "ADD_TASK",
    args: { text: "hey" },
  });
  expect(newTasks.length).toBe(1);
  expect(newTasks[0].text).toBe("hey");
});
