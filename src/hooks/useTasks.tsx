import { useState, useEffect } from "react";

const saveTasks = (tasks: string[]) => {
  localStorage.setItem("doroTasks", JSON.stringify(tasks));
};

const saveCurTask = (curTask: string | null) => {
  if (curTask) {
    localStorage.setItem("doroCurTask", curTask);
  } else {
    localStorage.removeItem("doroCurTask");
  }
};

const useTasks = () => {
  const [tasks, setTasks] = useState<string[]>(() =>
    JSON.parse(localStorage.getItem("doroTasks") || "[]"),
  );

  const [curTask, setCurTask] = useState<string | null>(() => {
    return localStorage.getItem("doroCurTask");
  });

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    saveCurTask(curTask);
  }, [curTask]);

  const addTask = (text: string) => {
    setTasks([...tasks, text]);
  };

  const removeTask = (text: string) => {
    setTasks(tasks.filter((item) => item !== text));
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
