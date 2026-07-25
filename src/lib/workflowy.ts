import { formatDuration } from "./formatDuration";

export interface WorkflowyNode {
  id: string;
  name: string;
  note?: string | null;
  priority?: number;
  completedAt?: number | null;
}

// A workflowy child node mapped into doro terms, ready to merge into tasks
export interface WorkflowyTaskData {
  workflowyId: string;
  text: string;
  notes: string;
  url: string;
  completed: boolean;
  durationMs: number;
}

const API_PROXY = "/api/workflowy";

// --- settings (localStorage) ---

export function getWorkflowyEnabled(): boolean {
  return localStorage.getItem("doroWorkflowyEnabled") === "true";
}

export function setWorkflowyEnabled(enabled: boolean): void {
  localStorage.setItem("doroWorkflowyEnabled", String(enabled));
}

export function getWorkflowyApiKey(): string {
  return localStorage.getItem("doroWorkflowyApiKey") ?? "";
}

export function setWorkflowyApiKey(key: string): void {
  if (key) localStorage.setItem("doroWorkflowyApiKey", key);
  else localStorage.removeItem("doroWorkflowyApiKey");
}

export function getWorkflowyParentInput(): string {
  return localStorage.getItem("doroWorkflowyParentInput") ?? "";
}

export function setWorkflowyParentInput(value: string): void {
  localStorage.setItem("doroWorkflowyParentInput", value);
}

export function getWorkflowyParentId(): string {
  return localStorage.getItem("doroWorkflowyParentId") ?? "";
}

export function setWorkflowyParentId(id: string): void {
  if (id) localStorage.setItem("doroWorkflowyParentId", id);
  else localStorage.removeItem("doroWorkflowyParentId");
}

// --- parent node input parsing ---

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORT_ID_RE = /^[0-9a-f]{12}$/i;

export type ParentTarget =
  | { kind: "uuid"; id: string }
  | { kind: "short"; shortId: string };

/**
 * Parse the user's "parent node" input. Accepts a full node UUID, a
 * workflowy.com internal link (whose #/fragment is the last 12 hex chars
 * of the node UUID), or a bare 12-char short id.
 */
export function parseParentInput(input: string): ParentTarget | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (UUID_RE.test(trimmed)) {
    return { kind: "uuid", id: trimmed.toLowerCase() };
  }

  // workflowy.com/#/abc123def456 links (also matches beta.workflowy.com)
  const urlMatch = trimmed.match(/workflowy\.com\/#\/([0-9a-f]{12})\b/i);
  if (urlMatch) {
    return { kind: "short", shortId: urlMatch[1].toLowerCase() };
  }

  if (SHORT_ID_RE.test(trimmed)) {
    return { kind: "short", shortId: trimmed.toLowerCase() };
  }

  return null;
}

/**
 * Build the workflowy web link for a node from its API UUID. Workflowy's
 * internal links use the last 12 hex chars of the node id.
 */
export function getWorkflowyNodeUrl(id: string): string {
  const hex = id.replace(/-/g, "").toLowerCase();
  return `https://workflowy.com/#/${hex.slice(-12)}`;
}

export function matchesShortId(id: string, shortId: string): boolean {
  return id.replace(/-/g, "").toLowerCase().endsWith(shortId.toLowerCase());
}

// --- time-tracking note marker ---

// The accumulated doro time is persisted in the workflowy note as a
// marker line, e.g. "⏱ 1h 23m — doro", above any user note content.
const NOTE_MARKER_RE =
  /^⏱ (?:(\d+)h)?\s*(?:(\d+)m)?(?:< 1m|0m)? — doro$/;

export function formatNoteWithDuration(
  notes: string,
  durationMs: number
): string {
  const parts: string[] = [];
  // Sub-minute durations aren't worth a marker (and would render as "0m")
  if (durationMs >= 60 * 1000) {
    parts.push(`⏱ ${formatDuration(durationMs)} — doro`);
  }
  if (notes.trim()) {
    parts.push(notes);
  }
  return parts.join("\n");
}

