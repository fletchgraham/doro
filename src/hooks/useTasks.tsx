import { useState } from "react";

const useTasks = () => {
  const [tasks, setTasks] = useState(["an important task", "another task"]);

  const addTask = (text: string) => setTasks([...tasks, text]);

  return { tasks: tasks, setTasks: setTasks, addTask: addTask };
};

export default useTasks;
