import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchTodaysTasks, type ImportableTask } from "../lib/todoist";
import { useSettingsContext } from "../hooks/useSettings";

interface TodoistImportProps {
  onImport: (tasks: ImportableTask[]) => void;
  onOpenSettings: () => void;
}

// The import button for Todoist mode; the token and label filter are set
// in the settings modal.
function TodoistImport({ onImport, onOpenSettings }: TodoistImportProps) {
  const { todoist, setTodoist } = useSettingsContext();
  const { token, label } = todoist;
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleImport = async () => {
    if (!token) return;
    setLoading(true);
    setStatus(null);
    try {
      const tasks = await fetchTodaysTasks(token, label);
      if (tasks.length === 0) {
        setStatus(
          label.trim()
            ? `No tasks due today with label "${label.trim()}"`
            : "No tasks due today"
        );
      } else {
        onImport(tasks);
        setStatus(`Imported ${tasks.length} task${tasks.length === 1 ? "" : "s"}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      setStatus(message);
      if (message.includes("Invalid Todoist API token")) {
        setTodoist({ token: "" });
      }
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <p className="text-xs text-muted-foreground">
        Todoist mode is on. Add your API token in{" "}
        <button
          type="button"
          className="underline hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onOpenSettings();
          }}
        >
          Settings
        </button>{" "}
        to import today's tasks.
        {status && <span className="ml-2">{status}</span>}
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={handleImport} disabled={loading}>
        {loading ? "Importing..." : "Import from Todoist"}
      </Button>
      {label.trim() && (
        <span className="text-xs text-muted-foreground">
          label: {label.trim()}
        </span>
      )}
      {status && (
        <span className="text-xs text-muted-foreground">{status}</span>
      )}
    </div>
  );
}

export default TodoistImport;
