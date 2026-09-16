import type { Project, ProjectTask, ProjectsState } from "../types/Project";

// Story point sizes a task can be given
export const POINT_OPTIONS = [1, 3, 5, 8] as const;

export type ProjectsAction =
  | { type: "ADD_PROJECT"; name: string }
  | { type: "RENAME_PROJECT"; projectId: string; name: string }
  | { type: "REMOVE_PROJECT"; projectId: string }
  | { type: "SET_PROJECT_COLLAPSED"; projectId: string; collapsed: boolean }
  | { type: "MOVE_PROJECT"; projectId: string; order: number }
  | { type: "ADD_TASK"; projectId: string; text: string }
  | { type: "SET_TASK_TEXT"; taskId: string; text: string }
  | { type: "SET_TASK_NOTES"; taskId: string; notes: string }
  | { type: "SET_TASK_POINTS"; taskId: string; points: number | undefined }
  | { type: "SET_TASK_DONE"; taskId: string; done: boolean }
  | { type: "MOVE_TASK"; taskId: string; projectId: string; order: number }
  | { type: "REMOVE_TASK"; taskId: string };

export const EMPTY_PROJECTS: ProjectsState = { projects: [], tasks: [] };

const nextOrder = (items: Array<{ order: number }>): number =>
  Math.max(...items.map((i) => i.order), 0) + 1000;

export const createProject = (name: string, order = Date.now()): Project => ({
  id: crypto.randomUUID(),
  name,
  order,
  collapsed: false,
});

export const createProjectTask = (
  projectId: string,
  text: string,
  order = Date.now()
): ProjectTask => ({
  id: crypto.randomUUID(),
  projectId,
  text,
  notes: "",
  done: false,
  order,
});

export const byOrder = <T extends { order: number }>(items: T[]): T[] =>
  [...items].sort((a, b) => a.order - b.order);

export const tasksForProject = (
  state: ProjectsState,
  projectId: string
): ProjectTask[] => byOrder(state.tasks.filter((t) => t.projectId === projectId));

/** Story points finished vs. total across a project's tasks. */
export const projectProgress = (
  tasks: ProjectTask[]
): { done: number; total: number } => {
  let done = 0;
  let total = 0;
  for (const task of tasks) {
    const points = task.points ?? 0;
    total += points;
    if (task.done) done += points;
  }
  return { done, total };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Parse the persisted store, dropping anything malformed. */
export const loadProjectsState = (raw: string | null): ProjectsState => {
  if (!raw) return EMPTY_PROJECTS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return EMPTY_PROJECTS;
    const projects = Array.isArray(parsed.projects)
      ? parsed.projects.filter(
          (p): p is Project =>
            isRecord(p) && typeof p.id === "string" && typeof p.name === "string"
        )
      : [];
    const projectIds = new Set(projects.map((p) => p.id));
    const tasks = Array.isArray(parsed.tasks)
      ? parsed.tasks.filter(
          (t): t is ProjectTask =>
            isRecord(t) &&
            typeof t.id === "string" &&
            typeof t.projectId === "string" &&
            typeof t.text === "string" &&
            projectIds.has(t.projectId)
        )
      : [];
    return {
      projects: projects.map((p, i) => ({
        ...p,
        order: typeof p.order === "number" ? p.order : i * 1000,
        collapsed: p.collapsed === true,
      })),
      tasks: tasks.map((t, i) => ({
        ...t,
        notes: typeof t.notes === "string" ? t.notes : "",
        done: t.done === true,
        order: typeof t.order === "number" ? t.order : i * 1000,
        points: typeof t.points === "number" ? t.points : undefined,
      })),
    };
  } catch {
    return EMPTY_PROJECTS;
  }
};

const updateTask = (
  state: ProjectsState,
  taskId: string,
  patch: Partial<ProjectTask>
): ProjectsState => ({
  ...state,
  tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
});

const projectsReducer = (
  state: ProjectsState,
  action: ProjectsAction
): ProjectsState => {
  switch (action.type) {
    case "ADD_PROJECT":
      return {
        ...state,
        projects: [
          ...state.projects,
          createProject(action.name, nextOrder(state.projects)),
        ],
      };
    case "RENAME_PROJECT":
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId ? { ...p, name: action.name } : p
        ),
      };
    case "REMOVE_PROJECT":
      return {
        projects: state.projects.filter((p) => p.id !== action.projectId),
        tasks: state.tasks.filter((t) => t.projectId !== action.projectId),
      };
    case "SET_PROJECT_COLLAPSED":
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId ? { ...p, collapsed: action.collapsed } : p
        ),
      };
    case "MOVE_PROJECT":
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId ? { ...p, order: action.order } : p
        ),
      };
    case "ADD_TASK": {
      if (!state.projects.some((p) => p.id === action.projectId)) return state;
      const siblings = state.tasks.filter((t) => t.projectId === action.projectId);
      return {
        ...state,
        tasks: [
          ...state.tasks,
          createProjectTask(action.projectId, action.text, nextOrder(siblings)),
        ],
      };
    }
    case "SET_TASK_TEXT":
      return updateTask(state, action.taskId, { text: action.text });
    case "SET_TASK_NOTES":
      return updateTask(state, action.taskId, { notes: action.notes });
    case "SET_TASK_POINTS":
      return updateTask(state, action.taskId, { points: action.points });
    case "SET_TASK_DONE":
      return updateTask(state, action.taskId, { done: action.done });
    case "MOVE_TASK":
      if (!state.projects.some((p) => p.id === action.projectId)) return state;
      return updateTask(state, action.taskId, {
        projectId: action.projectId,
        order: action.order,
      });
    case "REMOVE_TASK":
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.taskId),
      };
  }
};

export default projectsReducer;
