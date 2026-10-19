import tasksReducer from "./tasksReducer";
import { createTask } from "./tasksReducer";
import type Task from "../types/Task";
import { afterEach, expect, test, vi } from "vitest";

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

// IMPORT_TASKS tests

test("IMPORT_TASKS imports tasks as ready with correct fields", () => {
  const tasks: Task[] = [];

  const updated = tasksReducer(tasks, {
    type: "IMPORT_TASKS",
    tasks: [
      {
        text: "Write report",
        notes: "Q1 summary",
        url: "https://todoist.com/task/1",
        color: "#f87171",
        todoistId: "101",
      },
      {
        text: "Review PR",
        notes: "",
        color: "#9ca3af",
        todoistId: "102",
      },
    ],
  });

  expect(updated.length).toBe(2);
  expect(updated[0].text).toBe("Write report");
  expect(updated[0].notes).toBe("Q1 summary");
  expect(updated[0].url).toBe("https://todoist.com/task/1");
  expect(updated[0].color).toBe("#f87171");
  expect(updated[0].todoistId).toBe("101");
  expect(updated[0].status).toBe("ready");
  expect(updated[1].text).toBe("Review PR");
  expect(updated[1].todoistId).toBe("102");
});

test("IMPORT_TASKS deduplicates by todoistId", () => {
  const existing = { ...createTask("Existing"), todoistId: "101" };
  const tasks: Task[] = [existing];

  const updated = tasksReducer(tasks, {
    type: "IMPORT_TASKS",
    tasks: [
      { text: "Existing (dupe)", notes: "", todoistId: "101" },
      { text: "New task", notes: "", todoistId: "102" },
    ],
  });

  expect(updated.length).toBe(2);
  expect(updated[0].text).toBe("Existing");
  expect(updated[1].text).toBe("New task");
  expect(updated[1].todoistId).toBe("102");
});

test("IMPORT_TASKS orders after existing tasks", () => {
  const tasks: Task[] = [
    { ...createTask("Existing"), order: 5000 },
  ];

  const updated = tasksReducer(tasks, {
    type: "IMPORT_TASKS",
    tasks: [
      { text: "First", notes: "", todoistId: "1" },
      { text: "Second", notes: "", todoistId: "2" },
    ],
  });

  expect(updated[1].order).toBe(6000);
  expect(updated[2].order).toBe(7000);
});

test("IMPORT_TASKS with empty array adds nothing", () => {
  const tasks: Task[] = [createTask("Existing")];

  const updated = tasksReducer(tasks, {
    type: "IMPORT_TASKS",
    tasks: [],
  });

  expect(updated.length).toBe(1);
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

// NEXT_TASK shuffle mode tests

afterEach(() => {
  vi.restoreAllMocks();
});

test("NEXT_TASK without shuffle picks first working task by order", () => {
  const tasks: Task[] = [
    { ...createTask("active"), status: "active", order: 1000 },
    { ...createTask("first"), status: "working", order: 2000 },
    { ...createTask("second"), status: "working", order: 3000 },
    { ...createTask("third"), status: "working", order: 4000 },
  ];

  const updated = tasksReducer(tasks, { type: "NEXT_TASK", shuffle: false });

  const activeNow = updated.find((t) => t.status === "active");
  expect(activeNow?.text).toBe("first");
});

test("NEXT_TASK with shuffle picks a random working task (last index)", () => {
  vi.spyOn(Math, "random").mockReturnValue(0.99);

  const tasks: Task[] = [
    { ...createTask("active"), status: "active", order: 1000 },
    { ...createTask("first"), status: "working", order: 2000 },
    { ...createTask("second"), status: "working", order: 3000 },
    { ...createTask("third"), status: "working", order: 4000 },
  ];

  const updated = tasksReducer(tasks, { type: "NEXT_TASK", shuffle: true });

  // Math.floor(0.99 * 3) = 2 -> last task in the working pool ("third")
  const activeNow = updated.find((t) => t.status === "active");
  expect(activeNow?.text).toBe("third");
});

test("NEXT_TASK with shuffle picks a random working task (middle index)", () => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);

  const tasks: Task[] = [
    { ...createTask("active"), status: "active", order: 1000 },
    { ...createTask("first"), status: "working", order: 2000 },
    { ...createTask("second"), status: "working", order: 3000 },
    { ...createTask("third"), status: "working", order: 4000 },
  ];

  const updated = tasksReducer(tasks, { type: "NEXT_TASK", shuffle: true });

  // Math.floor(0.5 * 3) = 1 -> "second"
  const activeNow = updated.find((t) => t.status === "active");
  expect(activeNow?.text).toBe("second");
});

