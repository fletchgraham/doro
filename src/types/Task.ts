export default interface Task {
  text: string;
  notes: string;
  id: string;
  events: TaskEvent[];
  status: "ready" | "working" | "active" | "done";
  duration: number;
  order: number;
  color?: string;
  estimate?: number;
  url?: string;
  todoistId?: string;
  workflowyId?: string;
  // Set when this task was pulled in from the projects page; it shares
  // notes and completion with that project task
  projectTaskId?: string;
}

export interface TaskEvent {
  timestamp: number;
  eventType: "start" | "stop" | "duration_override";
  duration?: number;
}
