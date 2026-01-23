import type Task from "../types/Task";
import getDuration from "./getDuration";

export type TasksAction =
  | { type: "ADD_TASK"; text: string }
  | { type: "REMOVE_TASK"; taskId: string }
  | { type: "NEXT_TASK" }
  | { type: "SET_STATUS"; taskId: string; status: Task["status"] }
  | { type: "SET_NOTES"; taskId: string; text: string }
  | { type: "SET_TEXT"; taskId: string; text: string }
  | { type: "SET_PROJECT"; taskId: string; projectId: string | undefined }
  | { type: "REORDER_TASK"; taskId: string; direction: "up" | "down" }
  | { type: "COMPLETE_TASK" }
  | { type: "LOG_START" }
  | { type: "LOG_PAUSE" };

export const createTask = (text: string): Task => {
  return {
    text: text,
    notes: "",
    events: [],
    duration: 0,
    active: false,
    status: "ready",
    id: crypto.randomUUID(),
    order: Date.now(),
  };
};

const calculateNewOrder = (
  tasks: Task[],
  taskId: string,
  direction: "up" | "down"
): number => {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return 0;

  const bucketTasks = tasks
    .filter((t) => t.status === task.status)
    .sort((a, b) => a.order - b.order);

  const currentIndex = bucketTasks.findIndex((t) => t.id === taskId);

  if (direction === "up") {
    if (currentIndex <= 0) return task.order;
    const above = bucketTasks[currentIndex - 1];
    const aboveAbove = bucketTasks[currentIndex - 2];
    if (aboveAbove) {
      return (aboveAbove.order + above.order) / 2;
    }
    return above.order - 1000;
  } else {
    if (currentIndex >= bucketTasks.length - 1) return task.order;
    const below = bucketTasks[currentIndex + 1];
    const belowBelow = bucketTasks[currentIndex + 2];
    if (belowBelow) {
      return (below.order + belowBelow.order) / 2;
    }
    return below.order + 1000;
  }
};

const tasksReducer = (state: Task[], action: TasksAction) => {
  switch (action.type) {
    case "ADD_TASK":
      return [...state, createTask(action.text)];
    case "REMOVE_TASK":
      return state.filter((t) => t.id !== action.taskId);
    case "NEXT_TASK": {
      const activeTask = state.find((t) => t.active);

      const maxWorkingOrder = Math.max(
        ...state.filter((t) => t.status === "working").map((t) => t.order),
        0
      );

      const updatedState = state.map((t) => {
        if (t.active) {
          return {
            ...t,
            active: false,
            status: "working" as const,
            order: maxWorkingOrder + 1000,
          };
        }
        return t;
      });

      const workingTasks = updatedState
        .filter((t) => t.status === "working" && t.id !== activeTask?.id)
        .sort((a, b) => a.order - b.order);

      if (workingTasks.length === 0) {
        return updatedState;
      }

      return updatedState.map((t) => {
        if (t.id === workingTasks[0].id) {
          return { ...t, active: true };
        }
        return t;
      });
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
        t.id === action.taskId ? { ...t, status: action.status } : t
      );
    case "SET_TEXT":
      return state.map((t) =>
        t.id === action.taskId ? { ...t, text: action.text } : t
      );
    case "SET_PROJECT":
      return state.map((t) =>
        t.id === action.taskId ? { ...t, projectId: action.projectId } : t
      );
    case "REORDER_TASK": {
      const newOrder = calculateNewOrder(state, action.taskId, action.direction);
      return state.map((t) =>
        t.id === action.taskId ? { ...t, order: newOrder } : t
      );
    }
    case "COMPLETE_TASK": {
      const activeTask = state.find((t) => t.active);
      if (!activeTask) return state;

      let updated = state.map((t) =>
        t.active ? { ...t, active: false, status: "done" as const } : t
      );

      let workingTasks = updated
        .filter((t) => t.status === "working")
        .sort((a, b) => a.order - b.order);

      const readyTasks = updated
        .filter((t) => t.status === "ready")
        .sort((a, b) => a.order - b.order);

      if (workingTasks.length < 3 && readyTasks.length > 0) {
        const maxWorkingOrder = Math.max(
          ...updated.filter((t) => t.status === "working").map((t) => t.order),
          0
        );

        updated = updated.map((t) =>
          t.id === readyTasks[0].id
            ? { ...t, status: "working" as const, order: maxWorkingOrder + 1000 }
            : t
        );

        workingTasks = updated
          .filter((t) => t.status === "working")
          .sort((a, b) => a.order - b.order);
      }

      if (workingTasks.length > 0) {
        updated = updated.map((t) =>
          t.id === workingTasks[0].id ? { ...t, active: true } : t
        );
      }

      return updated;
    }
  }
};

export default tasksReducer;
