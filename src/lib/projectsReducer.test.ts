import { expect, test } from "vitest";
import projectsReducer, {
  EMPTY_PROJECTS,
  byOrder,
  loadProjectsState,
  projectProgress,
  tasksForProject,
} from "./projectsReducer";
import type { ProjectsState } from "../types/Project";

const withProject = (name = "Project X"): ProjectsState =>
  projectsReducer(EMPTY_PROJECTS, { type: "ADD_PROJECT", name });

test("adds projects in order", () => {
  let state = withProject("A");
  state = projectsReducer(state, { type: "ADD_PROJECT", name: "B" });
  expect(state.projects.map((p) => p.name)).toEqual(["A", "B"]);
  expect(state.projects[0].order).toBeLessThan(state.projects[1].order);
  expect(state.projects[0].collapsed).toBe(false);
});

test("adds tasks to a project at the bottom", () => {
  let state = withProject();
  const projectId = state.projects[0].id;
  state = projectsReducer(state, { type: "ADD_TASK", projectId, text: "one" });
  state = projectsReducer(state, { type: "ADD_TASK", projectId, text: "two" });
  expect(tasksForProject(state, projectId).map((t) => t.text)).toEqual([
    "one",
    "two",
  ]);
  const task = state.tasks[0];
  expect(task.done).toBe(false);
  expect(task.notes).toBe("");
  expect(task.subtasks).toEqual([]);
  expect(task.points).toBeUndefined();
});

test("subtasks are added, ticked, renamed, reordered and removed on a task", () => {
  let state = withProject();
  const projectId = state.projects[0].id;
  state = projectsReducer(state, { type: "ADD_TASK", projectId, text: "one" });
  const taskId = state.tasks[0].id;
  state = projectsReducer(state, { type: "ADD_SUBTASK", taskId, text: "a" });
  state = projectsReducer(state, { type: "ADD_SUBTASK", taskId, text: "  " });
  state = projectsReducer(state, { type: "ADD_SUBTASK", taskId, text: " b " });
  const subtasks = () => state.tasks[0].subtasks;
  expect(subtasks().map((s) => s.text)).toEqual(["a", "b"]);
  expect(subtasks().every((s) => !s.done)).toBe(true);

  const [a, b] = subtasks();
  state = projectsReducer(state, {
    type: "SET_SUBTASK_DONE",
    taskId,
    subtaskId: a.id,
    done: true,
  });
  state = projectsReducer(state, {
    type: "SET_SUBTASK_TEXT",
    taskId,
    subtaskId: b.id,
    text: "bee",
  });
  expect(subtasks()).toEqual([
    { id: a.id, text: "a", done: true },
    { id: b.id, text: "bee", done: false },
  ]);

  state = projectsReducer(state, {
    type: "MOVE_SUBTASK",
    taskId,
    subtaskId: b.id,
    index: 0,
  });
  expect(subtasks().map((s) => s.id)).toEqual([b.id, a.id]);

  state = projectsReducer(state, { type: "REMOVE_SUBTASK", taskId, subtaskId: a.id });
  expect(subtasks().map((s) => s.id)).toEqual([b.id]);

  state = projectsReducer(state, { type: "SET_SUBTASKS", taskId, subtasks: [] });
  expect(subtasks()).toEqual([]);
  // Unknown task: no change
  expect(
    projectsReducer(state, { type: "ADD_SUBTASK", taskId: "nope", text: "x" })
  ).toEqual(state);
});

test("ignores tasks added to an unknown project", () => {
  const state = withProject();
  const next = projectsReducer(state, {
    type: "ADD_TASK",
    projectId: "nope",
    text: "x",
  });
  expect(next).toBe(state);
});

test("edits text, notes, points and done", () => {
  let state = withProject();
  const projectId = state.projects[0].id;
  state = projectsReducer(state, { type: "ADD_TASK", projectId, text: "one" });
  const taskId = state.tasks[0].id;
  state = projectsReducer(state, { type: "SET_TASK_TEXT", taskId, text: "uno" });
  state = projectsReducer(state, { type: "SET_TASK_NOTES", taskId, notes: "n" });
  state = projectsReducer(state, { type: "SET_TASK_POINTS", taskId, points: 5 });
  state = projectsReducer(state, { type: "SET_TASK_DONE", taskId, done: true });
  expect(state.tasks[0]).toMatchObject({
    text: "uno",
    notes: "n",
    points: 5,
    done: true,
  });
  state = projectsReducer(state, {
    type: "SET_TASK_POINTS",
    taskId,
    points: undefined,
  });
  expect(state.tasks[0].points).toBeUndefined();
});

