import type Task from "../types/Task";

interface TasksAction {
  type: string; // I think this should be union of all of the actions I wrote out
  args: any; // not sure how to handle this because each action needs different info
}

// for now this is duplicated from the hooks file, will delete the other when
// refactor is complete.
const createTask = (text: string): Task => {
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
      return [...state, createTask(action.args.text)];
  }
  return state;
};

export default tasksReducer;
