import { useState, useEffect } from "react";
import type Task from "../types/Task";

const createTask = (text: string): Task => {
  return {
    text: text,
    notes: "",
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

  return {
    tasks: tasks,
    curTask: curTask,
    addTask: addTask,
    removeTask: removeTask,
    nextTask: nextTask,
  };
};

export default useTasks;
