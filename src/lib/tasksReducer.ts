import type Task from "../types/Task";

type TasksAction =
  | { type: "ADD_TASK"; text: string }
  | { type: "REMOVE_TASK"; taskId: string };

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
  }
};

export default tasksReducer;
