import { useState } from "react";
import type Task from "../types/Task";

function TasksView({
  taskManager,
}: {
  taskManager: {
    tasks: Task[];
    curTask: Task | null;
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
      <h2>{taskManager.curTask?.text}</h2>
      <textarea
        value={taskManager.curTask?.notes || ""}
        onChange={(e) => taskManager.setCurNotes(e.target.value)}
      ></textarea>
      <ul>
        {taskManager.tasks.map((task) => {
          return (
            <li key={task.id}>
              <button onClick={() => taskManager.removeTask(task)}>X</button>{" "}
              {task.text} ({task.duration / (60 * 1000)}min)
            </li>
          );
        })}
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
