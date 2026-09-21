import { useEffect, useReducer, useRef, useState } from "react";
import type Task from "../types/Task";
import type Subtask from "../types/Subtask";
import tasksReducer from "../lib/tasksReducer";
import { normalizeSubtasks } from "../lib/subtasks";

const STORAGE_DEBOUNCE_MS = 500;

const migrateTask = (task: Task, index: number): Task => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const legacy = task as any;
  // Backlog is no longer a status; fold legacy backlog tasks into ready
  let status: Task["status"] =
    task.status == null || (task.status as string) === "backlog"
      ? "ready"
      : task.status;

  // Migrate from old active boolean to active status
  if (legacy.active === true) {
    status = "active";
  }

  const migrated: Task = {
    ...task,
    order: task.order ?? index * 1000,
    status,
    // Tasks saved before subtasks existed have none
    subtasks: normalizeSubtasks(task.subtasks),
  };

  // Remove legacy active field
  delete (migrated as any).active; // eslint-disable-line @typescript-eslint/no-explicit-any

  return migrated;
};

const useTasks = () => {
  const [tasks, dispatch] = useReducer(
    tasksReducer,
    JSON.parse(localStorage.getItem("doroTasks") || "[]"),
    (initial: Task[]) => initial.map(migrateTask)
  );
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // When locked, the ready list doesn't feed new tasks into working/active
  const [readyLocked, setReadyLocked] = useState(
    () => localStorage.getItem("doroReadyLocked") === "true"
  );

  useEffect(() => {
    localStorage.setItem("doroReadyLocked", String(readyLocked));
  }, [readyLocked]);

  // Debounce localStorage writes to reduce lag during rapid updates (e.g., typing notes)
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      localStorage.setItem("doroTasks", JSON.stringify(tasks));
    }, STORAGE_DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [tasks]);

  const getActiveTask = (): Task | undefined =>
    tasks.find((task) => task.status === "active");

  const getInactiveTasks = (): Task[] =>
    tasks.filter((task) => task.status !== "active");

  const getTasksByStatus = (status: string): Task[] =>
    tasks
      .filter((task) => task.status === status)
      .sort((a, b) => a.order - b.order);

  const addTask = (text: string) => dispatch({ type: "ADD_TASK", text });

  const addTaskWithOptions = (
    text: string,
    status: Task["status"],
    position: "top" | "bottom",
    estimate?: number,
    subtasks?: Subtask[]
  ) =>
    dispatch({
      type: "ADD_TASK_WITH_OPTIONS",
      text,
      status,
      position,
      estimate,
      subtasks,
    });

  // Pull a project task into today's ready list, linked so notes,
  // subtasks and completion stay shared with the projects page
  const addProjectTask = (
    text: string,
    notes: string,
    subtasks: Subtask[],
    projectTaskId: string
  ) =>
    dispatch({
      type: "ADD_TASK_WITH_OPTIONS",
      text,
      status: "ready",
      position: "bottom",
      notes,
      subtasks,
      projectTaskId,
    });

  const removeTask = (task: Task) =>
    dispatch({ type: "REMOVE_TASK", taskId: task.id });

  const nextTask = (shuffle = false) =>
    dispatch({ type: "NEXT_TASK", shuffle, pullFromReady: !readyLocked });

  const setStatus = (task: Task, status: Task["status"]) =>
    dispatch({ type: "SET_STATUS", taskId: task.id, status });

  const setNotes = (task: Task, text: string) =>
    dispatch({ type: "SET_NOTES", taskId: task.id, text });

  const setText = (task: Task, text: string) =>
    dispatch({ type: "SET_TEXT", taskId: task.id, text });

  const setColor = (task: Task, color: string | undefined) =>
    dispatch({ type: "SET_COLOR", taskId: task.id, color });

  const setEstimate = (task: Task, estimate: number | undefined) =>
    dispatch({ type: "SET_ESTIMATE", taskId: task.id, estimate });

  const setUrl = (task: Task, url: string | undefined) =>
    dispatch({ type: "SET_URL", taskId: task.id, url });

  const addSubtask = (task: Task, text: string) =>
    dispatch({ type: "ADD_SUBTASK", taskId: task.id, text });

  const setSubtaskText = (task: Task, subtask: Subtask, text: string) =>
    dispatch({
      type: "SET_SUBTASK_TEXT",
      taskId: task.id,
      subtaskId: subtask.id,
      text,
    });

  const setSubtaskDone = (task: Task, subtask: Subtask, done: boolean) =>
    dispatch({
      type: "SET_SUBTASK_DONE",
      taskId: task.id,
      subtaskId: subtask.id,
      done,
    });

  const moveSubtask = (task: Task, subtask: Subtask, index: number) =>
    dispatch({
      type: "MOVE_SUBTASK",
      taskId: task.id,
      subtaskId: subtask.id,
      index,
    });

  const removeSubtask = (task: Task, subtask: Subtask) =>
    dispatch({ type: "REMOVE_SUBTASK", taskId: task.id, subtaskId: subtask.id });

  const setSubtasks = (task: Task, subtasks: Subtask[]) =>
    dispatch({ type: "SET_SUBTASKS", taskId: task.id, subtasks });

  const reorderTask = (task: Task, direction: "up" | "down") =>
    dispatch({ type: "REORDER_TASK", taskId: task.id, direction });

  const moveTask = (task: Task, toStatus: Task["status"], newOrder: number) =>
    dispatch({ type: "MOVE_TASK", taskId: task.id, toStatus, newOrder });

  const completeTask = () =>
    dispatch({ type: "COMPLETE_TASK", pullFromReady: !readyLocked });

  const logStart = () => dispatch({ type: "LOG_START" });
  const logPause = () => dispatch({ type: "LOG_PAUSE" });

  const overrideDuration = (task: Task, duration: number) =>
    dispatch({ type: "OVERRIDE_DURATION", taskId: task.id, duration });

  const importTasks = (
    tasks: Array<{
      text: string;
      notes: string;
      url?: string;
      color?: string;
      estimate?: number;
      todoistId?: string;
    }>
  ) => dispatch({ type: "IMPORT_TASKS", tasks });

  const mergeWorkflowyTasks = (
    nodes: Array<{
      workflowyId: string;
      text: string;
      notes: string;
      url: string;
      completed: boolean;
    }>
  ) => dispatch({ type: "WORKFLOWY_MERGE", nodes });

  const setWorkflowyId = (taskId: string, workflowyId: string, url: string) =>
    dispatch({ type: "SET_WORKFLOWY_ID", taskId, workflowyId, url });

  return {
    tasks,
    readyLocked,
    setReadyLocked,
    getActiveTask,
    getInactiveTasks,
    getTasksByStatus,
    addTask,
    addTaskWithOptions,
    addProjectTask,
    removeTask,
    nextTask,
    setNotes,
    setText,
    setStatus,
    setColor,
    setEstimate,
    setUrl,
    addSubtask,
    setSubtaskText,
    setSubtaskDone,
    moveSubtask,
    removeSubtask,
    setSubtasks,
    reorderTask,
    moveTask,
    completeTask,
    logStart,
    logPause,
    overrideDuration,
    importTasks,
    mergeWorkflowyTasks,
    setWorkflowyId,
  };
};

export default useTasks;
