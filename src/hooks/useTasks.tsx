import { useEffect, useReducer } from "react";
import type Task from "../types/Task";
import tasksReducer from "../lib/tasksReducer";

const migrateTask = (task: Task, index: number): Task => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const legacy = task as any;
  let status = task.status ?? "backlog";

  // Migrate from old active boolean to active status
  if (legacy.active === true) {
    status = "active";
  }

  const migrated: Task = {
    ...task,
    order: task.order ?? index * 1000,
    status,
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

  useEffect(() => {
    localStorage.setItem("doroTasks", JSON.stringify(tasks));
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

  const removeTask = (task: Task) =>
    dispatch({ type: "REMOVE_TASK", taskId: task.id });

  const nextTask = () => dispatch({ type: "NEXT_TASK" });

  const setStatus = (task: Task, status: Task["status"]) =>
    dispatch({ type: "SET_STATUS", taskId: task.id, status });

  const setNotes = (task: Task, text: string) =>
    dispatch({ type: "SET_NOTES", taskId: task.id, text });

  const setText = (task: Task, text: string) =>
    dispatch({ type: "SET_TEXT", taskId: task.id, text });

  const setProject = (task: Task, projectId: string | undefined) =>
    dispatch({ type: "SET_PROJECT", taskId: task.id, projectId });

  const reorderTask = (task: Task, direction: "up" | "down") =>
    dispatch({ type: "REORDER_TASK", taskId: task.id, direction });

  const completeTask = () => dispatch({ type: "COMPLETE_TASK" });

  const logStart = () => dispatch({ type: "LOG_START" });
  const logPause = () => dispatch({ type: "LOG_PAUSE" });

  return {
    tasks,
    getActiveTask,
    getInactiveTasks,
    getTasksByStatus,
    addTask,
    removeTask,
    nextTask,
    setNotes,
    setText,
    setStatus,
    setProject,
    reorderTask,
    completeTask,
    logStart,
    logPause,
  };
};

export default useTasks;
