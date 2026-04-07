interface TodoistItem {
  id: string;
  content: string;
  description: string;
  priority: number; // 1 (normal) to 4 (urgent)
  due: { date: string; string: string; is_recurring?: boolean } | null;
  labels: string[];
  child_order: number;
  checked: boolean;
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

export async function fetchTodaysTasks(
  token: string
): Promise<ImportableTask[]> {
  const response = await fetch(
    `/api/todoist?token=${encodeURIComponent(token)}`
  );

  if (!response.ok) {
    if (response.status === 401) throw new Error("Invalid Todoist API token");
    throw new Error(`Todoist API error: ${response.status}`);
  }

  const items: TodoistItem[] = await response.json();
  const today = new Date().toLocaleDateString("en-CA"); // "YYYY-MM-DD" in local timezone

  return items
    .filter((t) => !t.checked && t.due?.date === today)
    .sort((a, b) => a.child_order - b.child_order)
    .map((t) => ({
      text: t.content,
      notes: t.description,
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
