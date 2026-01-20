import type Task from "../types/Task";
import getDuration from "./getDuration";

export type TasksAction =
  | { type: "ADD_TASK"; text: string }
  | { type: "REMOVE_TASK"; taskId: string }
  | { type: "NEXT_TASK" }
  | { type: "SET_STATUS"; taskId: string; status: string }
  | { type: "SET_NOTES"; taskId: string; text: string }
  | { type: "LOG_START" }
  | { type: "LOG_PAUSE" };

// for now this is duplicated from the hooks file, will delete the other when
// refactor is complete.
export const createTask = (text: string): Task => {
  return {
    text: text,
    notes: "",
    events: [],
    duration: 0,
    active: false,
    status: "backlog",
    id: crypto.randomUUID(),
  };
};

const tasksReducer = (state: Task[], action: TasksAction) => {
  switch (action.type) {
    case "ADD_TASK":
      return [...state, createTask(action.text)];
    case "REMOVE_TASK":
      return state.filter((t) => t.id !== action.taskId);
    case "NEXT_TASK": {
      const inactiveTasks = state.filter((t) => !t.active);
      const activeTask = state.find((t) => t.active);
      const updated = [
        ...inactiveTasks.map((t, i) => ({ ...t, active: i === 0 })),
      ];
      if (activeTask) updated.push({ ...activeTask, active: false });
      return updated;
    }
    case "SET_NOTES":
      return state.map((t) =>
        t.id === action.taskId ? { ...t, notes: action.text } : t,
      );
    case "LOG_PAUSE": {
      const updated = state.map((t) =>
        t.active
          ? {
              ...t,
              events: [
                ...t.events,
                { eventType: "stop" as const, timestamp: Date.now() },
              ],
            }
          : t,
      );
      return updated.map((t) => ({ ...t, duration: getDuration(t.events) }));
    }
    case "LOG_START":
      return state.map((t) =>
        t.active
          ? {
              ...t,
              events: [
                ...t.events,
                { eventType: "start" as const, timestamp: Date.now() },
              ],
            }
          : t,
      );
    case "SET_STATUS":
      return state.map((t) =>
        t.id === action.taskId ? { ...t, status: action.status } : t,
      );
  }
};

export default tasksReducer;