test("NEXT_TASK with shuffle picks a random working task (first index)", () => {
  vi.spyOn(Math, "random").mockReturnValue(0);

  const tasks: Task[] = [
    { ...createTask("active"), status: "active", order: 1000 },
    { ...createTask("first"), status: "working", order: 2000 },
    { ...createTask("second"), status: "working", order: 3000 },
    { ...createTask("third"), status: "working", order: 4000 },
  ];

  const updated = tasksReducer(tasks, { type: "NEXT_TASK", shuffle: true });

  // Math.floor(0 * 3) = 0 -> "first"
  const activeNow = updated.find((t) => t.status === "active");
  expect(activeNow?.text).toBe("first");
});

test("NEXT_TASK with shuffle and only one other working task picks that one", () => {
  vi.spyOn(Math, "random").mockReturnValue(0.7);

  const tasks: Task[] = [
    { ...createTask("active"), status: "active", order: 1000 },
    { ...createTask("only one"), status: "working", order: 2000 },
  ];

  const updated = tasksReducer(tasks, { type: "NEXT_TASK", shuffle: true });

  const activeNow = updated.find((t) => t.status === "active");
  expect(activeNow?.text).toBe("only one");

  // Old active should now be in working
  const oldActive = updated.find((t) => t.text === "active");
  expect(oldActive?.status).toBe("working");
});

test("NEXT_TASK with shuffle and no other working tasks keeps state consistent", () => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);

  const tasks: Task[] = [
    { ...createTask("only active"), status: "active", order: 1000 },
  ];

  const updated = tasksReducer(tasks, { type: "NEXT_TASK", shuffle: true });

  // The previously active task gets moved to working (standard logic),
  // and with no other candidates, no new active task is set.
  const activeTasks = updated.filter((t) => t.status === "active");
  expect(activeTasks.length).toBe(0);
  const working = updated.filter((t) => t.status === "working");
  expect(working.length).toBe(1);
  expect(working[0].text).toBe("only active");
});

test("NEXT_TASK with shuffle when no task is currently active picks from working", () => {
  vi.spyOn(Math, "random").mockReturnValue(0.99);

  const tasks: Task[] = [
    { ...createTask("first"), status: "working", order: 1000 },
    { ...createTask("second"), status: "working", order: 2000 },
    { ...createTask("third"), status: "working", order: 3000 },
  ];

  const updated = tasksReducer(tasks, { type: "NEXT_TASK", shuffle: true });

  // Math.floor(0.99 * 3) = 2 -> "third"
  const activeNow = updated.find((t) => t.status === "active");
  expect(activeNow?.text).toBe("third");

  // Only one active task in result
  expect(updated.filter((t) => t.status === "active").length).toBe(1);
});

test("NEXT_TASK with shuffle moves old active to end of working bucket", () => {
  vi.spyOn(Math, "random").mockReturnValue(0);

  const tasks: Task[] = [
    { ...createTask("old active"), status: "active", order: 500 },
    { ...createTask("working a"), status: "working", order: 2000 },
    { ...createTask("working b"), status: "working", order: 3000 },
  ];

  const updated = tasksReducer(tasks, { type: "NEXT_TASK", shuffle: true });

  // Old active should now be working with order > max previous working order
  const oldActive = updated.find((t) => t.text === "old active");
  expect(oldActive?.status).toBe("working");
  expect(oldActive?.order).toBeGreaterThan(3000);
});

test("NEXT_TASK with shuffle excludes the old active task from random pool", () => {
  // If we included the old active task, Math.random = 0 could pick it back.
  // This test ensures the pool only contains the other working tasks.
  vi.spyOn(Math, "random").mockReturnValue(0);

  const tasks: Task[] = [
    { ...createTask("old active"), status: "active", order: 500 },
    { ...createTask("candidate"), status: "working", order: 2000 },
  ];

  const updated = tasksReducer(tasks, { type: "NEXT_TASK", shuffle: true });

  // The only candidate should be activated — never the old active task
  const activeNow = updated.find((t) => t.status === "active");
  expect(activeNow?.text).toBe("candidate");
});

