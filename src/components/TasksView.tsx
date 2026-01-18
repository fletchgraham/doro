import { useState } from "react";

function TasksView({
  taskManager,
}: {
  taskManager: {
    tasks: string[];
    curTask: string | null;
    addTask: CallableFunction;
    removeTask: CallableFunction;
  };
}) {
  const [newTask, setNewTask] = useState("");

  const handleAddTask = () => {
    taskManager.addTask(newTask);
    setNewTask("");
  };

  return (
    <>
      <h2>{taskManager.curTask}</h2>
      <ul>
        {taskManager.tasks.map((task) => {
          return (
            <li key={task}>
              <button onClick={() => taskManager.removeTask(task)}>X</button>{" "}
              {task}
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
