import { useEffect, useReducer, useRef } from "react";
import type { Project, ProjectTask } from "../types/Project";
import projectsReducer, {
  byOrder,
  loadProjectsState,
  tasksForProject,
  type ProjectsAction,
} from "../lib/projectsReducer";

const STORAGE_KEY = "doroProjects";
const STORAGE_DEBOUNCE_MS = 500;

const useProjects = () => {
  const [state, dispatch] = useReducer(projectsReducer, null, () =>
    loadProjectsState(localStorage.getItem(STORAGE_KEY))
  );
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced like the day's tasks, so typing notes doesn't thrash storage
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, STORAGE_DEBOUNCE_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [state]);

  const apply = (action: ProjectsAction) => dispatch(action);

  return {
    state,
    dispatch: apply,
    projects: byOrder(state.projects),
    tasksFor: (projectId: string) => tasksForProject(state, projectId),
    addProject: (name: string) => apply({ type: "ADD_PROJECT", name }),
    renameProject: (project: Project, name: string) =>
      apply({ type: "RENAME_PROJECT", projectId: project.id, name }),
    removeProject: (project: Project) =>
      apply({ type: "REMOVE_PROJECT", projectId: project.id }),
    setCollapsed: (project: Project, collapsed: boolean) =>
      apply({ type: "SET_PROJECT_COLLAPSED", projectId: project.id, collapsed }),
    addTask: (project: Project, text: string) =>
      apply({ type: "ADD_TASK", projectId: project.id, text }),
    setTaskText: (task: ProjectTask, text: string) =>
      apply({ type: "SET_TASK_TEXT", taskId: task.id, text }),
    setTaskNotes: (task: ProjectTask, notes: string) =>
      apply({ type: "SET_TASK_NOTES", taskId: task.id, notes }),
    setTaskPoints: (task: ProjectTask, points: number | undefined) =>
      apply({ type: "SET_TASK_POINTS", taskId: task.id, points }),
    setTaskDone: (task: ProjectTask, done: boolean) =>
      apply({ type: "SET_TASK_DONE", taskId: task.id, done }),
    moveTask: (task: ProjectTask, projectId: string, order: number) =>
      apply({ type: "MOVE_TASK", taskId: task.id, projectId, order }),
    removeTask: (task: ProjectTask) =>
      apply({ type: "REMOVE_TASK", taskId: task.id }),
  };
};

export type ProjectManager = ReturnType<typeof useProjects>;

export default useProjects;