test("NEXT_TASK with shuffle does not call Math.random when no candidates", () => {
  const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

  const tasks: Task[] = [
    { ...createTask("only active"), status: "active", order: 1000 },
  ];

  tasksReducer(tasks, { type: "NEXT_TASK", shuffle: true });

  // Early return before Math.random is called
  expect(randomSpy).not.toHaveBeenCalled();
});

// COMPLETE_TASK / ready-lock tests

test("COMPLETE_TASK promotes a ready task and activates the first working task", () => {
  const tasks: Task[] = [
    { ...createTask("active"), status: "active", order: 1000 },
    { ...createTask("working"), status: "working", order: 2000 },
    { ...createTask("ready"), status: "ready", order: 3000 },
  ];

  const updated = tasksReducer(tasks, { type: "COMPLETE_TASK" });

  expect(updated.find((t) => t.text === "active")?.status).toBe("done");
  expect(updated.find((t) => t.text === "working")?.status).toBe("active");
  expect(updated.find((t) => t.text === "ready")?.status).toBe("working");
});

test("COMPLETE_TASK with pullFromReady=false leaves ready tasks alone", () => {
  const tasks: Task[] = [
    { ...createTask("active"), status: "active", order: 1000 },
    { ...createTask("working"), status: "working", order: 2000 },
    { ...createTask("ready"), status: "ready", order: 3000 },
  ];

  const updated = tasksReducer(tasks, {
    type: "COMPLETE_TASK",
    pullFromReady: false,
  });

  expect(updated.find((t) => t.text === "active")?.status).toBe("done");
  // Still activates from the existing working pool
  expect(updated.find((t) => t.text === "working")?.status).toBe("active");
  // But nothing is pulled from ready
  expect(updated.find((t) => t.text === "ready")?.status).toBe("ready");
});

test("COMPLETE_TASK with pullFromReady=false and empty working leaves no active task", () => {
  const tasks: Task[] = [
    { ...createTask("active"), status: "active", order: 1000 },
    { ...createTask("ready"), status: "ready", order: 2000 },
  ];

  const updated = tasksReducer(tasks, {
    type: "COMPLETE_TASK",
    pullFromReady: false,
  });

  expect(updated.find((t) => t.text === "active")?.status).toBe("done");
  expect(updated.find((t) => t.text === "ready")?.status).toBe("ready");
  expect(updated.filter((t) => t.status === "active").length).toBe(0);
});

test("NEXT_TASK with empty working pulls the first ready task", () => {
  const tasks: Task[] = [
    { ...createTask("ready b"), status: "ready", order: 2000 },
    { ...createTask("ready a"), status: "ready", order: 1000 },
  ];

  const updated = tasksReducer(tasks, { type: "NEXT_TASK" });

  expect(updated.find((t) => t.text === "ready a")?.status).toBe("active");
  expect(updated.find((t) => t.text === "ready b")?.status).toBe("ready");
});

test("NEXT_TASK with empty working and pullFromReady=false does nothing", () => {
  const tasks: Task[] = [
    { ...createTask("ready"), status: "ready", order: 1000 },
  ];

  const updated = tasksReducer(tasks, {
    type: "NEXT_TASK",
    pullFromReady: false,
  });

  expect(updated.find((t) => t.text === "ready")?.status).toBe("ready");
  expect(updated.filter((t) => t.status === "active").length).toBe(0);
});

test("NEXT_TASK prefers working tasks over ready tasks", () => {
  const tasks: Task[] = [
    { ...createTask("working"), status: "working", order: 5000 },
    { ...createTask("ready"), status: "ready", order: 1000 },
  ];

  const updated = tasksReducer(tasks, { type: "NEXT_TASK" });

  expect(updated.find((t) => t.text === "working")?.status).toBe("active");
  expect(updated.find((t) => t.text === "ready")?.status).toBe("ready");
});

