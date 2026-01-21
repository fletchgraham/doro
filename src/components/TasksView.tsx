import { useState, useEffect } from "react";
import type Task from "../types/Task";
import { formatDuration } from "../lib/formatDuration";

interface TaskManager {
  tasks: Task[];
  getActiveTask: () => Task | undefined;
  getInactiveTasks: () => Task[];
  getTasksByStatus: (status: string) => Task[];
  addTask: (text: string) => void;
  removeTask: (task: Task) => void;
  setNotes: (task: Task, text: string) => void;
  setText: (task: Task, text: string) => void;
  setStatus: (task: Task, status: Task["status"]) => void;
  reorderTask: (task: Task, direction: "up" | "down") => void;
}

const statusIndicators: Record<string, string> = {
  backlog: "⚪",
  ready: "🔵",
  working: "🟡",
  done: "✅",
};

function TasksView({ taskManager }: { taskManager: TaskManager }) {
  const [newTask, setNewTask] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedTaskId) return;

      const task = taskManager.tasks.find((t) => t.id === selectedTaskId);
      if (!task) return;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        taskManager.reorderTask(task, "up");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        taskManager.reorderTask(task, "down");
      } else if (e.key === "Escape") {
        setSelectedTaskId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTaskId, taskManager]);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTask.trim()) {
      taskManager.addTask(newTask.trim());
      setNewTask("");
    }
  };

  const activeTask = taskManager.getActiveTask();

  return (
    <div onClick={() => setSelectedTaskId(null)}>
      <h2>{activeTask?.text}</h2>
      {activeTask && (
        <textarea
          value={activeTask.notes}
          onChange={(e) => taskManager.setNotes(activeTask, e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      <h3>Working</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {taskManager.getTasksByStatus("working").map((task: Task) => (
          <TaskItem
            key={task.id}
            task={task}
            manager={taskManager}
            isSelected={selectedTaskId === task.id}
            onSelect={(id) => setSelectedTaskId(id)}
          />
        ))}
      </ul>
      <h3>Ready</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {taskManager.getTasksByStatus("ready").map((task: Task) => (
          <TaskItem
            key={task.id}
            task={task}
            manager={taskManager}
            isSelected={selectedTaskId === task.id}
            onSelect={(id) => setSelectedTaskId(id)}
          />
        ))}
      </ul>
      <h3>Done</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {taskManager.getTasksByStatus("done").map((task: Task) => (
          <TaskItem
            key={task.id}
            task={task}
            manager={taskManager}
            isSelected={selectedTaskId === task.id}
            onSelect={(id) => setSelectedTaskId(id)}
          />
        ))}
      </ul>
      <div>
        <form onSubmit={handleAddTask}>
          <input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          <button type="submit" disabled={newTask.length === 0}>
            Add
          </button>
        </form>
      </div>
    </div>
  );
}

interface TaskItemProps {
  task: Task;
  manager: TaskManager;
  isSelected: boolean;
  onSelect: (taskId: string) => void;
}

const TaskItem = ({ task, manager, isSelected, onSelect }: TaskItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);

  const statuses: Task["status"][] = ["backlog", "ready", "working", "done"];

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditText(task.text);
  };

  const handleSave = () => {
    if (editText.trim()) {
      manager.setText(task, editText.trim());
    } else {
      setEditText(task.text);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditText(task.text);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditing) {
      onSelect(task.id);
    }
  };

  return (
    <li
      onClick={handleClick}
      style={{
        cursor: "pointer",
        backgroundColor: isSelected ? "#e0e0ff" : "transparent",
        border: isSelected ? "2px solid #6666ff" : "2px solid transparent",
        padding: "8px 12px",
        borderRadius: "6px",
        marginBottom: "4px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <span>{statusIndicators[task.status] || "⚪"}</span>

      <button
        onClick={(e) => {
          e.stopPropagation();
          manager.removeTask(task);
        }}
        style={{ padding: "2px 6px", fontSize: "12px" }}
      >
        ×
      </button>

      {isEditing ? (
        <input
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
          onClick={(e) => e.stopPropagation()}
          style={{ flex: 1 }}
        />
      ) : (
        <span
          onDoubleClick={handleDoubleClick}
          style={{
            flex: 1,
            textDecoration: task.status === "done" ? "line-through" : "",
            color: task.status === "done" ? "#888" : "inherit",
          }}
        >
          {task.text}
        </span>
      )}

      <span style={{ color: "#666", fontSize: "12px", minWidth: "50px" }}>
        {formatDuration(task.duration)}
      </span>

      <select
        value={task.status}
        onChange={(e) =>
          manager.setStatus(task, e.target.value as Task["status"])
        }
        onClick={(e) => e.stopPropagation()}
        style={{ fontSize: "12px" }}
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
