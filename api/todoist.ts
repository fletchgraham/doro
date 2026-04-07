import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  try {
    const response = await fetch("https://api.todoist.com/rest/v2/tasks", {
      headers: { Authorization: authHeader },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Todoist API error: ${response.status}`,
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ error: "Failed to fetch from Todoist" });
  }
}