test("NEXT_TASK with shuffle=undefined behaves like non-shuffle (first in order)", () => {
  vi.spyOn(Math, "random").mockReturnValue(0.99);

  const tasks: Task[] = [
    { ...createTask("active"), status: "active", order: 1000 },
    { ...createTask("first"), status: "working", order: 2000 },
    { ...createTask("second"), status: "working", order: 3000 },
  ];

  const updated = tasksReducer(tasks, { type: "NEXT_TASK" });

  // Should ignore Math.random and pick "first"
  const activeNow = updated.find((t) => t.status === "active");
  expect(activeNow?.text).toBe("first");
});

const wfNode = (
  workflowyId: string,
  text: string,
  overrides: Partial<{
    notes: string;
    url: string;
    completed: boolean;
  }> = {}
) => ({
  workflowyId,
  text,
  notes: "",
  url: `https://workflowy.com/#/${workflowyId.slice(-12)}`,
  completed: false,
  ...overrides,
});

test("WORKFLOWY_MERGE imports new remote nodes as ready tasks", () => {
  const updated = tasksReducer([], {
    type: "WORKFLOWY_MERGE",
    nodes: [
      wfNode("wf-aaaaaaaaaaaa", "first"),
      wfNode("wf-bbbbbbbbbbbb", "second", { notes: "some detail" }),
      wfNode("wf-cccccccccccc", "finished", { completed: true }),
    ],
  });

  expect(updated.length).toBe(3);
  const first = updated.find((t) => t.text === "first");
  expect(first?.status).toBe("ready");
  expect(first?.workflowyId).toBe("wf-aaaaaaaaaaaa");
  expect(first?.url).toContain("workflowy.com");

  // Imported tasks start with no tracked time; notes come from workflowy
  const second = updated.find((t) => t.text === "second");
  expect(second?.notes).toBe("some detail");
  expect(second?.duration).toBe(0);
  expect(second?.events).toEqual([]);
  expect(updated.find((t) => t.text === "finished")?.status).toBe("done");

  // Sibling order preserved
  const ready = updated
    .filter((t) => t.status === "ready")
    .sort((a, b) => a.order - b.order);
  expect(ready.map((t) => t.text)).toEqual(["first", "second"]);
});

test("WORKFLOWY_MERGE keeps local status but adopts remote text and completion", () => {
  const tasks: Task[] = [
    {
      ...createTask("old text"),
      status: "working",
      workflowyId: "wf-aaaaaaaaaaaa",
    },
    { ...createTask("was done"), status: "done", workflowyId: "wf-bbbbbbbbbbbb" },
    { ...createTask("now done"), status: "active", workflowyId: "wf-cccccccccccc" },
  ];

  const updated = tasksReducer(tasks, {
    type: "WORKFLOWY_MERGE",
    nodes: [
      wfNode("wf-aaaaaaaaaaaa", "new text"),
      wfNode("wf-bbbbbbbbbbbb", "was done"),
      wfNode("wf-cccccccccccc", "now done", { completed: true }),
    ],
  });

  const renamed = updated.find((t) => t.workflowyId === "wf-aaaaaaaaaaaa");
  expect(renamed?.text).toBe("new text");
  expect(renamed?.status).toBe("working"); // local status survives

  // Uncompleted upstream -> back to ready
  expect(updated.find((t) => t.workflowyId === "wf-bbbbbbbbbbbb")?.status).toBe(
    "ready"
  );
  // Completed upstream -> done locally
  expect(updated.find((t) => t.workflowyId === "wf-cccccccccccc")?.status).toBe(
    "done"
  );
});

test("WORKFLOWY_MERGE removes linked tasks deleted upstream but keeps done and local-only tasks", () => {
  const tasks: Task[] = [
    { ...createTask("gone"), status: "ready", workflowyId: "wf-aaaaaaaaaaaa" },
    { ...createTask("done stays"), status: "done", workflowyId: "wf-bbbbbbbbbbbb" },
    { ...createTask("local only"), status: "ready" },
  ];

  const updated = tasksReducer(tasks, { type: "WORKFLOWY_MERGE", nodes: [] });

  expect(updated.find((t) => t.text === "gone")).toBeUndefined();
  expect(updated.find((t) => t.text === "done stays")).toBeDefined();
  expect(updated.find((t) => t.text === "local only")).toBeDefined();
});

