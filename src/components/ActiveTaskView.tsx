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
    return <h2 className="text-2xl font-semibold text-muted-foreground mt-6">No active task</h2>;
  }

  return (
    <div className="mt-6">
      <h2 className="text-2xl font-semibold mb-3">{task.text}</h2>
      <Textarea
        value={task.notes}
        onChange={(e) => onNotesChange(task, e.target.value)}
        placeholder="Notes..."
        className="min-h-[80px] resize-y"
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
