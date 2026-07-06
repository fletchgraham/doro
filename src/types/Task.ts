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
}

export interface TaskEvent {
  timestamp: number;
  eventType: "start" | "stop" | "duration_override";
  duration?: number;
}
