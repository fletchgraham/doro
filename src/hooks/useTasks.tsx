import { useState } from "react";

const useTasks = () => {
  const [tasks, setTasks] = useState(["an important task", "another task"]);
  const [curTask, setCurTask] = useState<string | null>(null);

  const addTask = (text: string) => setTasks([...tasks, text]);
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
    setTasks: setTasks,
    addTask: addTask,
    nextTask: nextTask,
  };
};

export default useTasks;
