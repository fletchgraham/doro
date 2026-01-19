export default interface Task {
  text: string;
  notes: string;
  id: string;
  events: TaskEvent[];
  duration: number;
}

interface TaskEvent {
  timestamp: number;
  eventType: "start" | "stop";
}
