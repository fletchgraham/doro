import type Task from "../types/Task";

export const DEFAULT_ESTIMATE = 20 * 60 * 1000; // 20 minutes

export interface AccomplishableResult {
  taskId: string;
  remainingWork: number;
  cumulativeWork: number;
  isAccomplishable: boolean;
}

/**
 * Calculate which tasks can be accomplished within a given time budget.
 * Tasks are evaluated in the order provided.
 *
 * @param tasks - Tasks in display order (should be working/ready tasks only)
 * @param timeBudget - Total time available in milliseconds
 * @returns Map of task ID to accomplishable result
 */
export function getAccomplishable(
  tasks: Task[],
  timeBudget: number
): Map<string, AccomplishableResult> {
  const result = new Map<string, AccomplishableResult>();
  let cumulative = 0;

  for (const task of tasks) {
    // Calculate remaining work: estimate minus what's already been done
    // If no estimate, assume default of 20 minutes
    // If duration exceeds estimate, remaining work is 0
    const estimate = task.estimate ?? DEFAULT_ESTIMATE;
    const remainingWork = Math.max(0, estimate - task.duration);

    cumulative += remainingWork;

    result.set(task.id, {
      taskId: task.id,
      remainingWork,
      cumulativeWork: cumulative,
      isAccomplishable: cumulative <= timeBudget,
    });
  }

  return result;
}
