import { useState, useEffect, useRef } from "react";
import type Task from "../types/Task";

interface SwitchTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  onSwitch: (task: Task) => void;
  onCreate: (text: string) => void;
}

function SwitchTaskModal({
  isOpen,
  onClose,
  tasks,
  onSwitch,
  onCreate,
}: SwitchTaskModalProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter to incomplete tasks that match query
  const incompleteTasks = tasks.filter(
    (t) => t.status !== "done" && t.status !== "active"
  );

  const filteredTasks = query.trim()
    ? incompleteTasks.filter((t) =>
        t.text.toLowerCase().includes(query.toLowerCase())
      )
    : incompleteTasks;


  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    setQuery("");
    setSelectedIndex(0);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filteredTasks.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (filteredTasks.length > 0) {
      // Switch to selected task
      onSwitch(filteredTasks[selectedIndex]);
    } else if (query.trim()) {
      // Create new task
      onCreate(query.trim());
    }
    handleClose();
  };

  const handleTaskClick = (task: Task) => {
    onSwitch(task);
    handleClose();
  };

  const hasMatches = filteredTasks.length > 0;
  const showCreateOption = query.trim() && !hasMatches;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "100px",
        zIndex: 100,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "16px",
          borderRadius: "8px",
          width: "400px",
          maxWidth: "90%",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks..."
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "16px",
              boxSizing: "border-box",
              border: "2px solid #ddd",
              borderRadius: "4px",
            }}
          />
        </form>

        <div
          style={{
            marginTop: "8px",
            maxHeight: "300px",
            overflowY: "auto",
          }}
        >
          {filteredTasks.map((task, index) => (
            <div
              key={task.id}
              onClick={() => handleTaskClick(task)}
              style={{
                padding: "10px 12px",
                cursor: "pointer",
                backgroundColor: index === selectedIndex ? "#e0e0ff" : "transparent",
                borderRadius: "4px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span>{task.text}</span>
              <span style={{ fontSize: "11px", color: "#888" }}>
                {task.status}
              </span>
            </div>
          ))}

          {showCreateOption && (
            <div
              style={{
                padding: "10px 12px",
                backgroundColor: "#e0e0ff",
                borderRadius: "4px",
                color: "#666",
              }}
            >
              Press Enter to create "{query}" and start
            </div>
          )}

          {!query.trim() && filteredTasks.length === 0 && (
            <div style={{ padding: "10px 12px", color: "#888" }}>
              No incomplete tasks
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SwitchTaskModal;
