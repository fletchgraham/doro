export default interface Task {
  text: string;
  notes: string;
  id: string;
  events: TaskEvent[];
  status: "backlog" | "ready" | "working" | "active" | "done";
  duration: number;
  order: number;
  color?: string;
  estimate?: number;
}

interface TaskEvent {
  timestamp: number;
  eventType: "start" | "stop";
}
