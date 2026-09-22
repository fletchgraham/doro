import { useEffect, useRef, useState } from "react";
import type Task from "../types/Task";
import type { WorkflowySettings } from "../lib/settings";
import {
  completeNode,
  createNode,
  fetchWorkflowyTasks,
  getWorkflowyNodeUrl,
  parseParentInput,
  resolveParentId,
  uncompleteNode,
  updateNode,
  type WorkflowyTaskData,
} from "../lib/workflowy";

const PUSH_DEBOUNCE_MS = 1500;

export interface WorkflowyTaskManager {
  tasks: Task[];
  mergeWorkflowyTasks: (nodes: WorkflowyTaskData[]) => void;
  setWorkflowyId: (taskId: string, workflowyId: string, url: string) => void;
}

/**
 * Two-way sync between the day's tasks and the children of a Workflowy
 * node: pulls on demand (and once on load), pushes local edits as they
 * happen. Settings come from the settings modal; this only writes back
 * the resolved parent id.
 */
export default function useWorkflowySync(
  taskManager: WorkflowyTaskManager,
  settings: WorkflowySettings,
  onChange: (patch: Partial<WorkflowySettings>) => void
) {
  const { enabled, apiKey, parentInput, parentId } = settings;
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const configured = enabled && !!apiKey && !!parentId;

  // Latest state for async callbacks and debounced pushes
  const tasksRef = useRef(taskManager.tasks);
  tasksRef.current = taskManager.tasks;
  const managerRef = useRef(taskManager);
  managerRef.current = taskManager;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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
    const current = settingsRef.current;
    if (current.parentId) return current.parentId;
    const target = parseParentInput(current.parentInput);
    if (!target) {
      throw new Error("Paste a Workflowy node link or UUID first");
    }
    const resolved = await resolveParentId(key, target);
    onChangeRef.current({ parentId: resolved });
    return resolved;
  };

  const syncNow = async () => {
    const key = settingsRef.current.apiKey;
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

  // Pull from workflowy once on load when the mode is already configured,
  // and again whenever the mode is switched on with a key and node in place
  const prevEnabledRef = useRef<boolean | null>(null);
  useEffect(() => {
    const wasEnabled = prevEnabledRef.current;
    prevEnabledRef.current = enabled;
    const current = settingsRef.current;
    if (wasEnabled === null) {
      if (enabled && current.apiKey && current.parentId) syncNow();
      return;
    }
    if (enabled && !wasEnabled) {
      setError(null);
      setStatus(null);
      if (current.apiKey && (current.parentId || current.parentInput.trim())) {
        syncNow();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

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
      await updateNode(key, task.workflowyId, { note: task.notes });
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
    createNode(key, pid, task.text, task.notes.trim() || undefined)
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
      // (or annotated) before the create round-tripped, catch workflowy up
      if (!before.workflowyId) {
        if (task.status === "done") {
          completeNode(apiKey, task.workflowyId).catch(reportError);
        }
        if (task.notes.trim()) {
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

      if (before.notes !== task.notes) {
        pushNote(task.id, apiKey);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskManager.tasks, configured, apiKey, parentId]);

  // Sync is possible once there's a key and something to resolve
  const canSync = !!apiKey && !!(parentId || parentInput.trim());

  return { syncNow, syncing, status, error, configured, canSync };
}

export type WorkflowySync = ReturnType<typeof useWorkflowySync>;
