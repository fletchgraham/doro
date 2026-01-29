export default interface Task {
  text: string;
  notes: string;
  id: string;
  events: TaskEvent[];
  status: "backlog" | "ready" | "working" | "active" | "done";
  duration: number;
  order: number;
  projectId?: string;
}

interface TaskEvent {
  timestamp: number;
  eventType: "start" | "stop";
}
