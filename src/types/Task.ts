export default interface Task {
  text: string;
  notes: string;
  id: string;
  events: TaskEvent[];
}

interface TaskEvent {
  timestamp: number;
  eventType: "start" | "stop";
}
