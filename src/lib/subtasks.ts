import type Subtask from "../types/Subtask";

// Pure list operations shared by the day tasks and project tasks
// reducers. Order is the array order, so reordering is a splice rather
// than an order field.

export const createSubtask = (text: string): Subtask => ({
  id: crypto.randomUUID(),
  text,
  done: false,
});

export const addSubtask = (list: Subtask[], text: string): Subtask[] => [
  ...list,
  createSubtask(text),
];

export const setSubtaskText = (
  list: Subtask[],
  subtaskId: string,
  text: string
): Subtask[] => list.map((s) => (s.id === subtaskId ? { ...s, text } : s));

export const setSubtaskDone = (
  list: Subtask[],
  subtaskId: string,
  done: boolean
): Subtask[] => list.map((s) => (s.id === subtaskId ? { ...s, done } : s));

/** Move a subtask so it sits at `index` in the resulting list. */
export const moveSubtask = (
  list: Subtask[],
  subtaskId: string,
  index: number
): Subtask[] => {
  const from = list.findIndex((s) => s.id === subtaskId);
  if (from === -1) return list;
  const to = Math.max(0, Math.min(index, list.length - 1));
  if (from === to) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

/** Put a subtask at `index` in another list, clamped to its ends. */
export const insertSubtask = (
  list: Subtask[],
  subtask: Subtask,
  index: number
): Subtask[] => {
  const to = Math.max(0, Math.min(index, list.length));
  return [...list.slice(0, to), subtask, ...list.slice(to)];
};

export const removeSubtask = (list: Subtask[], subtaskId: string): Subtask[] =>
  list.filter((s) => s.id !== subtaskId);

/** Structural equality, for telling a real change from a fresh copy. */
export const sameSubtasks = (a: Subtask[], b: Subtask[]): boolean =>
  a.length === b.length &&
  a.every((s, i) => {
    const o = b[i];
    return s.id === o.id && s.text === o.text && s.done === o.done;
  });

export const subtaskProgress = (
  list: Subtask[]
): { done: number; total: number } => ({
  done: list.filter((s) => s.done).length,
  total: list.length,
});

/** Read a persisted subtask list, dropping anything malformed. */
export const normalizeSubtasks = (raw: unknown): Subtask[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const list: Subtask[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const { id, text, done } = item as Record<string, unknown>;
    if (typeof id !== "string" || typeof text !== "string" || seen.has(id)) {
      continue;
    }
    seen.add(id);
    list.push({ id, text, done: done === true });
  }
  return list;
};
