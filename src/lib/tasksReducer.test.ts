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
    { ...createTask("foo"), status: "active", order: 1000 },
    { ...createTask("bar"), status: "working", order: 2000 },
    { ...createTask("baz"), status: "working", order: 3000 },
  ];

  const updated = tasksReducer(tasks, { type: "NEXT_TASK" });

  // foo should be moved to end of working with highest order
  const fooTask = updated.find((t) => t.text === "foo");
  expect(fooTask?.status).toBe("working");

  // bar should become active (it was first in working bucket after foo)
  const barTask = updated.find((t) => t.text === "bar");
  expect(barTask?.status).toBe("active");
});

test("add task with options as active moves current active to working", () => {
  const tasks: Task[] = [
    { ...createTask("current"), status: "active", order: 1000 },
    { ...createTask("waiting"), status: "working", order: 2000 },
  ];

  const updated = tasksReducer(tasks, {
    type: "ADD_TASK_WITH_OPTIONS",
    text: "new task",
    status: "active",
    position: "bottom",
  });

  // New task should be active
  const newTask = updated.find((t) => t.text === "new task");
  expect(newTask?.status).toBe("active");

  // Old active task should be moved to working
  const currentTask = updated.find((t) => t.text === "current");
  expect(currentTask?.status).toBe("working");

  expect(updated.length).toBe(3);
});

test("SET_STATUS to active should move current active task to working", () => {
  const tasks: Task[] = [
    { ...createTask("current active"), status: "active", order: 1000 },
    { ...createTask("task to switch to"), status: "working", order: 2000 },
    { ...createTask("another working"), status: "working", order: 3000 },
  ];

  const updated = tasksReducer(tasks, {
    type: "SET_STATUS",
    taskId: tasks[1].id,
    status: "active",
  });

  // The switched-to task should be active
  const switchedTask = updated.find((t) => t.text === "task to switch to");
  expect(switchedTask?.status).toBe("active");

  // The previously active task should be moved to working
  const previousActive = updated.find((t) => t.text === "current active");
  expect(previousActive?.status).toBe("working");

  // There should only be one active task
  const activeTasks = updated.filter((t) => t.status === "active");
  expect(activeTasks.length).toBe(1);

  // All tasks should still exist
  expect(updated.length).toBe(3);
});

test("SET_STATUS to active when no current active task", () => {
  const tasks: Task[] = [
    { ...createTask("task one"), status: "working", order: 1000 },
    { ...createTask("task two"), status: "ready", order: 2000 },
  ];

  const updated = tasksReducer(tasks, {
    type: "SET_STATUS",
    taskId: tasks[0].id,
    status: "active",
  });

  // The task should become active
  const activeTask = updated.find((t) => t.text === "task one");
  expect(activeTask?.status).toBe("active");

  // There should only be one active task
  const activeTasks = updated.filter((t) => t.status === "active");
  expect(activeTasks.length).toBe(1);

  // All tasks should still exist
  expect(updated.length).toBe(2);
});

test("switching tasks multiple times preserves all tasks", () => {
  const tasks: Task[] = [
    { ...createTask("task A"), status: "active", order: 1000 },
    { ...createTask("task B"), status: "working", order: 2000 },
    { ...createTask("task C"), status: "working", order: 3000 },
  ];

  // Switch to task B
  let updated = tasksReducer(tasks, {
    type: "SET_STATUS",
    taskId: tasks[1].id,
    status: "active",
  });

  expect(updated.length).toBe(3);
  expect(updated.filter((t) => t.status === "active").length).toBe(1);
  expect(updated.find((t) => t.text === "task B")?.status).toBe("active");

  // Switch to task C
  updated = tasksReducer(updated, {
    type: "SET_STATUS",
    taskId: tasks[2].id,
    status: "active",
  });

  expect(updated.length).toBe(3);
  expect(updated.filter((t) => t.status === "active").length).toBe(1);
  expect(updated.find((t) => t.text === "task C")?.status).toBe("active");

  // Switch back to task A
  updated = tasksReducer(updated, {
    type: "SET_STATUS",
    taskId: tasks[0].id,
    status: "active",
  });

  expect(updated.length).toBe(3);
  expect(updated.filter((t) => t.status === "active").length).toBe(1);
  expect(updated.find((t) => t.text === "task A")?.status).toBe("active");
});

// MOVE_TASK tests

test("MOVE_TASK moves task to new status with specified order", () => {
  const tasks: Task[] = [
    { ...createTask("task A"), status: "working", order: 1000 },
    { ...createTask("task B"), status: "working", order: 2000 },
  ];

  const updated = tasksReducer(tasks, {
    type: "MOVE_TASK",
    taskId: tasks[0].id,
    toStatus: "ready",
    newOrder: 5000,
  });

  const movedTask = updated.find((t) => t.text === "task A");
  expect(movedTask?.status).toBe("ready");
  expect(movedTask?.order).toBe(5000);
});

test("MOVE_TASK preserves all other task properties", () => {
  const tasks: Task[] = [
    {
      ...createTask("task A"),
      status: "working",
      order: 1000,
      notes: "some notes",
      estimate: 30000,
      projectId: "project-123",
    },
  ];

  const updated = tasksReducer(tasks, {
    type: "MOVE_TASK",
    taskId: tasks[0].id,
    toStatus: "ready",
    newOrder: 5000,
  });

  const movedTask = updated.find((t) => t.text === "task A");
  expect(movedTask?.notes).toBe("some notes");
  expect(movedTask?.estimate).toBe(30000);
  expect(movedTask?.projectId).toBe("project-123");
});

