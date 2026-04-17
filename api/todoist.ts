import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.query.token;
  if (!token || typeof token !== "string") {
    return res.status(401).json({ error: "Missing token parameter" });
  }

  const label = typeof req.query.label === "string" ? req.query.label.trim() : "";

  try {
    const url = new URL("https://api.todoist.com/api/v1/tasks/filter");
    // Label names in Todoist filter syntax are prefixed with @. Escape with
    // backslash for any special chars; conservatively strip whitespace/@ from
    // user input so the filter parses.
    const safeLabel = label.replace(/[^\w-]/g, "");
    const query = safeLabel
      ? `(today | overdue) & @${safeLabel}`
      : "today | overdue";
    url.searchParams.set("query", query);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Todoist API error: ${response.status}`,
      });
    }

    const data = await response.json();
    return res.status(200).json(data.results ?? []);
  } catch {
    return res.status(500).json({ error: "Failed to fetch from Todoist" });
  }
}
