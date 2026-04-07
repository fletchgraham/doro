import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.query.token;
  if (!token || typeof token !== "string") {
    return res.status(401).json({ error: "Missing token parameter" });
  }

  try {
    const url = new URL("https://api.todoist.com/api/v1/tasks/filter");
    url.searchParams.set("query", "today | overdue");

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