test("moves a task to another project with a new order", () => {
  let state = withProject("A");
  state = projectsReducer(state, { type: "ADD_PROJECT", name: "B" });
  const [a, b] = state.projects;
  state = projectsReducer(state, { type: "ADD_TASK", projectId: a.id, text: "t" });
  const taskId = state.tasks[0].id;
  state = projectsReducer(state, {
    type: "MOVE_TASK",
    taskId,
    projectId: b.id,
    order: 42,
  });
  expect(tasksForProject(state, a.id)).toHaveLength(0);
  expect(tasksForProject(state, b.id)[0]).toMatchObject({ id: taskId, order: 42 });
});

test("removing a project removes its tasks", () => {
  let state = withProject("A");
  state = projectsReducer(state, { type: "ADD_PROJECT", name: "B" });
  const [a, b] = state.projects;
  state = projectsReducer(state, { type: "ADD_TASK", projectId: a.id, text: "ta" });
  state = projectsReducer(state, { type: "ADD_TASK", projectId: b.id, text: "tb" });
  state = projectsReducer(state, { type: "REMOVE_PROJECT", projectId: a.id });
  expect(state.projects.map((p) => p.name)).toEqual(["B"]);
  expect(state.tasks.map((t) => t.text)).toEqual(["tb"]);
});

test("moves a project to a new order", () => {
  let state = withProject("A");
  state = projectsReducer(state, { type: "ADD_PROJECT", name: "B" });
  const [a, b] = state.projects;
  state = projectsReducer(state, {
    type: "MOVE_PROJECT",
    projectId: b.id,
    order: a.order - 1000,
  });
  expect(byOrder(state.projects).map((p) => p.name)).toEqual(["B", "A"]);
});

test("rename and collapse a project", () => {
  let state = withProject("A");
  const projectId = state.projects[0].id;
  state = projectsReducer(state, { type: "RENAME_PROJECT", projectId, name: "Z" });
  state = projectsReducer(state, {
    type: "SET_PROJECT_COLLAPSED",
    projectId,
    collapsed: true,
  });
  expect(state.projects[0]).toMatchObject({ name: "Z", collapsed: true });
});

test("progress sums points of done tasks over all pointed tasks", () => {
  let state = withProject();
  const projectId = state.projects[0].id;
  for (const text of ["a", "b", "c"]) {
    state = projectsReducer(state, { type: "ADD_TASK", projectId, text });
  }
  const [a, b] = state.tasks;
  state = projectsReducer(state, { type: "SET_TASK_POINTS", taskId: a.id, points: 5 });
  state = projectsReducer(state, { type: "SET_TASK_POINTS", taskId: b.id, points: 8 });
  state = projectsReducer(state, { type: "SET_TASK_DONE", taskId: a.id, done: true });
  // c is unpointed and counts for nothing
  expect(projectProgress(state.tasks)).toEqual({ done: 5, total: 13 });
});

test("loads persisted state and drops malformed entries", () => {
  expect(loadProjectsState(null)).toEqual(EMPTY_PROJECTS);
  expect(loadProjectsState("not json")).toEqual(EMPTY_PROJECTS);
  expect(loadProjectsState("[]")).toEqual(EMPTY_PROJECTS);

  const loaded = loadProjectsState(
    JSON.stringify({
      projects: [{ id: "p1", name: "P" }, { nope: true }],
      tasks: [
        {
          id: "t1",
          projectId: "p1",
          text: "keep",
          points: 3,
          subtasks: [{ id: "s1", text: "step", done: true }, { bad: 1 }],
        },
        { id: "t2", projectId: "gone", text: "orphan" },
        { id: "t3" },
      ],
    })
  );
  expect(loaded.projects).toEqual([
    { id: "p1", name: "P", order: 0, collapsed: false },
  ]);
  expect(loaded.tasks).toEqual([
    {
      id: "t1",
      projectId: "p1",
      text: "keep",
      notes: "",
      subtasks: [{ id: "s1", text: "step", done: true }],
      done: false,
      order: 0,
      points: 3,
    },
  ]);
  // Tasks saved before subtasks existed load with an empty list
  const legacy = loadProjectsState(
    JSON.stringify({
      projects: [{ id: "p1", name: "P" }],
      tasks: [{ id: "t1", projectId: "p1", text: "old" }],
    })
  );
  expect(legacy.tasks[0].subtasks).toEqual([]);
});
