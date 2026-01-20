import { useState, useEffect } from "react";
import type Task from "../types/Task";

const createTask = (text: string): Task => {
  return {
    text: text,
    notes: "",
    events: [],
    duration: 0,
    active: false,
    id: crypto.randomUUID(),
  };
};

const useTasks = () => {
  const [tasks, setTasks] = useState<Task[]>(() =>
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

  const addTask = (text: string) => {
    setTasks((tasks) => [...tasks, createTask(text)]);
  };

  const removeTask = (task: Task) => {
    setTasks((tasks) => tasks.filter((item) => item.text !== task.text));
  };

  const nextTask = () => {
    setTasks((tasks) => {
      const inactiveTasks = tasks.filter((task) => !task.active);
      const activeTask = tasks.find((task) => task.active);
      const updated = [
        ...inactiveTasks.map((task, i) => ({ ...task, active: i === 0 })),
      ];

      if (activeTask) updated.push({ ...activeTask, active: false });

      return updated;
    });
  };

  const setCurNotes = (text: string) => {
    setTasks((tasks) =>
      tasks.map((task) => (task.active ? { ...task, notes: text } : task)),
    );
  };

  const logStart = () => {
    setTasks((tasks) =>
      tasks.map((task) =>
        task.active
          ? {
              ...task,
              events: [
                ...task.events,
                { eventType: "start", timestamp: Date.now() },
              ],
            }
          : task,
      ),
    );
  };

  const logPause = () => {
    setTasks((tasks) =>
      tasks.map((task) =>
        task.active
          ? {
              ...task,
              duration: getDuration(task),
              events: [
                ...task.events,
                { eventType: "stop", timestamp: Date.now() },
              ],
            }
          : task,
      ),
    );
  };

  return {
    tasks,
    getActiveTask,
    getInactiveTasks,
    addTask,
    removeTask,
    nextTask,
    setCurNotes,
    logStart,
    logPause,
  };
};

const getDuration = (task: Task): number => {
  let total = 0;
  let curStart: number | null = null;

  for (const event of task.events) {
    if (!curStart && event.eventType === "start") {
      curStart = event.timestamp;
    }

    if (curStart && event.eventType === "stop") {
      total += event.timestamp - curStart;
      curStart = null;
    }
  }

  return total;
};

export default useTasks;
