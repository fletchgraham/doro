import type Task from "../types/Task";
import type Subtask from "../types/Subtask";
import type { ProjectsState } from "../types/Project";
import type { ProjectsAction } from "./projectsReducer";
import { sameSubtasks } from "./subtasks";

// A project task pulled into the day is a separate day task that points
// back at it via projectTaskId. The two share notes, subtasks and
// done-ness, and the day copy is titled with its project so it reads on
// its own in the timer's lists. These helpers compute what each side owes
// the other.

const SEPARATOR = " - ";

export const dayTaskText = (projectName: string, text: string): string =>
  `${projectName}${SEPARATOR}${text}`;

export const stripProjectPrefix = (
  dayText: string,
  projectName: string
): string => {
  const prefix = `${projectName}${SEPARATOR}`;
  return dayText.startsWith(prefix) ? dayText.slice(prefix.length) : dayText;
};

const isDone = (task: Task) => task.status === "done";

/**
 * Actions for the projects store after the day's tasks changed from `prev`
 * to `next`: notes edits, subtask changes, completions (and
 * un-completions) and renames on a linked day task are carried over to
 * its project task. Only real changes are returned, so applying them
 * never bounces back.
 */
export function syncDayToProjects(
  prev: Task[],
  next: Task[],
  state: ProjectsState
): ProjectsAction[] {
  const actions: ProjectsAction[] = [];
  const prevById = new Map(prev.map((t) => [t.id, t]));
  const projectTaskById = new Map(state.tasks.map((t) => [t.id, t]));
  const projectById = new Map(state.projects.map((p) => [p.id, p]));

  for (const task of next) {
    if (!task.projectTaskId) continue;
    const before = prevById.get(task.id);
    // Brand new (just assigned) or untouched: nothing to carry over
    if (!before || before === task) continue;
    const projectTask = projectTaskById.get(task.projectTaskId);
    if (!projectTask) continue;

    if (before.notes !== task.notes && projectTask.notes !== task.notes) {
      actions.push({
        type: "SET_TASK_NOTES",
        taskId: projectTask.id,
        notes: task.notes,
      });
    }
    if (
      before.subtasks !== task.subtasks &&
      !sameSubtasks(projectTask.subtasks, task.subtasks)
    ) {
      actions.push({
        type: "SET_SUBTASKS",
        taskId: projectTask.id,
        subtasks: task.subtasks,
      });
    }
    if (isDone(before) !== isDone(task) && projectTask.done !== isDone(task)) {
      actions.push({
        type: "SET_TASK_DONE",
        taskId: projectTask.id,
        done: isDone(task),
      });
    }
    if (before.text !== task.text) {
      const project = projectById.get(projectTask.projectId);
      const text = stripProjectPrefix(task.text, project?.name ?? "").trim();
      if (text && text !== projectTask.text) {
        actions.push({ type: "SET_TASK_TEXT", taskId: projectTask.id, text });
      }
    }
  }
  return actions;
}

export interface DayTaskUpdate {
  task: Task;
  text?: string;
  notes?: string;
  subtasks?: Subtask[];
  done?: boolean;
}

/**
 * What each linked day task needs to match its project task: the projects
 * store is the source of truth, so after any change there (a rename, a
 * project rename, notes, subtasks, ticking a task off) the day copies
 * follow. Day tasks whose project task is gone are left alone as plain
 * tasks.
 */
export function syncProjectsToDay(
  state: ProjectsState,
  dayTasks: Task[]
): DayTaskUpdate[] {
  const updates: DayTaskUpdate[] = [];
  const projectTaskById = new Map(state.tasks.map((t) => [t.id, t]));
  const projectById = new Map(state.projects.map((p) => [p.id, p]));

  for (const task of dayTasks) {
    if (!task.projectTaskId) continue;
    const projectTask = projectTaskById.get(task.projectTaskId);
    if (!projectTask) continue;
    const project = projectById.get(projectTask.projectId);
    if (!project) continue;

    const update: DayTaskUpdate = { task };
    const text = dayTaskText(project.name, projectTask.text);
    if (task.text !== text) update.text = text;
    if (task.notes !== projectTask.notes) update.notes = projectTask.notes;
    if (!sameSubtasks(task.subtasks, projectTask.subtasks)) {
      update.subtasks = projectTask.subtasks;
    }
    if (isDone(task) !== projectTask.done) update.done = projectTask.done;
    if (
      update.text !== undefined ||
      update.notes !== undefined ||
      update.subtasks !== undefined ||
      update.done !== undefined
    ) {
      updates.push(update);
    }
  }
  return updates;
}

/** The day task currently standing in for a project task, if any. */
export const findDayTask = (
  dayTasks: Task[],
  projectTaskId: string
): Task | undefined => dayTasks.find((t) => t.projectTaskId === projectTaskId);
