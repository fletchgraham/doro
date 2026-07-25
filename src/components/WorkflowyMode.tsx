import { useEffect, useRef, useState } from "react";
import type Task from "../types/Task";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  completeNode,
  createNode,
  fetchWorkflowyTasks,
  formatNoteWithDuration,
  getWorkflowyApiKey,
  getWorkflowyEnabled,
  getWorkflowyNodeUrl,
  getWorkflowyParentId,
  getWorkflowyParentInput,
  parseParentInput,
  resolveParentId,
  setWorkflowyApiKey,
  setWorkflowyEnabled,
  setWorkflowyParentId,
  setWorkflowyParentInput,
  uncompleteNode,
  updateNode,
  type WorkflowyTaskData,
} from "../lib/workflowy";

const PUSH_DEBOUNCE_MS = 1500;

interface WorkflowyTaskManager {
  tasks: Task[];
  mergeWorkflowyTasks: (nodes: WorkflowyTaskData[]) => void;
  setWorkflowyId: (taskId: string, workflowyId: string, url: string) => void;
}

function WorkflowyMode({ taskManager }: { taskManager: WorkflowyTaskManager }) {
  const [enabled, setEnabled] = useState(getWorkflowyEnabled);
  const [apiKey, setApiKey] = useState(getWorkflowyApiKey);
  const [parentInput, setParentInput] = useState(getWorkflowyParentInput);
  const [parentId, setParentId] = useState(getWorkflowyParentId);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const configured = enabled && !!apiKey && !!parentId;

  // Latest state for async callbacks and debounced pushes
  const tasksRef = useRef(taskManager.tasks);
  tasksRef.current = taskManager.tasks;
  const managerRef = useRef(taskManager);
  managerRef.current = taskManager;

  const prevTasksRef = useRef<Task[] | null>(null);
  // Set while applying a remote merge so the diff effect doesn't push the
  // remote's own changes straight back to workflowy
  const suppressDiffRef = useRef(false);
  const pendingCreatesRef = useRef(new Set<string>());
  const pushTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>()
  );

  const reportError = (err: unknown) => {
    setError(err instanceof Error ? err.message : "Workflowy sync failed");
  };

  /**
   * Make sure we know the parent node's UUID, resolving links/short ids
   * by walking the tree once and caching the result.
   */
  const ensureParentId = async (key: string): Promise<string> => {
    if (parentId) return parentId;
    const target = parseParentInput(parentInput);
    if (!target) {
      throw new Error("Paste a Workflowy node link or UUID first");
    }
    const resolved = await resolveParentId(key, target);
    setParentId(resolved);
    setWorkflowyParentId(resolved);
    return resolved;
  };

  const syncNow = async (key = apiKey) => {
    if (!key) {
      setError("Enter your Workflowy API key first");
      return;
    }
    setSyncing(true);
    setError(null);
    setStatus(null);
    try {
      const pid = await ensureParentId(key);
      const nodes = await fetchWorkflowyTasks(key, pid);
      suppressDiffRef.current = true;
      managerRef.current.mergeWorkflowyTasks(nodes);
      setStatus(
        `Synced ${nodes.length} task${nodes.length === 1 ? "" : "s"} at ${new Date().toLocaleTimeString()}`
      );
    } catch (err) {
      reportError(err);
    } finally {
      setSyncing(false);
    }
  };

  // Pull from workflowy once on load when the mode is already configured
  const didInitialSyncRef = useRef(false);
  useEffect(() => {
    if (didInitialSyncRef.current) return;
    didInitialSyncRef.current = true;
    if (getWorkflowyEnabled() && getWorkflowyApiKey() && getWorkflowyParentId()) {
      syncNow(getWorkflowyApiKey());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const schedulePush = (taskId: string, push: () => Promise<void>) => {
    const timers = pushTimersRef.current;
    const existing = timers.get(taskId);
    if (existing) clearTimeout(existing);
    timers.set(
      taskId,
      setTimeout(() => {
        timers.delete(taskId);
        push().catch(reportError);
      }, PUSH_DEBOUNCE_MS)
    );
  };

  const pushNote = (taskId: string, key: string) => {
    schedulePush(taskId, async () => {
      const task = tasksRef.current.find((t) => t.id === taskId);
      if (!task?.workflowyId) return;
      await updateNode(key, task.workflowyId, {
        note: formatNoteWithDuration(task.notes, task.duration),
      });
    });
  };

  const pushName = (taskId: string, key: string) => {
    schedulePush(`name:${taskId}`, async () => {
      const task = tasksRef.current.find((t) => t.id === taskId);
      if (!task?.workflowyId || !task.text.trim()) return;
      await updateNode(key, task.workflowyId, { name: task.text });
    });
  };

  const createInWorkflowy = (task: Task, key: string, pid: string) => {
    if (pendingCreatesRef.current.has(task.id)) return;
    pendingCreatesRef.current.add(task.id);
    createNode(
      key,
      pid,
      task.text,
      formatNoteWithDuration(task.notes, task.duration) || undefined
    )
      .then((id) => {
        managerRef.current.setWorkflowyId(task.id, id, getWorkflowyNodeUrl(id));
      })
      .catch(reportError)
      .finally(() => pendingCreatesRef.current.delete(task.id));
  };

  // Push local changes to workflowy by diffing task state across renders
  useEffect(() => {
    const prev = prevTasksRef.current;
    prevTasksRef.current = taskManager.tasks;

    if (!configured || prev === null) return;
    if (suppressDiffRef.current) {
      suppressDiffRef.current = false;
      return;
    }
    if (prev === taskManager.tasks) return;

    const prevById = new Map(prev.map((t) => [t.id, t]));
    for (const task of taskManager.tasks) {
      const before = prevById.get(task.id);

      // Newly added in doro: append it under the workflowy parent node
      if (!before) {
        if (!task.workflowyId) createInWorkflowy(task, apiKey, parentId);
        continue;
      }

      if (!task.workflowyId) continue;

      // A doro-created task just got linked; if it was already finished
      // (or timed) before the create round-tripped, catch workflowy up
      if (!before.workflowyId) {
        if (task.status === "done") {
          completeNode(apiKey, task.workflowyId).catch(reportError);
        }
        if (task.duration !== 0 || task.notes.trim()) {
          pushNote(task.id, apiKey);
        }
        continue;
      }

      if (before.status !== "done" && task.status === "done") {
        completeNode(apiKey, task.workflowyId).catch(reportError);
      } else if (before.status === "done" && task.status !== "done") {
        uncompleteNode(apiKey, task.workflowyId).catch(reportError);
      }

      if (before.text !== task.text) {
        pushName(task.id, apiKey);
      }

      if (before.duration !== task.duration || before.notes !== task.notes) {
        pushNote(task.id, apiKey);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskManager.tasks, configured, apiKey, parentId]);

  const handleToggle = (on: boolean) => {
    setEnabled(on);
    setWorkflowyEnabled(on);
    setError(null);
    setStatus(null);
    if (on && apiKey && (parentId || parentInput.trim())) {
      syncNow();
    }
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    setWorkflowyApiKey(value.trim());
  };

  const handleParentInputChange = (value: string) => {
    setParentInput(value);
    setWorkflowyParentInput(value);
    // The target changed; forget the previously resolved node
    setParentId("");
    setWorkflowyParentId("");
  };

  return (
    <div className="mt-10 pt-4 border-t" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer">
          <Switch checked={enabled} onCheckedChange={handleToggle} />
          <span className="text-sm">Workflowy mode</span>
        </label>
        {enabled && (
          <>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder="Workflowy API key..."
              className="w-44 h-8 text-sm"
            />
            <Input
              value={parentInput}
              onChange={(e) => handleParentInputChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && syncNow()}
              placeholder="Parent node link or UUID..."
              className="flex-1 min-w-48 h-8 text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncNow()}
              disabled={syncing || !apiKey || !parentInput.trim()}
            >
              {syncing ? "Syncing..." : "Sync"}
            </Button>
          </>
        )}
      </div>
      {enabled && (error || status) && (
        <p
          className={
            error
              ? "text-xs text-red-600 dark:text-red-400 mt-2"
              : "text-xs text-muted-foreground mt-2"
          }
        >
          {error ?? status}
        </p>
      )}
      {enabled && !error && !status && (
        <p className="text-xs text-muted-foreground mt-2">
          Tasks sync from the children of your chosen Workflowy node. Get an
          API key at{" "}
          <a
            href="https://workflowy.com/api-key"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            workflowy.com/api-key
          </a>
          .
        </p>
      )}
    </div>
  );
}

export default WorkflowyMode;
