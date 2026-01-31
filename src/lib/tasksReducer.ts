import type Task from "../types/Task";
import getDuration from "./getDuration";

export type TasksAction =
  | { type: "ADD_TASK"; text: string }
  | {
      type: "ADD_TASK_WITH_OPTIONS";
      text: string;
      status: Task["status"];
      position: "top" | "bottom";
    }
  | { type: "REMOVE_TASK"; taskId: string }
  | { type: "NEXT_TASK" }
  | { type: "SET_STATUS"; taskId: string; status: Task["status"] }
  | { type: "SET_NOTES"; taskId: string; text: string }
  | { type: "SET_TEXT"; taskId: string; text: string }
  | { type: "SET_PROJECT"; taskId: string; projectId: string | undefined }
  | { type: "SET_ESTIMATE"; taskId: string; estimate: number | undefined }
  | { type: "REORDER_TASK"; taskId: string; direction: "up" | "down" }
  | { type: "COMPLETE_TASK" }
  | { type: "LOG_START" }
  | { type: "LOG_PAUSE" };

const DEFAULT_ESTIMATE = 20 * 60 * 1000; // 20 minutes

export const createTask = (text: string): Task => {
  return {
    text: text,
    notes: "",
    events: [],
    duration: 0,
    status: "ready",
    id: crypto.randomUUID(),
    order: Date.now(),
    estimate: DEFAULT_ESTIMATE,
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
    case "ADD_TASK_WITH_OPTIONS": {
      // Calculate order based on position
      const statusTasks = state.filter((t) => t.status === action.status);
      const orders = statusTasks.map((t) => t.order);
      const minOrder = Math.min(...orders, Date.now());
      const maxOrder = Math.max(...orders, 0);
      const order =
        action.position === "top" ? minOrder - 1000 : maxOrder + 1000;

      const newTask: Task = {
        ...createTask(action.text),
        status: action.status,
        order,
      };

      // If adding as active, move current active task to working
      if (action.status === "active") {
        const maxWorkingOrder = Math.max(
          ...state.filter((t) => t.status === "working").map((t) => t.order),
          0
        );
        return [
          ...state.map((t) =>
            t.status === "active"
              ? { ...t, status: "working" as const, order: maxWorkingOrder + 1000 }
              : t
          ),
          newTask,
        ];
      }

      return [...state, newTask];
    }
    case "REMOVE_TASK":
      return state.filter((t) => t.id !== action.taskId);
    case "NEXT_TASK": {
      const activeTask = state.find((t) => t.status === "active");

      const maxWorkingOrder = Math.max(
        ...state.filter((t) => t.status === "working").map((t) => t.order),
        0
      );

      // Move current active task to working status
      const updatedState = state.map((t) => {
        if (t.status === "active") {
          return {
            ...t,
            status: "working" as const,
            order: maxWorkingOrder + 1000,
          };
        }
        return t;
      });

      // Find working tasks to pick next active from
      const workingTasks = updatedState
        .filter((t) => t.status === "working" && t.id !== activeTask?.id)
        .sort((a, b) => a.order - b.order);

      if (workingTasks.length === 0) {
        return updatedState;
      }

      // Activate the first working task
      return updatedState.map((t) => {
        if (t.id === workingTasks[0].id) {
          return { ...t, status: "active" as const };
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
        t.status === "active"
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
        t.status === "active"
          ? {
              ...t,
              events: [
                ...t.events,
                { eventType: "start" as const, timestamp: Date.now() },
              ],
            }
          : t,
      );
    case "SET_STATUS": {
      // If setting to active, move current active task to working first
      if (action.status === "active") {
        const maxWorkingOrder = Math.max(
          ...state.filter((t) => t.status === "working").map((t) => t.order),
          0
        );
        return state.map((t) => {
          if (t.id === action.taskId) {
            return { ...t, status: "active" as const };
          }
          if (t.status === "active") {
            return { ...t, status: "working" as const, order: maxWorkingOrder + 1000 };
          }
          return t;
        });
      }
      return state.map((t) =>
        t.id === action.taskId ? { ...t, status: action.status } : t
      );
    }
    case "SET_TEXT":
      return state.map((t) =>
        t.id === action.taskId ? { ...t, text: action.text } : t
      );
    case "SET_PROJECT":
      return state.map((t) =>
        t.id === action.taskId ? { ...t, projectId: action.projectId } : t
      );
    case "SET_ESTIMATE":
      return state.map((t) =>
        t.id === action.taskId ? { ...t, estimate: action.estimate } : t
      );
    case "REORDER_TASK": {
      const newOrder = calculateNewOrder(state, action.taskId, action.direction);
      return state.map((t) =>
        t.id === action.taskId ? { ...t, order: newOrder } : t
      );
    }
    case "COMPLETE_TASK": {
      const activeTask = state.find((t) => t.status === "active");
      if (!activeTask) return state;

      // Move active task to done
      let updated = state.map((t) =>
        t.status === "active" ? { ...t, status: "done" as const } : t
      );

      const readyTasks = updated
        .filter((t) => t.status === "ready")
        .sort((a, b) => a.order - b.order);

      // Always promote a ready task to working to maintain the pool
      if (readyTasks.length > 0) {
        const maxWorkingOrder = Math.max(
          ...updated.filter((t) => t.status === "working").map((t) => t.order),
          0
        );

        updated = updated.map((t) =>
          t.id === readyTasks[0].id
            ? { ...t, status: "working" as const, order: maxWorkingOrder + 1000 }
            : t
        );
      }

      // Activate the first working task
      const workingTasks = updated
        .filter((t) => t.status === "working")
        .sort((a, b) => a.order - b.order);

      if (workingTasks.length > 0) {
        updated = updated.map((t) =>
          t.id === workingTasks[0].id ? { ...t, status: "active" as const } : t
        );
      }

      return updated;
    }
  }
};

export default tasksReducer;