test("MOVE_TASK does not affect other tasks", () => {
  const tasks: Task[] = [
    { ...createTask("task A"), status: "working", order: 1000 },
    { ...createTask("task B"), status: "working", order: 2000 },
    { ...createTask("task C"), status: "ready", order: 3000 },
  ];

  const updated = tasksReducer(tasks, {
    type: "MOVE_TASK",
    taskId: tasks[0].id,
    toStatus: "ready",
    newOrder: 5000,
  });

  const taskB = updated.find((t) => t.text === "task B");
  const taskC = updated.find((t) => t.text === "task C");
  expect(taskB?.status).toBe("working");
  expect(taskB?.order).toBe(2000);
  expect(taskC?.status).toBe("ready");
  expect(taskC?.order).toBe(3000);
});

test("MOVE_TASK cross-list: Working to Ready", () => {
  const tasks: Task[] = [
    { ...createTask("task A"), status: "working", order: 1000 },
  ];

  const updated = tasksReducer(tasks, {
    type: "MOVE_TASK",
    taskId: tasks[0].id,
    toStatus: "ready",
    newOrder: 5000,
  });

  const task = updated.find((t) => t.text === "task A");
  expect(task?.status).toBe("ready");
  expect(task?.order).toBe(5000);
});

test("MOVE_TASK cross-list: Ready to Done", () => {
  const tasks: Task[] = [
    { ...createTask("task A"), status: "ready", order: 1000 },
  ];

  const updated = tasksReducer(tasks, {
    type: "MOVE_TASK",
    taskId: tasks[0].id,
    toStatus: "done",
    newOrder: 5000,
  });

  const task = updated.find((t) => t.text === "task A");
  expect(task?.status).toBe("done");
  expect(task?.order).toBe(5000);
});

test("MOVE_TASK cross-list: Done to Working", () => {
  const tasks: Task[] = [
    { ...createTask("task A"), status: "done", order: 1000 },
  ];

  const updated = tasksReducer(tasks, {
    type: "MOVE_TASK",
    taskId: tasks[0].id,
    toStatus: "working",
    newOrder: 5000,
  });

  const task = updated.find((t) => t.text === "task A");
  expect(task?.status).toBe("working");
  expect(task?.order).toBe(5000);
});

test("MOVE_TASK same-list reorder updates only order", () => {
  const tasks: Task[] = [
    { ...createTask("task A"), status: "working", order: 1000 },
    { ...createTask("task B"), status: "working", order: 2000 },
  ];

  const updated = tasksReducer(tasks, {
    type: "MOVE_TASK",
    taskId: tasks[0].id,
    toStatus: "working",
    newOrder: 3000,
  });

  const task = updated.find((t) => t.text === "task A");
  expect(task?.status).toBe("working");
  expect(task?.order).toBe(3000);
});

test("MOVE_TASK to active demotes current active to working", () => {
  const tasks: Task[] = [
    { ...createTask("current active"), status: "active", order: 1000 },
    { ...createTask("task to move"), status: "ready", order: 2000 },
  ];

  const updated = tasksReducer(tasks, {
    type: "MOVE_TASK",
    taskId: tasks[1].id,
    toStatus: "active",
    newOrder: 500,
  });

  // The moved task should be active
  const movedTask = updated.find((t) => t.text === "task to move");
  expect(movedTask?.status).toBe("active");
  expect(movedTask?.order).toBe(500);

  // The previously active task should be demoted to working
  const previousActive = updated.find((t) => t.text === "current active");
  expect(previousActive?.status).toBe("working");
});

test("MOVE_TASK to active: demoted task gets order at end of working list", () => {
  const tasks: Task[] = [
    { ...createTask("current active"), status: "active", order: 1000 },
    { ...createTask("working task"), status: "working", order: 2000 },
    { ...createTask("task to move"), status: "ready", order: 3000 },
  ];

  const updated = tasksReducer(tasks, {
    type: "MOVE_TASK",
    taskId: tasks[2].id,
    toStatus: "active",
    newOrder: 500,
  });

  const previousActive = updated.find((t) => t.text === "current active");
  expect(previousActive?.status).toBe("working");
  expect(previousActive?.order).toBe(3000); // 2000 + 1000
});

test("MOVE_TASK to active works when no current active task exists", () => {
  const tasks: Task[] = [
    { ...createTask("task A"), status: "working", order: 1000 },
    { ...createTask("task B"), status: "ready", order: 2000 },
  ];

  const updated = tasksReducer(tasks, {
    type: "MOVE_TASK",
    taskId: tasks[1].id,
    toStatus: "active",
    newOrder: 500,
  });

  const task = updated.find((t) => t.text === "task B");
  expect(task?.status).toBe("active");
  expect(task?.order).toBe(500);

  // Verify only one active task
  const activeTasks = updated.filter((t) => t.status === "active");
  expect(activeTasks.length).toBe(1);
});

test("MOVE_TASK with non-existent task returns unchanged state", () => {
  const tasks: Task[] = [
    { ...createTask("task A"), status: "working", order: 1000 },
  ];

  const updated = tasksReducer(tasks, {
    type: "MOVE_TASK",
    taskId: "non-existent-id",
    toStatus: "ready",
    newOrder: 5000,
  });

  expect(updated).toBe(tasks);
});
