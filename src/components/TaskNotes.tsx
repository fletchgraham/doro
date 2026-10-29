import { Textarea } from "@/components/ui/textarea";
import { handleLineMoveKeyDown } from "../lib/moveLine";
import { cn } from "@/lib/utils";

// A task's notes, shown above its checklist like a description. There's
// no box while they're empty: the ⋮ menu's "Add notes" opens one
// (`editing`), and clearing it and clicking away hides it again.

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

function TaskNotes({
  notes,
  onChange,
  editing,
  onEditingChange,
  className,
}: {
  notes: string;
  onChange: (notes: string) => void;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  className?: string;
}) {
  if (!notes.trim() && !editing) return null;
  return (
    <Textarea
      value={notes}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        const moved = handleLineMoveKeyDown(e);
        if (moved !== null) onChange(moved);
      }}
      onFocus={() => onEditingChange(true)}
      onBlur={() => onEditingChange(false)}
      onClick={stop}
      onPointerDown={stop}
      autoFocus={editing}
      placeholder="Notes..."
      aria-label="Task notes"
      data-testid="task-notes"
      className={cn(
        "min-h-0 resize-none border-transparent shadow-none bg-transparent dark:bg-transparent px-1 py-0.5 text-muted-foreground whitespace-pre-wrap hover:border-input focus-visible:border-ring focus-visible:text-foreground",
        className
      )}
    />
  );
}

export default TaskNotes;
