import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchTodaysTasks,
  getTodoistToken,
  setTodoistToken,
  clearTodoistToken,
  getTodoistLabel,
  setTodoistLabel,
  type ImportableTask,
} from "../lib/todoist";

interface TodoistImportProps {
  onImport: (tasks: ImportableTask[]) => void;
}

function TodoistImport({ onImport }: TodoistImportProps) {
  const [token, setToken] = useState(getTodoistToken);
  const [tokenInput, setTokenInput] = useState("");
  const [label, setLabel] = useState(getTodoistLabel);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleLabelChange = (value: string) => {
    setLabel(value);
    setTodoistLabel(value);
  };

  const handleSaveToken = () => {
    const trimmed = tokenInput.trim();
    if (!trimmed) return;
    setTodoistToken(trimmed);
    setToken(trimmed);
    setTokenInput("");
    setStatus(null);
  };

  const handleDisconnect = () => {
    clearTodoistToken();
    setToken(null);
    setStatus(null);
  };

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
        clearTodoistToken();
        setToken(null);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSaveToken()}
          onClick={(e) => e.stopPropagation()}
          placeholder="Todoist API token..."
          className="w-48 h-8 text-sm"
          type="password"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleSaveToken}
          disabled={!tokenInput.trim()}
        >
          Connect
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={handleImport} disabled={loading}>
        {loading ? "Importing..." : "Import from Todoist"}
      </Button>
      <Input
        value={label}
        onChange={(e) => handleLabelChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        placeholder="label filter (optional)"
        className="w-44 h-8 text-sm"
      />
      <button
        onClick={handleDisconnect}
        className="text-xs text-muted-foreground hover:text-foreground underline"
      >
        Disconnect
      </button>
      {status && (
        <span className="text-xs text-muted-foreground">{status}</span>
      )}
    </div>
  );
}

export default TodoistImport;