/**
 * Split a workflowy note into the doro time marker (if present) and the
 * remaining note content. Inverse of formatNoteWithDuration, up to
 * minute rounding.
 */
export function parseNoteDuration(note: string | null | undefined): {
  durationMs: number;
  notes: string;
} {
  if (!note) return { durationMs: 0, notes: "" };
  const lines = note.split("\n");
  const match = lines[0].match(NOTE_MARKER_RE);
  if (!match) return { durationMs: 0, notes: note };
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  return {
    durationMs: (hours * 60 + minutes) * 60 * 1000,
    notes: lines.slice(1).join("\n"),
  };
}

// --- API calls (through the vercel proxy to avoid CORS) ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callApi(body: Record<string, unknown>): Promise<any> {
  const response = await fetch(API_PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let message = `Workflowy API error: ${response.status}`;
    try {
      const data = await response.json();
      if (data?.error) message = data.error;
    } catch {
      // keep the generic message
    }
    if (response.status === 401) message = "Invalid Workflowy API key";
    throw new Error(message);
  }
  return response.json();
}

export async function listChildren(
  token: string,
  parentId?: string
): Promise<WorkflowyNode[]> {
  const data = await callApi({ token, op: "list", parentId });
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.nodes)) return data.nodes;
  return [];
}

export async function createNode(
  token: string,
  parentId: string,
  name: string,
  note?: string
): Promise<string> {
  const data = await callApi({ token, op: "create", parentId, name, note });
  const id = data?.item_id ?? data?.id;
  if (!id) throw new Error("Workflowy create returned no id");
  return id;
}

export async function updateNode(
  token: string,
  nodeId: string,
  fields: { name?: string; note?: string }
): Promise<void> {
  await callApi({ token, op: "update", nodeId, ...fields });
}

export async function completeNode(
  token: string,
  nodeId: string
): Promise<void> {
  await callApi({ token, op: "complete", nodeId });
}

export async function uncompleteNode(
  token: string,
  nodeId: string
): Promise<void> {
  await callApi({ token, op: "uncomplete", nodeId });
}

// Cap on list requests when resolving a short id by walking the tree
const RESOLVE_REQUEST_LIMIT = 200;

/**
 * Resolve the user's parent input to a full node UUID. Full UUIDs pass
 * through; short ids (from workflowy links) are resolved by breadth-first
 * search from the root, since the API only supports listing children.
 */
export async function resolveParentId(
  token: string,
  target: ParentTarget
): Promise<string> {
  if (target.kind === "uuid") return target.id;

  const queue: (string | undefined)[] = [undefined]; // undefined = root
  let requests = 0;
  while (queue.length > 0 && requests < RESOLVE_REQUEST_LIMIT) {
    const parentId = queue.shift();
    requests++;
    const children = await listChildren(token, parentId);
    for (const child of children) {
      if (matchesShortId(child.id, target.shortId)) {
        return child.id;
      }
      queue.push(child.id);
    }
  }
  throw new Error(
    "Couldn't find that node in your Workflowy — try pasting the node's full UUID"
  );
}

// Workflowy names can carry inline formatting tags; strip them for doro
const stripTags = (value: string): string => value.replace(/<[^>]*>/g, "");

export function nodeToTaskData(node: WorkflowyNode): WorkflowyTaskData {
  const { durationMs, notes } = parseNoteDuration(node.note);
  return {
    workflowyId: node.id,
    text: stripTags(node.name ?? "").trim(),
    notes,
    url: getWorkflowyNodeUrl(node.id),
    completed: node.completedAt != null,
    durationMs,
  };
}

export async function fetchWorkflowyTasks(
  token: string,
  parentId: string
): Promise<WorkflowyTaskData[]> {
  const nodes = await listChildren(token, parentId);
  return nodes
    .slice()
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
    .map(nodeToTaskData);
}
