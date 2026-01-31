import type Task from "../types/Task";

/**
 * Calculate the order value for a task being dropped at a specific index.
 *
 * @param tasks - The list of tasks in the target container (sorted by order)
 * @param dropIndex - The index where the task will be dropped
 * @param movingTaskId - The ID of the task being moved (to exclude from calculations)
 * @returns The new order value
 */
export function calculateDropOrder(
  tasks: Task[],
  dropIndex: number,
  movingTaskId: string
): number {
  // Filter out the moving task from calculations
  const otherTasks = tasks.filter((t) => t.id !== movingTaskId);

  // Empty list: use current timestamp
  if (otherTasks.length === 0) {
    return Date.now();
  }

  // Clamp dropIndex to valid range
  const index = Math.max(0, Math.min(dropIndex, otherTasks.length));

  // Dropping at the beginning
  if (index === 0) {
    return otherTasks[0].order - 1000;
  }

  // Dropping at the end
  if (index >= otherTasks.length) {
    return otherTasks[otherTasks.length - 1].order + 1000;
  }

  // Dropping between two items: average of adjacent orders
  const before = otherTasks[index - 1];
  const after = otherTasks[index];
  return (before.order + after.order) / 2;
}
