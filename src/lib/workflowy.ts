export interface WorkflowyNode {
  id: string;
  name: string;
  note?: string | null;
  priority?: number;
  completedAt?: number | null;
  // Extra node metadata (layoutMode; mirror details on newer API versions)
  data?: Record<string, unknown> | null;
}

// A workflowy child node mapped into doro terms, ready to merge into tasks
export interface WorkflowyTaskData {
  workflowyId: string;
  text: string;
  notes: string;
  url: string;
  completed: boolean;
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

// --- legacy time-tracking note marker ---

// Older doro versions persisted tracked time in the workflowy note as a
// marker line ("⏱ 1h 23m — doro") above the user's own note content. Time
// now lives only in doro's local storage, so the marker is no longer
// written; it's still stripped on read so old notes don't show it in doro.
const LEGACY_NOTE_MARKER_RE = /^⏱ [^\n]* — doro$/;

export function stripLegacyNoteMarker(note: string | null | undefined): string {
  if (!note) return "";
  const lines = note.split("\n");
  if (!LEGACY_NOTE_MARKER_RE.test(lines[0])) return note;
  return lines.slice(1).join("\n");
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

/**
 * Create a child under the parent node. Tasks are created as workflowy
 * todo items (checkbox layout) so completion shows up natively.
 */
export async function createNode(
  token: string,
  parentId: string,
  name: string,
  note?: string
): Promise<string> {
  const data = await callApi({
    token,
    op: "create",
    parentId,
    name,
    note,
    layoutMode: "todo",
  });
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

export async function getNode(
  token: string,
  nodeId: string
): Promise<WorkflowyNode | null> {
  const data = await callApi({ token, op: "get", nodeId });
  const node = data?.node ?? data;
  return node && typeof node.id === "string" ? (node as WorkflowyNode) : null;
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

const hasBlankName = (node: WorkflowyNode): boolean =>
  !stripTags(node.name ?? "").trim();

// --- mirrors ---

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;

// Field names an API response might use for "the node this mirror shows"
const ORIGINAL_ID_KEYS = [
  "originalId",
  "original_id",
  "originalNodeId",
  "original_node_id",
  "mirrorOf",
  "mirror_of",
];

const pickId = (
  record: Record<string, unknown> | null,
  keys: string[]
): string | null => {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
  }
  return null;
};

/**
 * The id of the node a mirror points at, or null for a regular node (an
 * original that has mirrors elsewhere counts as regular). Workflowy lists
 * a mirror as its own node with an empty name, and the field carrying the
 * original's id depends on the API version, so accept the shapes seen in
 * the wild: `data.mirror.originalId` (the export/backup shape), a
 * top-level `mirror` object, or a flat id field.
 */
export function getMirrorOriginalId(node: WorkflowyNode): string | null {
  const record = asRecord(node);
  const data = asRecord(node.data);
  const originalId =
    pickId(asRecord(data?.mirror), ORIGINAL_ID_KEYS) ??
    pickId(asRecord(record?.mirror), ORIGINAL_ID_KEYS) ??
    pickId(data, ORIGINAL_ID_KEYS) ??
    pickId(record, ORIGINAL_ID_KEYS);
  return originalId && originalId !== node.id ? originalId : null;
}

// A mirror's original could itself be reported as a mirror; don't chase forever
const MIRROR_HOPS = 3;

/**
 * Follow a listed child to the node it mirrors, so the task gets the
 * original's text, note and completion state. A blank-named node with no
 * original id in the listing is fetched on its own first, since the
 * single-node endpoint may carry details the children listing leaves out.
 * Anything that can't be resolved comes back unchanged, so one bad mirror
 * (say, an original this API key can't read) doesn't sink the whole sync.
 */
export async function resolveMirror(
  token: string,
  node: WorkflowyNode
): Promise<WorkflowyNode> {
  let current = node;
  for (let hop = 0; hop < MIRROR_HOPS; hop++) {
    let targetId = getMirrorOriginalId(current);
    if (!targetId) {
      if (current !== node || !hasBlankName(current)) return current;
      targetId = current.id;
    }
    let fetched: WorkflowyNode | null = null;
    try {
      fetched = await getNode(token, targetId);
    } catch {
      // keep what we have
    }
    if (!fetched) return current;
    if (
      targetId === current.id &&
      hasBlankName(fetched) &&
      !getMirrorOriginalId(fetched)
    ) {
      return current; // a genuinely empty node, not a mirror
    }
    current = fetched;
  }
  return current;
}

export function nodeToTaskData(node: WorkflowyNode): WorkflowyTaskData {
  return {
    workflowyId: node.id,
    text: stripTags(node.name ?? "").trim(),
    notes: stripLegacyNoteMarker(node.note),
    url: getWorkflowyNodeUrl(node.id),
    completed: node.completedAt != null,
  };
}

/**
 * List the parent's children as doro task data, in sibling order. A child
 * that is a mirror is represented by the node it mirrors: its text, note
 * and completion come from the original, and the original's id becomes
 * the task's workflowyId, so edits and completion pushed from doro land on
 * the real node (Workflowy shows them in every mirror). The task's link
 * still opens the mirror under the synced parent. Two children mirroring
 * the same node collapse into one task.
 */
export async function fetchWorkflowyTasks(
  token: string,
  parentId: string
): Promise<WorkflowyTaskData[]> {
  const nodes = (await listChildren(token, parentId))
    .slice()
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  const resolved = await Promise.all(
    nodes.map((node) => resolveMirror(token, node))
  );

  const seen = new Set<string>();
  const tasks: WorkflowyTaskData[] = [];
  nodes.forEach((listed, i) => {
    const original = resolved[i];
    if (seen.has(original.id)) return;
    seen.add(original.id);
    tasks.push({
      ...nodeToTaskData(original),
      url: getWorkflowyNodeUrl(listed.id),
    });
  });
  return tasks;
}
