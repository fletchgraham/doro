import { useState } from "react";

const useTasks = () => {
  const [tasks, setTasks] = useState<string[]>([]);
  const [curTask, setCurTask] = useState<string | null>(null);

  const addTask = (text: string) => setTasks([...tasks, text]);

  const removeTask = (text: string) =>
    setTasks(tasks.filter((item) => item !== text));

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