test("WORKFLOWY_MERGE leaves local tracked time untouched", () => {
  const base = createTask("tracked locally");
  const events = [
    { eventType: "start" as const, timestamp: 1000 },
    { eventType: "stop" as const, timestamp: 121000 },
  ];
  const tasks: Task[] = [
    {
      ...base,
      status: "working",
      workflowyId: "wf-aaaaaaaaaaaa",
      events,
      duration: 120000,
    },
  ];

  const updated = tasksReducer(tasks, {
    type: "WORKFLOWY_MERGE",
    nodes: [wfNode("wf-aaaaaaaaaaaa", "tracked locally (renamed)")],
  });

  expect(updated[0].text).toBe("tracked locally (renamed)");
  expect(updated[0].duration).toBe(120000);
  expect(updated[0].events).toEqual(events);
});

test("SET_WORKFLOWY_ID links a task and fills an empty url", () => {
  const tasks: Task[] = [createTask("new task")];

  const updated = tasksReducer(tasks, {
    type: "SET_WORKFLOWY_ID",
    taskId: tasks[0].id,
    workflowyId: "wf-aaaaaaaaaaaa",
    url: "https://workflowy.com/#/wf-aaaaaaaaaaaa",
  });

  expect(updated[0].workflowyId).toBe("wf-aaaaaaaaaaaa");
  expect(updated[0].url).toBe("https://workflowy.com/#/wf-aaaaaaaaaaaa");
});

test("new tasks start with no subtasks and can take a list on creation", () => {
  expect(createTask("x").subtasks).toEqual([]);
  const subtasks = [{ id: "s1", text: "step", done: true }];
  const tasks = tasksReducer([], {
    type: "ADD_TASK_WITH_OPTIONS",
    text: "linked",
    status: "ready",
    position: "bottom",
    subtasks,
    projectTaskId: "pt1",
  });
  expect(tasks[0].subtasks).toEqual(subtasks);
});

test("subtasks are added, ticked, renamed, reordered, removed and replaced", () => {
  let tasks: Task[] = [createTask("parent"), createTask("other")];
  const taskId = tasks[0].id;
  tasks = tasksReducer(tasks, { type: "ADD_SUBTASK", taskId, text: "a" });
  tasks = tasksReducer(tasks, { type: "ADD_SUBTASK", taskId, text: "" });
  tasks = tasksReducer(tasks, { type: "ADD_SUBTASK", taskId, text: "b" });
  const subtasks = () => tasks[0].subtasks;
  expect(subtasks().map((s) => s.text)).toEqual(["a", "b"]);
  expect(tasks[1].subtasks).toEqual([]);

  const [a, b] = subtasks();
  tasks = tasksReducer(tasks, {
    type: "SET_SUBTASK_DONE",
    taskId,
    subtaskId: a.id,
    done: true,
  });
  tasks = tasksReducer(tasks, {
    type: "SET_SUBTASK_TEXT",
    taskId,
    subtaskId: b.id,
    text: "bee",
  });
  expect(subtasks()).toEqual([
    { id: a.id, text: "a", done: true },
    { id: b.id, text: "bee", done: false },
  ]);

  tasks = tasksReducer(tasks, {
    type: "MOVE_SUBTASK",
    taskId,
    subtaskId: b.id,
    index: 0,
  });
  expect(subtasks().map((s) => s.id)).toEqual([b.id, a.id]);

  tasks = tasksReducer(tasks, { type: "REMOVE_SUBTASK", taskId, subtaskId: b.id });
  expect(subtasks().map((s) => s.id)).toEqual([a.id]);

  const replacement = [{ id: "s9", text: "mirrored", done: false }];
  tasks = tasksReducer(tasks, { type: "SET_SUBTASKS", taskId, subtasks: replacement });
  expect(subtasks()).toEqual(replacement);
});

// LOG_PAUSE backdating: a countdown that completes late (throttled or
// frozen background tab) records its stop at the real deadline

