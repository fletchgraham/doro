import { useState, useEffect } from "react";
import type Task from "../types/Task";

const createTask = (text: string): Task => {
  return {
    text: text,
    notes: "",
    events: [],
    id: crypto.randomUUID(),
  };
};

const saveTasks = (tasks: Task[]) => {
  localStorage.setItem("doroTasks", JSON.stringify(tasks));
};

const saveCurTask = (curTask: Task | null) => {
  if (curTask) {
    localStorage.setItem("doroCurTask", JSON.stringify(curTask));
  } else {
    localStorage.removeItem("doroCurTask");
  }
};

const useTasks = () => {
  const [tasks, setTasks] = useState<Task[]>(() =>
    JSON.parse(localStorage.getItem("doroTasks") || "[]"),
  );

  const [curTask, setCurTask] = useState<Task | null>(() => {
    const curTaskStore = localStorage.getItem("doroCurTask");
    if (!curTaskStore) {
      return null;
    } else {
      return JSON.parse(curTaskStore);
    }
  });

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    saveCurTask(curTask);
  }, [curTask]);

  const addTask = (text: string) => {
    setTasks([...tasks, createTask(text)]);
  };

  const removeTask = (task: Task) => {
    setTasks(tasks.filter((item) => item.text !== task.text));
  };

  const nextTask = () => {
    setCurTask(tasks[0]);

    if (curTask) {
      setTasks([...tasks.slice(1), curTask]);
    } else {
      setTasks([...tasks.slice(1)]);
    }
  };

  const setCurNotes = (text: string) => {
    if (!curTask) return;
    setCurTask({ ...curTask, notes: text });
  };

  const logStart = () => {
    if (!curTask) return;
    if (!curTask.events) curTask.events = [];
    curTask.events.push({
      eventType: "start",
      timestamp: Date.now(),
    });
  };

  const logPause = () => {
    if (!curTask) return;
    if (!curTask.events) curTask.events = [];
    curTask.events.push({
      eventType: "stop",
      timestamp: Date.now(),
    });
    saveCurTask(curTask);
  };

  return {
    tasks,
    curTask,
    addTask,
    removeTask,
    nextTask,
    setCurNotes,
    logStart,
    logPause,
  };
};

export default useTasks;
