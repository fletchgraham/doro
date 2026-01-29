import { useState, useEffect, useRef } from "react";
import type Task from "../types/Task";

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (
    text: string,
    status: Task["status"],
    position: "top" | "bottom"
  ) => void;
}

function AddTaskModal({ isOpen, onClose, onAdd }: AddTaskModalProps) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Task["status"]>("ready");
  const [position, setPosition] = useState<"top" | "bottom">("bottom");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleClose = () => {
    setText("");
    setStatus("ready");
    setPosition("bottom");
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onAdd(text.trim(), status, position);
      handleClose();
    }
  };

  const statuses: Task["status"][] = ["active", "working", "ready", "backlog"];

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
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "20px",
          borderRadius: "8px",
          minWidth: "300px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>Add Task</h3>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Task description..."
            style={{
              width: "100%",
              padding: "8px",
              fontSize: "14px",
              boxSizing: "border-box",
              marginBottom: "12px",
            }}
          />

          <div style={{ marginBottom: "12px" }}>
            <label style={{ fontSize: "12px", color: "#666" }}>
              Status:{" "}
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Task["status"])}
                style={{ fontSize: "14px" }}
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <button
              type="button"
              onClick={() => setPosition(position === "top" ? "bottom" : "top")}
              style={{ fontSize: "16px", padding: "4px 8px" }}
              title={position === "top" ? "Add to top" : "Add to bottom"}
            >
              {position === "top" ? "↑" : "↓"}
            </button>

            <button
              type="submit"
              disabled={!text.trim()}
              style={{ padding: "8px 16px" }}
            >
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddTaskModal;
