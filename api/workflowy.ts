import type { VercelRequest, VercelResponse } from "@vercel/node";

const API_BASE = "https://workflowy.com/api/v1";

// Whitelisted operations mapped onto the official Workflowy API, so this
// endpoint can't be used as an open proxy.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token, op, parentId, nodeId, name, note, position } = req.body ?? {};

  if (!token || typeof token !== "string") {
    return res.status(401).json({ error: "Missing token" });
  }

  let url: string;
  let method: "GET" | "POST" = "GET";
  let body: Record<string, unknown> | undefined;

  switch (op) {
    case "list": {
      const params = new URLSearchParams();
      if (parentId && typeof parentId === "string") {
        params.set("parent_id", parentId);
      }
      const query = params.toString();
      url = `${API_BASE}/nodes${query ? `?${query}` : ""}`;
      break;
    }
    case "get":
      if (typeof nodeId !== "string" || !nodeId) {
        return res.status(400).json({ error: "Missing nodeId" });
      }
      url = `${API_BASE}/nodes/${encodeURIComponent(nodeId)}`;
      break;
    case "create":
      if (typeof parentId !== "string" || !parentId) {
        return res.status(400).json({ error: "Missing parentId" });
      }
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Missing name" });
      }
      url = `${API_BASE}/nodes`;
      method = "POST";
      body = {
        parent_id: parentId,
        name,
        ...(typeof note === "string" && note ? { note } : {}),
        position: position === "top" ? "top" : "bottom",
      };
      break;
    case "update": {
      if (typeof nodeId !== "string" || !nodeId) {
        return res.status(400).json({ error: "Missing nodeId" });
      }
      const fields: Record<string, unknown> = {};
      if (typeof name === "string") fields.name = name;
      if (typeof note === "string") fields.note = note;
      if (Object.keys(fields).length === 0) {
        return res.status(400).json({ error: "Nothing to update" });
      }
      url = `${API_BASE}/nodes/${encodeURIComponent(nodeId)}`;
      method = "POST";
      body = fields;
      break;
    }
    case "complete":
    case "uncomplete":
      if (typeof nodeId !== "string" || !nodeId) {
        return res.status(400).json({ error: "Missing nodeId" });
      }
      url = `${API_BASE}/nodes/${encodeURIComponent(nodeId)}/${op}`;
      method = "POST";
      break;
    default:
      return res.status(400).json({ error: "Unknown op" });
  }

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          (data as { error?: string })?.error ??
          `Workflowy API error: ${response.status}`,
      });
    }

    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ error: "Failed to reach Workflowy" });
  }
}
