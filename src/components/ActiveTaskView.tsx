import { useState, useRef, useEffect } from "react";
import type Task from "../types/Task";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatEstimate, parseTime } from "@/lib/parseTime";
import { getLiveDuration } from "@/lib/getDuration";
import { formatDuration } from "@/lib/formatDuration";
import { ExternalLink } from "lucide-react";

interface ActiveTaskViewProps {
  task: Task | undefined;
  isPaused: boolean;
  onNotesChange: (task: Task, notes: string) => void;
  onTextChange: (task: Task, text: string) => void;
  onUrlChange: (task: Task, url: string | undefined) => void;
  onDurationOverride: (task: Task, duration: number) => void;
  onDone?: () => void;
  onDeactivate?: () => void;
}

function ActiveTaskView({
  task,
  isPaused,
  onNotesChange,
  onTextChange,
  onUrlChange,
  onDurationOverride,
  onDone,
  onDeactivate,
}: ActiveTaskViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [editDurationInput, setEditDurationInput] = useState("");
  const [liveDuration, setLiveDuration] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Live duration ticker
  useEffect(() => {
    if (!task) return;

    const update = () => {
      if (!isPaused) {
        setLiveDuration(getLiveDuration(task.events));
      } else {
        setLiveDuration(task.duration);
      }
    };

    update();

    if (!isPaused) {
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    }
  }, [task, task?.events, task?.duration, isPaused]);

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

  const handleStartDurationEdit = () => {
    const currentDuration = !isPaused ? liveDuration : task.duration;
    setEditDurationInput(formatEstimate(currentDuration) || formatDuration(currentDuration));
    setIsEditingDuration(true);
  };

  const handleDurationSave = () => {
    const parsed = parseTime(editDurationInput);
    if (parsed !== null) {
      onDurationOverride(task, parsed);
    }
    setIsEditingDuration(false);
  };

  const handleDurationKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleDurationSave();
    } else if (e.key === "Escape") {
      setIsEditingDuration(false);
    }
  };

  const bgColor = task.color || "#9ca3af";
  const displayDuration = liveDuration;

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
            className="text-2xl font-semibold cursor-text hover:bg-muted/50 rounded px-1 -mx-1 flex items-center gap-2"
            onClick={handleStartEdit}
          >
            {task.text}
            {task.url && (
              <a
                href={task.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground hover:text-foreground"
                title={task.url}
              >
                <ExternalLink className="size-4" />
              </a>
            )}
          </h2>
        )}
        {isEditingDuration ? (
          <Input
            value={editDurationInput}
            onChange={(e) => setEditDurationInput(e.target.value)}
            onBlur={handleDurationSave}
            onKeyDown={handleDurationKeyDown}
            onFocus={(e) => e.target.select()}
            autoFocus
            className="w-24 text-lg h-auto py-1"
            placeholder="20m"
          />
        ) : (
          displayDuration > 0 && (
            <span
              className="text-lg text-muted-foreground cursor-text hover:bg-muted/50 rounded px-1"
              onClick={handleStartDurationEdit}
              title="Click to edit duration"
            >
              {formatEstimate(displayDuration)}
            </span>
          )
        )}
      </div>
      <Input
        value={task.url || ""}
        onChange={(e) => onUrlChange(task, e.target.value || undefined)}
        placeholder="URL..."
        className="mb-2 text-sm"
      />
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
