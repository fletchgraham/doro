// A checkable step within a task. Subtasks carry no time, points or
// notes of their own: they're a checklist, ordered by their position in
// the parent's array.
export default interface Subtask {
  id: string;
  text: string;
  done: boolean;
}
