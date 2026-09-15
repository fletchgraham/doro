import { afterEach, expect, test, vi } from "vitest";
import {
  fetchWorkflowyTasks,
  getMirrorOriginalId,
  getWorkflowyNodeUrl,
  matchesShortId,
  nodeToTaskData,
  parseParentInput,
  resolveMirror,
  stripLegacyNoteMarker,
  type WorkflowyNode,
} from "./workflowy";

test("parseParentInput accepts a full node UUID", () => {
  expect(
    parseParentInput("1A2B3C4D-5E6F-7081-92A3-B4C5D6E7F809")
  ).toEqual({ kind: "uuid", id: "1a2b3c4d-5e6f-7081-92a3-b4c5d6e7f809" });
});

test("parseParentInput accepts a workflowy internal link", () => {
  expect(
    parseParentInput("https://workflowy.com/#/abc123def456")
  ).toEqual({ kind: "short", shortId: "abc123def456" });
  expect(
    parseParentInput("https://beta.workflowy.com/#/ABC123DEF456?q=x")
  ).toEqual({ kind: "short", shortId: "abc123def456" });
});

test("parseParentInput accepts a bare short id", () => {
  expect(parseParentInput("abc123def456")).toEqual({
    kind: "short",
    shortId: "abc123def456",
  });
});

test("parseParentInput rejects garbage", () => {
  expect(parseParentInput("")).toBeNull();
  expect(parseParentInput("not a node")).toBeNull();
  expect(parseParentInput("https://workflowy.com/")).toBeNull();
});

test("getWorkflowyNodeUrl uses the last 12 hex chars of the UUID", () => {
  expect(getWorkflowyNodeUrl("1a2b3c4d-5e6f-7081-92a3-b4c5d6e7f809")).toBe(
    "https://workflowy.com/#/b4c5d6e7f809"
  );
});

test("matchesShortId compares against the dashless UUID suffix", () => {
  const id = "1a2b3c4d-5e6f-7081-92a3-b4c5d6e7f809";
  expect(matchesShortId(id, "b4c5d6e7f809")).toBe(true);
  expect(matchesShortId(id, "B4C5D6E7F809")).toBe(true);
  expect(matchesShortId(id, "000000000000")).toBe(false);
});

test("stripLegacyNoteMarker drops the old doro time marker line", () => {
  expect(stripLegacyNoteMarker("⏱ 1h 23m — doro\nmy notes\nsecond line")).toBe(
    "my notes\nsecond line"
  );
  expect(stripLegacyNoteMarker("⏱ 25m — doro")).toBe("");
  expect(stripLegacyNoteMarker("⏱ 2h — doro\n")).toBe("");
});

test("stripLegacyNoteMarker passes notes without a marker through unchanged", () => {
  expect(stripLegacyNoteMarker("plain workflowy note")).toBe(
    "plain workflowy note"
  );
  expect(stripLegacyNoteMarker("notes first\n⏱ 5m — doro")).toBe(
    "notes first\n⏱ 5m — doro"
  );
  expect(stripLegacyNoteMarker(null)).toBe("");
  expect(stripLegacyNoteMarker(undefined)).toBe("");
});

test("nodeToTaskData maps workflowy fields and strips inline tags", () => {
  const data = nodeToTaskData({
    id: "1a2b3c4d-5e6f-7081-92a3-b4c5d6e7f809",
    name: "Write <b>report</b>",
    note: "⏱ 45m — doro\ndetails here",
    completedAt: 1700000000,
  });
  expect(data).toEqual({
    workflowyId: "1a2b3c4d-5e6f-7081-92a3-b4c5d6e7f809",
    text: "Write report",
    notes: "details here",
    url: "https://workflowy.com/#/b4c5d6e7f809",
    completed: true,
  });
});

test("nodeToTaskData keeps plain notes and marks open nodes incomplete", () => {
  const data = nodeToTaskData({
    id: "1a2b3c4d-5e6f-7081-92a3-b4c5d6e7f809",
    name: "Call the bank",
    note: "ask about the fee",
    completedAt: null,
  });
  expect(data.notes).toBe("ask about the fee");
  expect(data.completed).toBe(false);
});

test("getMirrorOriginalId reads the original id from the shapes the API uses", () => {
  const base = { id: "mirror-id", name: "" };
  expect(
    getMirrorOriginalId({ ...base, data: { mirror: { originalId: "orig" } } })
  ).toBe("orig");
  expect(
    getMirrorOriginalId({ ...base, mirror: { originalId: "orig" } } as WorkflowyNode)
  ).toBe("orig");
  expect(getMirrorOriginalId({ ...base, data: { original_id: "orig" } })).toBe(
    "orig"
  );
  expect(getMirrorOriginalId({ ...base, mirrorOf: "orig" } as WorkflowyNode)).toBe(
    "orig"
  );
});