test("LOG_PAUSE with `at` stops the session at that time, not now", () => {
  const start = Date.now() - 76 * 60 * 1000;
  const deadline = start + 15 * 60 * 1000;
  const tasks: Task[] = [
    {
      ...createTask("meeting prep"),
      status: "active",
      events: [{ eventType: "start", timestamp: start }],
    },
  ];

  const [updated] = tasksReducer(tasks, { type: "LOG_PAUSE", at: deadline });

  expect(updated.events.at(-1)).toEqual({ eventType: "stop", timestamp: deadline });
  expect(updated.duration).toBe(15 * 60 * 1000);
});

test("LOG_PAUSE never stops before the session started or after now", () => {
  const start = Date.now() - 60 * 1000;
  const tasks: Task[] = [
    {
      ...createTask("foo"),
      status: "active",
      events: [{ eventType: "start", timestamp: start }],
    },
  ];

  const [early] = tasksReducer(tasks, { type: "LOG_PAUSE", at: start - 5000 });
  expect(early.duration).toBe(0);

  const before = Date.now();
  const [late] = tasksReducer(tasks, {
    type: "LOG_PAUSE",
    at: Date.now() + 60 * 60 * 1000,
  });
  const stop = late.events.at(-1)!.timestamp;
  expect(stop).toBeGreaterThanOrEqual(before);
  expect(stop).toBeLessThanOrEqual(Date.now());
});

// Days: every task belongs to a date, and the timer only works today's

test("new tasks go on the given day, below what's already planned there", () => {
  const monday = { ...createTask("first", "2026-10-19"), weekOrder: 5000 };
  const added = tasksReducer([monday], {
    type: "ADD_TASK",
    text: "second",
    date: "2026-10-19",
  });
  expect(added[1].date).toBe("2026-10-19");
  expect(added[1].weekOrder).toBe(6000);

  const withOptions = tasksReducer(added, {
    type: "ADD_TASK_WITH_OPTIONS",
    text: "tuesday",
    status: "ready",
    position: "bottom",
    date: "2026-10-20",
  });
  expect(withOptions[2].date).toBe("2026-10-20");
});

test("next task and complete task only pull in today's work", () => {
  const tasks: Task[] = [
    { ...createTask("active", "2026-10-19"), status: "active", order: 1 },
    { ...createTask("tomorrow", "2026-10-20"), status: "working", order: 2 },
    { ...createTask("yesterday", "2026-10-18"), status: "ready", order: 3 },
    { ...createTask("today", "2026-10-19"), status: "ready", order: 4 },
  ];
  // Tomorrow's working task is passed over for today's ready one
  const next = tasksReducer(tasks, { type: "NEXT_TASK", today: "2026-10-19" });
  expect(next.find((t) => t.status === "active")?.text).toBe("today");
  expect(next.find((t) => t.text === "tomorrow")?.status).toBe("working");

  const completed = tasksReducer(tasks, {
    type: "COMPLETE_TASK",
    today: "2026-10-19",
  });
  expect(completed.find((t) => t.status === "active")?.text).toBe("today");
  expect(completed.find((t) => t.text === "tomorrow")?.status).toBe("working");
  expect(completed.find((t) => t.text === "yesterday")?.status).toBe("ready");
});

test("reordering with arrows stays within the task's own day", () => {
  const tasks: Task[] = [
    { ...createTask("other day", "2026-10-18"), order: 1000 },
    { ...createTask("a", "2026-10-19"), order: 2000 },
    { ...createTask("b", "2026-10-19"), order: 3000 },
  ];
  const updated = tasksReducer(tasks, {
    type: "REORDER_TASK",
    taskId: tasks[1].id,
    direction: "up",
  });
  // Already first on its day
  expect(updated[1].order).toBe(2000);
});

test("moving a task without logged time to another day just moves it", () => {
  const task = { ...createTask("plan", "2026-10-19"), status: "working" as const };
  const updated = tasksReducer([task], {
    type: "MOVE_TASK_TO_DAY",
    taskId: task.id,
    date: "2026-10-21",
    weekOrder: 42,
  });
  expect(updated).toHaveLength(1);
  expect(updated[0]).toMatchObject({
    id: task.id,
    date: "2026-10-21",
    weekOrder: 42,
    status: "working",
  });
});

test("moving within a day only changes its week order", () => {
  const task = { ...createTask("plan", "2026-10-19"), order: 7 };
  const updated = tasksReducer([task], {
    type: "MOVE_TASK_TO_DAY",
    taskId: task.id,
    date: "2026-10-19",
    weekOrder: 99,
  });
  expect(updated[0]).toEqual({ ...task, weekOrder: 99 });
});

