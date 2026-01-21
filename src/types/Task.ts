export default interface Task {
  text: string;
  notes: string;
  id: string;
  events: TaskEvent[];
  active: boolean;
  status: "backlog" | "ready" | "working" | "done";
  duration: number;
  order: number;
}

interface TaskEvent {
  timestamp: number;
  eventType: "start" | "stop";
}
