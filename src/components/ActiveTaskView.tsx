import type Task from "../types/Task";

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
    return <h2 style={{ color: "#888" }}>No active task</h2>;
  }

  return (
    <div>
      <h2>{task.text}</h2>
      <textarea
        value={task.notes}
        onChange={(e) => onNotesChange(task, e.target.value)}
        placeholder="Notes..."
        style={{ width: "100%", minHeight: "80px", resize: "vertical" }}
      />
      {(onDone || onDeactivate) && (
        <div style={{ marginTop: "8px" }}>
          {onDone && <button onClick={onDone}>Done</button>}
          {onDeactivate && <button onClick={onDeactivate}>Deactivate</button>}
        </div>
      )}
    </div>
  );
}

export default ActiveTaskView;
