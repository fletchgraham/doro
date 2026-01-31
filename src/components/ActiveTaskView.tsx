import type Task from "../types/Task";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface ActiveTaskViewProps {
  task: Task | undefined;
  onNotesChange: (task: Task, notes: string) => void;
  onDone?: () => void;
  onDeactivate?: () => void;
}

function ActiveTaskView({
  task,
  onNotesChange,
  onDone,
  onDeactivate,
}: ActiveTaskViewProps) {
  if (!task) {
    return <h2 className="text-muted-foreground">No active task</h2>;
  }

  return (
    <div>
      <h2>{task.text}</h2>
      <Textarea
        value={task.notes}
        onChange={(e) => onNotesChange(task, e.target.value)}
        placeholder="Notes..."
        className="min-h-[80px] resize-y"
      />
      {(onDone || onDeactivate) && (
        <div className="mt-2 flex gap-2">
          {onDone && <Button onClick={onDone}>Done</Button>}
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
