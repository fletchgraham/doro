import { useState, useRef, useEffect } from "react";
import type Task from "../types/Task";
import type Subtask from "../types/Subtask";
import SubtaskList from "./SubtaskList";
import LinkedText from "./LinkedText";
import TaskMenu from "./TaskMenu";
import TaskNotes from "./TaskNotes";
import { Input } from "@/components/ui/input";
import { formatEstimate, parseTime } from "@/lib/parseTime";
import { getLiveDuration } from "@/lib/getDuration";
import { formatDuration } from "@/lib/formatDuration";
import { fireConfetti } from "@/lib/confetti";
import { cn } from "@/lib/utils";
import { ExternalLink, FolderKanban } from "lucide-react";
import { routeHash } from "@/hooks/useHashRoute";

interface ActiveTaskViewProps {
  task: Task | undefined;
  isPaused: boolean;
  onNotesChange: (task: Task, notes: string) => void;
  onTextChange: (task: Task, text: string) => void;
  onUrlChange: (task: Task, url: string | undefined) => void;
  onColorChange: (task: Task, color: string | undefined) => void;
  onRemove: (task: Task) => void;
  onAddSubtask: (task: Task, text: string) => void;
  onSubtaskTextChange: (task: Task, subtask: Subtask, text: string) => void;
  onSubtaskDoneChange: (task: Task, subtask: Subtask, done: boolean) => void;
  onMoveSubtask: (task: Task, subtask: Subtask, index: number) => void;
  onRemoveSubtask: (task: Task, subtask: Subtask) => void;
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
  onColorChange,
  onRemove,
  onAddSubtask,
  onSubtaskTextChange,
  onSubtaskDoneChange,
  onMoveSubtask,
  onRemoveSubtask,
  onDurationOverride,
  onDone,
  onDeactivate,
}: ActiveTaskViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [editDurationInput, setEditDurationInput] = useState("");
  const [liveDuration, setLiveDuration] = useState(0);
  const [notesEditing, setNotesEditing] = useState(false);
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

  const displayDuration = liveDuration;
  const isOverEstimate = !!task.estimate && displayDuration > task.estimate;

  // Laid out like a task row, just larger: checkbox, color dot, name,
  // time and ⋮, with the notes and checklist under the name
  return (
    <div className="mt-6" data-testid="active-task">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={false}
          disabled={!onDone}
          onChange={(e) => {
            if (!onDone) return;
            const rect = e.currentTarget.getBoundingClientRect();
            fireConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
            onDone();
          }}
          className="size-5 accent-green-500 cursor-pointer shrink-0"
          aria-label={`Complete "${task.text}"`}
          title="Complete"
        />
        <div
          className="w-3.5 h-3.5 rounded-full shrink-0"
          style={{ backgroundColor: task.color || "#9ca3af" }}
          aria-hidden="true"
        />
        {isEditing ? (
          <Input
            ref={inputRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="text-2xl font-semibold h-auto py-1 flex-1 min-w-0"
          />
        ) : (
          <h2
            className="flex-1 text-2xl font-semibold cursor-text hover:bg-muted/50 rounded px-1 -mx-1 min-w-0 break-words"
            onClick={handleStartEdit}
          >
            <LinkedText text={task.text} />
            {task.projectTaskId && (
              <a
                href={routeHash.projects}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex align-[-2px] ml-2 text-muted-foreground hover:text-foreground"
                title="Part of a project — open Projects"
                aria-label="Part of a project — open Projects"
                data-testid="task-project-indicator"
              >
                <FolderKanban className="size-4" />
              </a>
            )}
            {task.url && (
              <a
                href={task.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex align-[-2px] ml-2 text-muted-foreground hover:text-foreground"
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
          <span
            className={cn(
              "text-lg tabular-nums cursor-text hover:bg-muted/50 rounded px-1 whitespace-nowrap",
              isOverEstimate
                ? "text-red-600 dark:text-red-400"
                : "text-muted-foreground"
            )}
            onClick={handleStartDurationEdit}
            title="Click to edit duration"
            data-testid="active-task-duration"
          >
            {formatEstimate(displayDuration) || "0m"}
            {task.estimate ? ` / ${formatEstimate(task.estimate)}` : ""}
          </span>
        )}
        <TaskMenu
          task={task}
          onColorChange={(color) => onColorChange(task, color)}
          onUrlChange={(url) => onUrlChange(task, url)}
          onAddNotes={() => setNotesEditing(true)}
          onDeactivate={onDeactivate}
          onRemove={() => onRemove(task)}
          alwaysVisible
        />
      </div>
      <div className="pl-[3.375rem] mt-1 space-y-1">
        <TaskNotes
          notes={task.notes}
          onChange={(notes) => onNotesChange(task, notes)}
          editing={notesEditing}
          onEditingChange={setNotesEditing}
        />
        <SubtaskList
          subtasks={task.subtasks}
          onAdd={(text) => onAddSubtask(task, text)}
          onTextChange={(subtask, text) => onSubtaskTextChange(task, subtask, text)}
          onDoneChange={(subtask, done) => onSubtaskDoneChange(task, subtask, done)}
          onMove={(subtask, index) => onMoveSubtask(task, subtask, index)}
          onRemove={(subtask) => onRemoveSubtask(task, subtask)}
        />
      </div>
    </div>
  );
}

export default ActiveTaskView;
