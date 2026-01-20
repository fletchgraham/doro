import { useState } from "react";
import type Task from "../types/Task";

interface TaskManager {
  tasks: Task[];
  getActiveTask: CallableFunction;
  getInactiveTasks: CallableFunction;
  addTask: CallableFunction;
  removeTask: CallableFunction;
  setNotes: CallableFunction;
  setStatus: CallableFunction;
}

function TasksView({ taskManager }: { taskManager: TaskManager }) {
  const [newTask, setNewTask] = useState("");

  const handleAddTask = () => {
    taskManager.addTask(newTask);
    setNewTask("");
  };

  const activeTask = taskManager.getActiveTask();

  return (
    <>
      <h2>{activeTask?.text}</h2>
      {activeTask && (
        <textarea
          value={activeTask.notes}
          onChange={(e) => taskManager.setNotes(activeTask, e.target.value)}
        ></textarea>
      )}
      <ul>
        {taskManager.getInactiveTasks().map((task: Task) => (
          <TaskItem key={task.id} task={task} manager={taskManager} />
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

const TaskItem = ({ task, manager }: { task: Task; manager: TaskManager }) => {
  const totalSeconds = Math.floor(task.duration / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const statuses = ["backlog", "ready", "working", "done"];

  return (
    <li>
      <button onClick={() => manager.removeTask(task)}>X</button> {task.text}{" "}
      {hours}h {minutes}m {seconds}s {task.status}
      <select
        value={task.status}
        onChange={(e) => manager.setStatus(task, e.target.value)}
      >
        {statuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </li>
  );
};

export default TasksView;