test("moving a task with logged time leaves its time log on the original day", () => {
  const events = [
    { eventType: "start" as const, timestamp: 1000 },
    { eventType: "stop" as const, timestamp: 61000 },
  ];
  const task: Task = {
    ...createTask("write report", "2026-10-19"),
    status: "ready",
    events,
    duration: 60000,
    notes: "draft",
    subtasks: [{ id: "s1", text: "outline", done: true }],
    color: "#ef4444",
    projectTaskId: "pt1",
  };
  const updated = tasksReducer([task], {
    type: "MOVE_TASK_TO_DAY",
    taskId: task.id,
    date: "2026-10-20",
    weekOrder: 5,
  });
  expect(updated).toHaveLength(2);
  // The original stays put with its time
  expect(updated[0]).toEqual(task);
  // A fresh copy with no time goes to the new day
  const copy = updated[1];
  expect(copy.id).not.toBe(task.id);
  expect(copy).toMatchObject({
    text: "write report",
    date: "2026-10-20",
    weekOrder: 5,
    events: [],
    duration: 0,
    notes: "draft",
    color: "#ef4444",
    projectTaskId: "pt1",
    status: "ready",
  });
  expect(copy.subtasks).toEqual(task.subtasks);
});

test("an overridden duration counts as logged time when moving", () => {
  const task: Task = {
    ...createTask("call", "2026-10-19"),
    events: [{ eventType: "duration_override", timestamp: 1, duration: 300000 }],
    duration: 300000,
  };
  const updated = tasksReducer([task], {
    type: "MOVE_TASK_TO_DAY",
    taskId: task.id,
    date: "2026-10-22",
  });
  expect(updated).toHaveLength(2);
});

test("moving the active task off its day leaves it waiting in working", () => {
  const events = [
    { eventType: "start" as const, timestamp: 1000 },
    { eventType: "stop" as const, timestamp: 2000 },
  ];
  const task: Task = {
    ...createTask("busy", "2026-10-19"),
    status: "active",
    events,
    duration: 1000,
  };
  const updated = tasksReducer([task], {
    type: "MOVE_TASK_TO_DAY",
    taskId: task.id,
    date: "2026-10-20",
  });
  expect(updated.map((t) => [t.date, t.status])).toEqual([
    ["2026-10-19", "working"],
    ["2026-10-20", "working"],
  ]);
});

test("todoist imports only dedupe against today's tasks", () => {
  const yesterday = { ...createTask("old", "2026-10-18"), todoistId: "1" };
  const imported = tasksReducer([yesterday], {
    type: "IMPORT_TASKS",
    tasks: [{ text: "old", notes: "", todoistId: "1" }],
    today: "2026-10-19",
  });
  expect(imported).toHaveLength(2);
  expect(imported[1].date).toBe("2026-10-19");

  const again = tasksReducer(imported, {
    type: "IMPORT_TASKS",
    tasks: [{ text: "old", notes: "", todoistId: "1" }],
    today: "2026-10-19",
  });
  expect(again).toHaveLength(2);
});

test("workflowy merges only touch today, and skip nodes planned for later", () => {
  const past = {
    ...createTask("past", "2026-10-18"),
    workflowyId: "gone",
  };
  const later = {
    ...createTask("later", "2026-10-21"),
    workflowyId: "planned",
  };
  const merged = tasksReducer([past, later], {
    type: "WORKFLOWY_MERGE",
    nodes: [
      { workflowyId: "planned", text: "later", notes: "", url: "u", completed: false },
      { workflowyId: "new", text: "fresh", notes: "", url: "u", completed: false },
    ],
    today: "2026-10-19",
  });
  // The past task survives even though its node is gone
  expect(merged.find((t) => t.id === past.id)).toEqual(past);
  expect(merged.find((t) => t.id === later.id)).toEqual(later);
  const created = merged.filter((t) => t.workflowyId === "new");
  expect(created).toHaveLength(1);
  expect(created[0].date).toBe("2026-10-19");
  expect(merged.filter((t) => t.workflowyId === "planned")).toHaveLength(1);
});
