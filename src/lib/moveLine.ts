import type { KeyboardEvent } from "react";

export interface MoveLineResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Swap the line(s) covered by the selection with the adjacent line
 * above (direction -1) or below (direction 1). Returns null when the
 * selection is already at the edge and can't move.
 */
export function moveLine(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  direction: -1 | 1
): MoveLineResult | null {
  const lines = value.split("\n");

  const lineStarts: number[] = [0];
  for (let i = 0; i < lines.length - 1; i++) {
    lineStarts.push(lineStarts[i] + lines[i].length + 1);
  }

  const lineIndexAt = (offset: number) => {
    let index = 0;
    while (index + 1 < lineStarts.length && lineStarts[index + 1] <= offset) {
      index++;
    }
    return index;
  };

  const startLine = lineIndexAt(selectionStart);
  let endLine = lineIndexAt(selectionEnd);
  // A selection ending at the very start of a line doesn't include that line
  if (endLine > startLine && selectionEnd === lineStarts[endLine]) {
    endLine--;
  }

  if (direction === -1 && startLine === 0) return null;
  if (direction === 1 && endLine === lines.length - 1) return null;

  const newLines = [...lines];
  let delta: number;
  if (direction === -1) {
    const [moved] = newLines.splice(startLine - 1, 1);
    newLines.splice(endLine, 0, moved);
    delta = -(moved.length + 1);
  } else {
    const [moved] = newLines.splice(endLine + 1, 1);
    newLines.splice(startLine, 0, moved);
    delta = moved.length + 1;
  }

  return {
    value: newLines.join("\n"),
    selectionStart: selectionStart + delta,
    selectionEnd: selectionEnd + delta,
  };
}

/**
 * Handle alt+ArrowUp / alt+ArrowDown in a textarea by moving the
 * selected line(s). Returns the new value, or null if the event isn't a
 * line-move shortcut or the lines can't move. Restores the caret after
 * the controlled re-render.
 */
export function handleLineMoveKeyDown(
  e: KeyboardEvent<HTMLTextAreaElement>
): string | null {
  if (
    !e.altKey ||
    e.ctrlKey ||
    e.metaKey ||
    (e.key !== "ArrowUp" && e.key !== "ArrowDown")
  ) {
    return null;
  }
  e.preventDefault();
  const el = e.currentTarget;
  const result = moveLine(
    el.value,
    el.selectionStart,
    el.selectionEnd,
    e.key === "ArrowUp" ? -1 : 1
  );
  if (!result) return null;
  requestAnimationFrame(() => {
    el.setSelectionRange(result.selectionStart, result.selectionEnd);
  });
  return result.value;
}
