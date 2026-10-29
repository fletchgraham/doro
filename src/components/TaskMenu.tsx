import { useRef, useState } from "react";
import type Task from "../types/Task";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { TASK_COLORS } from "@/lib/taskColors";
import {
  ArrowRight,
  EllipsisVertical,
  Link,
  NotebookPen,
  Trash2,
  Undo2,
} from "lucide-react";

// The ⋮ menu on a task, wherever it's shown: color, link, notes and the
// less common actions, so the rows themselves stay plain. Optional
// actions only show when their handler is given.

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export interface TaskMenuProps {
  task: Task;
  onColorChange: (color: string) => void;
  onUrlChange: (url: string | undefined) => void;
  // Opens the notes box; only offered while the task has no notes
  onAddNotes: () => void;
  onRemove: () => void;
  onMoveNext?: () => void;
  moveNextTitle?: string;
  onDeactivate?: () => void;
  // Keep the trigger visible instead of revealing it on hover
  alwaysVisible?: boolean;
  className?: string;
}

function TaskMenu({
  task,
  onColorChange,
  onUrlChange,
  onAddNotes,
  onRemove,
  onMoveNext,
  moveNextTitle,
  onDeactivate,
  alwaysVisible,
  className,
}: TaskMenuProps) {
  const [open, setOpen] = useState(false);
  // Set when an action moves focus elsewhere (the notes box), so closing
  // doesn't hand it back to the ⋮ button
  const focusMoved = useRef(false);

  // Run an action and close the menu
  const act = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={stop}
          onPointerDown={stop}
          className={cn(
            !open &&
              !alwaysVisible &&
              "can-hover:opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            className
          )}
          aria-label={`Actions for ${task.text}`}
          title="More actions"
        >
          <EllipsisVertical />
        </Button>
      </PopoverTrigger>
      {/* The content is portaled, but React events still bubble to the
          row: keep clicks and drags from selecting or dragging it */}
      <PopoverContent
        className="w-60 p-1 flex flex-col"
        align="end"
        data-testid="task-menu"
        onClick={stop}
        onPointerDown={stop}
        onDoubleClick={stop}
        onKeyDown={stop}
        onCloseAutoFocus={(e) => {
          if (focusMoved.current) e.preventDefault();
          focusMoved.current = false;
        }}
      >
        <div className="flex gap-1.5 px-2 py-1.5" role="group" aria-label="Color">
          {TASK_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => act(() => onColorChange(c.hex))}
              className={cn(
                "w-5 h-5 rounded-full cursor-pointer p-0 hover:scale-110 transition-transform",
                c.hex === task.color && "ring-2 ring-ring ring-offset-2 ring-offset-popover"
              )}
              style={{ backgroundColor: c.hex }}
              title={c.name}
              aria-label={`Color ${c.name}`}
              aria-pressed={c.hex === task.color}
            />
          ))}
        </div>
        <label className="flex items-center gap-2 px-2 py-1">
          <Link className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <Input
            value={task.url || ""}
            onChange={(e) => onUrlChange(e.target.value || undefined)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setOpen(false);
            }}
            placeholder="Link (URL)..."
            aria-label="Link"
            className="h-7 text-sm"
          />
        </label>
        {!task.notes.trim() && (
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => {
              focusMoved.current = true;
              act(onAddNotes);
            }}
          >
            <NotebookPen />
            Add notes
          </Button>
        )}
        {onMoveNext && (
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => act(onMoveNext)}
            title={moveNextTitle}
          >
            <ArrowRight />
            Move to next day
          </Button>
        )}
        {onDeactivate && (
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => act(onDeactivate)}
            title="Put it back in Working"
          >
            <Undo2 />
            Deactivate
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-destructive hover:text-destructive"
          onClick={() =>
            act(() => {
              if (window.confirm(`Delete "${task.text}"?`)) onRemove();
            })
          }
        >
          <Trash2 />
          Delete
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export default TaskMenu;
