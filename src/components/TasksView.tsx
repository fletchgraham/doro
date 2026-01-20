import { useState } from "react";
import type Task from "../types/Task";

function TasksView({
  taskManager,
}: {
  taskManager: {
    tasks: Task[];
    getActiveTask: CallableFunction;
    getInactiveTasks: CallableFunction;
    addTask: CallableFunction;
    removeTask: CallableFunction;
    setCurNotes: CallableFunction;
  };
}) {
  const [newTask, setNewTask] = useState("");

  const handleAddTask = () => {
    taskManager.addTask(newTask);
    setNewTask("");
  };

  return (
    <>
      <h2>{taskManager.getActiveTask()?.text}</h2>
      {taskManager.getActiveTask() && (
        <textarea
          value={taskManager.getActiveTask().notes}
          onChange={(e) => taskManager.setCurNotes(e.target.value)}
        ></textarea>
      )}
      <ul>
        {taskManager.getInactiveTasks().map((task: Task) => (
          <li key={task.id}>
            <button onClick={() => taskManager.removeTask(task)}>X</button>{" "}
            {task.text} ({task.duration / (60 * 1000)}min)
          </li>
        ))}
      </ul>
      <div>
        <form>
          <input value={newTask} onChange={(e) => setNewTask(e.target.value)} />
          <button
            type="submit"
            disabled={newTask.length === 0}
            onClick={handleAddTask}
          >
            Add
          </button>
        </form>
      </div>
    </>
  );
}

export default TasksView;
