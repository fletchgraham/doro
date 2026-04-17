interface TodoistTask {
  id: string;
  content: string;
  description: string;
  priority: number; // 1 (normal) to 4 (urgent)
  order: number;
}

export interface ImportableTask {
  text: string;
  notes: string;
  url?: string;
  color: string;
  todoistId: string;
}

const PRIORITY_COLOR_MAP: Record<number, string> = {
  4: "#f87171", // urgent -> red
  3: "#fb923c", // high -> orange
  2: "#60a5fa", // medium -> blue
  1: "#9ca3af", // normal -> gray
};

const TODOIST_WEB_URI = "https://app.todoist.com/app";

/**
 * Slugify a string the same way the Todoist SDK does (Django-style):
 * NFKD normalize, strip combining marks, drop non-ASCII, lowercase,
 * remove non-word chars, collapse spaces/dashes to single dashes,
 * trim leading/trailing dashes.
 */
export function slugifyTodoistContent(value: string): string {
  let result = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  result = result.replace(/[^\x20-\x7E]/g, "");
  result = result.toLowerCase().replace(/[^\w\s-]/g, "");
  result = result.replace(/[-\s]+/g, "-");
  return result.replace(/^-+|-+$/g, "");
}

/**
 * Build a Todoist task URL from its id and content, matching the format
 * the Todoist SDK generates: https://app.todoist.com/app/task/<slug>-<id>
 */
export function getTodoistTaskUrl(id: string, content: string): string {
  const slug = content ? slugifyTodoistContent(content) : "";
  const path = slug ? `${slug}-${id}` : id;
  return `${TODOIST_WEB_URI}/task/${path}`;
}

export async function fetchTodaysTasks(
  token: string,
  label?: string
): Promise<ImportableTask[]> {
  const params = new URLSearchParams({ token });
  if (label?.trim()) {
    params.set("label", label.trim());
  }
  const response = await fetch(`/api/todoist?${params.toString()}`);

  if (!response.ok) {
    if (response.status === 401) throw new Error("Invalid Todoist API token");
    throw new Error(`Todoist API error: ${response.status}`);
  }

  const tasks: TodoistTask[] = await response.json();

  return tasks
    .sort((a, b) => a.order - b.order)
    .map((t) => ({
      text: t.content,
      notes: t.description,
      url: getTodoistTaskUrl(t.id, t.content),
      color: PRIORITY_COLOR_MAP[t.priority] ?? "#9ca3af",
      todoistId: t.id,
    }));
}

export function getTodoistToken(): string | null {
  return localStorage.getItem("doroTodoistToken");
}

export function setTodoistToken(token: string): void {
  localStorage.setItem("doroTodoistToken", token);
}

export function clearTodoistToken(): void {
  localStorage.removeItem("doroTodoistToken");
}

export function getTodoistLabel(): string {
  return localStorage.getItem("doroTodoistLabel") ?? "";
}

export function setTodoistLabel(label: string): void {
  localStorage.setItem("doroTodoistLabel", label);
}
