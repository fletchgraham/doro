import { useState, useRef, useEffect } from "react";
import type Task from "../types/Task";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatEstimate } from "@/lib/parseTime";

interface ActiveTaskViewProps {
  task: Task | undefined;
  onNotesChange: (task: Task, notes: string) => void;
  onTextChange: (task: Task, text: string) => void;
  onDone?: () => void;
  onDeactivate?: () => void;
}

function ActiveTaskView({
  task,
  onNotesChange,
  onTextChange,
  onDone,
  onDeactivate,
}: ActiveTaskViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (!task) {
    return <h2 className="text-2xl font-semibold text-muted-foreground mt-6">No active task</h2>;
  }

  const handleStartEdit = () => {
    setEditText(task.text);
    setIsEditing(true);
  };

  const handleSave = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== task.text) {
      onTextChange(task, trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setIsEditing(false);
    }
  };

  const bgColor = task.color || "#9ca3af";

  return (
    <div
      className="mt-6 p-4 rounded-lg"
      style={{ backgroundColor: `${bgColor}20` }}
    >
      <div className="flex items-baseline gap-3 mb-3">
        {isEditing ? (
          <Input
            ref={inputRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="text-2xl font-semibold h-auto py-1 flex-1"
          />
        ) : (
          <h2
            className="text-2xl font-semibold cursor-text hover:bg-muted/50 rounded px-1 -mx-1"
            onClick={handleStartEdit}
          >
            {task.text}
          </h2>
        )}
        {task.duration > 0 && (
          <span className="text-lg text-muted-foreground">
            {formatEstimate(task.duration)}
          </span>
        )}
      </div>
      <Textarea
        value={task.notes}
        onChange={(e) => onNotesChange(task, e.target.value)}
        placeholder="Notes..."
        className="min-h-[80px] resize-y bg-white"
      />
      {(onDone || onDeactivate) && (
        <div className="mt-2 flex gap-2">
          {onDone && <Button onClick={onDone}>Complete</Button>}
          {onDeactivate && (
            <Button variant="secondary" onClick={onDeactivate}>
              Deactivate
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default ActiveTaskView;