test("getMirrorOriginalId is null for regular nodes and mirror originals", () => {
  expect(getMirrorOriginalId({ id: "a", name: "plain" })).toBeNull();
  expect(getMirrorOriginalId({ id: "a", name: "", data: null })).toBeNull();
  expect(
    getMirrorOriginalId({ id: "a", name: "", data: { layoutMode: "todo" } })
  ).toBeNull();
  // An original that has mirrors elsewhere lists them, but isn't a mirror
  expect(
    getMirrorOriginalId({
      id: "a",
      name: "the original",
      data: { mirror: { mirrorRootIds: { "m-1": true } } },
    })
  ).toBeNull();
  // A self-reference is not a mirror either
  expect(
    getMirrorOriginalId({ id: "a", name: "", data: { mirror: { originalId: "a" } } })
  ).toBeNull();
});

// --- API-backed helpers, with the vercel proxy stubbed out ---

type Op = { op: string; nodeId?: string; parentId?: string };

/** Stub fetch so each proxy call is answered from `respond` (a thrown
 * value becomes an HTTP 404). Returns the list of ops that were made. */
function stubProxy(respond: (body: Op) => unknown): Op[] {
  const calls: Op[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as Op;
      calls.push(body);
      try {
        const data = respond(body);
        return { ok: true, status: 200, json: async () => data };
      } catch {
        return {
          ok: false,
          status: 404,
          json: async () => ({ error: "Node not found" }),
        };
      }
    })
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const ORIGINAL: WorkflowyNode = {
  id: "0b3a4e4c-0000-4000-8000-0000000aaaaa",
  name: "Mirrored <b>task</b>",
  note: "from the original",
  completedAt: null,
};

const MIRROR: WorkflowyNode = {
  id: "0b3a4e4c-0000-4000-8000-0000000bbbbb",
  name: "",
  data: { mirror: { originalId: ORIGINAL.id } },
};

test("resolveMirror follows a mirror to its original", async () => {
  const calls = stubProxy(({ op, nodeId }) => {
    if (op === "get" && nodeId === ORIGINAL.id) return { node: ORIGINAL };
    throw new Error("unexpected");
  });
  expect(await resolveMirror("tok", MIRROR)).toEqual(ORIGINAL);
  expect(calls).toEqual([{ token: "tok", op: "get", nodeId: ORIGINAL.id }]);
});

test("resolveMirror looks a blank node up directly when the listing has no original id", async () => {
  const blank: WorkflowyNode = { id: MIRROR.id, name: "" };
  const calls = stubProxy(({ op, nodeId }) => {
    if (op !== "get") throw new Error("unexpected");
    if (nodeId === MIRROR.id) return MIRROR; // detail carries the mirror info
    if (nodeId === ORIGINAL.id) return ORIGINAL;
    throw new Error("unexpected");
  });
  expect(await resolveMirror("tok", blank)).toEqual(ORIGINAL);
  expect(calls.map((c) => c.nodeId)).toEqual([MIRROR.id, ORIGINAL.id]);
});

test("resolveMirror leaves a genuinely empty node and regular nodes alone", async () => {
  const blank: WorkflowyNode = { id: "empty-id", name: "" };
  const calls = stubProxy(({ nodeId }) => {
    if (nodeId === "empty-id") return { node: blank };
    throw new Error("unexpected");
  });
  expect(await resolveMirror("tok", blank)).toBe(blank);
  expect(calls).toHaveLength(1);

  const plain: WorkflowyNode = { id: "plain-id", name: "Plain" };
  expect(await resolveMirror("tok", plain)).toBe(plain);
  expect(calls).toHaveLength(1);
});

test("resolveMirror keeps the mirror when the original can't be fetched", async () => {
  stubProxy(() => {
    throw new Error("not found");
  });
  expect(await resolveMirror("tok", MIRROR)).toBe(MIRROR);
});

test("fetchWorkflowyTasks resolves mirrors, keeps the mirror's link, and dedupes", async () => {
  const plain: WorkflowyNode = {
    id: "0b3a4e4c-0000-4000-8000-0000000ccccc",
    name: "Plain task",
    priority: 0,
    completedAt: null,
  };
  const secondMirror: WorkflowyNode = {
    id: "0b3a4e4c-0000-4000-8000-0000000ddddd",
    name: "",
    priority: 2,
    data: { mirror: { originalId: ORIGINAL.id } },
  };
  stubProxy(({ op, nodeId, parentId }) => {
    if (op === "list" && parentId === "parent") {
      return { nodes: [secondMirror, { ...MIRROR, priority: 1 }, plain] };
    }
    if (op === "get" && nodeId === ORIGINAL.id) return { node: ORIGINAL };
    throw new Error("unexpected");
  });

  expect(await fetchWorkflowyTasks("tok", "parent")).toEqual([
    {
      workflowyId: plain.id,
      text: "Plain task",
      notes: "",
      url: getWorkflowyNodeUrl(plain.id),
      completed: false,
    },
    {
      workflowyId: ORIGINAL.id,
      text: "Mirrored task",
      notes: "from the original",
      url: getWorkflowyNodeUrl(MIRROR.id),
      completed: false,
    },
  ]);
});
