import { useEffect, useReducer } from "react";
import type Task from "../types/Task";
import tasksReducer from "../lib/tasksReducer";

const useTasks = () => {
  const [tasks, dispatch] = useReducer(
    tasksReducer,
    JSON.parse(localStorage.getItem("doroTasks") || "[]"),
  );

  const saveTasks = () => {
    localStorage.setItem("doroTasks", JSON.stringify(tasks));
  };

  useEffect(() => {
    saveTasks();
  }, [tasks]);

  const getActiveTask = (): Task | undefined =>
    tasks.find((task) => task.active);

  const getInactiveTasks = (): Task[] => tasks.filter((task) => !task.active);

  const getTasksByStatus = (status: string): Task[] =>
    tasks.filter((task) => task.status === status);

  const addTask = (text: string) => dispatch({ type: "ADD_TASK", text });

  const removeTask = (task: Task) =>
    dispatch({ type: "REMOVE_TASK", taskId: task.id });

  const nextTask = () => dispatch({ type: "NEXT_TASK" });

  const setStatus = (task: Task, status: string) =>
    dispatch({ type: "SET_STATUS", taskId: task.id, status: status });

  const setNotes = (task: Task, text: string) =>
    dispatch({ type: "SET_NOTES", taskId: task.id, text });

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
    setNotes: setNotes,
    logStart,
    logPause,
    setStatus,
  };
};

export default useTasks;
