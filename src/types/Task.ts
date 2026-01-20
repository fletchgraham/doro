export default interface Task {
  text: string;
  notes: string;
  id: string;
  events: TaskEvent[];
  active: boolean;
  status: string;
  duration: number;
}

interface TaskEvent {
  timestamp: number;
  eventType: "start" | "stop";
}
