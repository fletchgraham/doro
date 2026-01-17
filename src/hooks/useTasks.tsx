import { useState } from "react";

const useTasks = () => {
  const [tasks, setTasks] = useState(["an important task", "another task"]);
  return { tasks: tasks, setTasks: setTasks };
};

export default useTasks;
