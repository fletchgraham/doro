import { useId, useMemo, useState } from "react";
import type Subtask from "../types/Subtask";
import type { Template } from "../types/Template";
import { subtaskProgress } from "../lib/subtasks";
import { findTemplateByCommand, templateSteps } from "../lib/templates";
import { useTemplateList } from "../hooks/useTemplates";
import LinkedText from "./LinkedText";
import SlashInput from "./SlashInput";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ListChecks } from "lucide-react";
import { useDragSensors } from "../hooks/useDragSensors";
import {
  DndContext,
  closestCenter,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// A task's checklist: checkable, renamable, drag-reorderable items with
// nothing else attached. Shared by the projects page, the timer's task
// lists and the active task view, which each own the storage.
//
// It runs its own DndContext, nested inside the page's where there is
// one. That works because the parent rows only listen for drags on their
// header, and the checklist lives in the expanded area beside it.
//
// Given a `dragTaskId` it instead joins the page's DndContext, so its
// rows can be dragged to other tasks' checklists. Rows then carry
// SubtaskDragData, the list SubtaskListDropData, and the page handles
// the drop.

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export interface SubtaskDragData {
  type: "subtask";
  taskId: string;
  subtask: Subtask;
}

export interface SubtaskListDropData {
  type: "subtask-list";
  taskId: string;
}

const subtaskListDropId = (taskId: string) => "subtasks:" + taskId;

export interface SubtaskListProps {
  subtasks: Subtask[];
  onAdd: (text: string) => void;
  onTextChange: (subtask: Subtask, text: string) => void;
  onDoneChange: (subtask: Subtask, done: boolean) => void;
  onMove: (subtask: Subtask, index: number) => void;
  onRemove: (subtask: Subtask) => void;
  // Join the enclosing DndContext as this task's checklist
  dragTaskId?: string;
  className?: string;
}

function SubtaskList({
  subtasks,
  onAdd,
  onTextChange,
  onDoneChange,
  onMove,
  onRemove,
  dragTaskId,
  className,
}: SubtaskListProps) {
  const [newText, setNewText] = useState("");
  const templates = useTemplateList();
  const ids = useMemo(() => subtasks.map((s) => s.id), [subtasks]);

  const sensors = useDragSensors({ distance: 5 });
  // Only registered with the page's context, so an empty checklist (or
  // the add box under it) still takes a drop
  const fallbackId = useId();
  const { setNodeRef, isOver, active } = useDroppable({
    id: dragTaskId ? subtaskListDropId(dragTaskId) : fallbackId,
    data: { type: "subtask-list", taskId: dragTaskId } as SubtaskListDropData,
    disabled: !dragTaskId,
  });
  const incoming =
    isOver &&
    (active?.data.current as SubtaskDragData | undefined)?.taskId !==
      dragTaskId;

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const subtask = subtasks.find((s) => s.id === active.id);
    const index = subtasks.findIndex((s) => s.id === over.id);
    if (subtask && index !== -1) onMove(subtask, index);
  };

  // A template's steps become subtasks in order; the reducer runs each
  // add against the state the previous one left
  const addTemplate = (template: Template) => {
    for (const step of templateSteps(template)) onAdd(step);
    setNewText("");
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newText.trim();
    if (!text) return;
    const template = findTemplateByCommand(templates, text);
    if (template) {
      addTemplate(template);
      return;
    }
    onAdd(text);
    setNewText("");
  };

  const list = (
    <SortableContext
      id={dragTaskId ? subtaskListDropId(dragTaskId) : undefined}
      items={ids}
      strategy={verticalListSortingStrategy}
    >
      <ul className="p-0 space-y-0.5">
        {subtasks.map((subtask, index) => (
          <SubtaskRow
            key={subtask.id}
            subtask={subtask}
            dragTaskId={dragTaskId}
            onTextChange={(text) => onTextChange(subtask, text)}
            onDoneChange={(done) => onDoneChange(subtask, done)}
            onMoveBy={(delta) => onMove(subtask, index + delta)}
            onRemove={() => onRemove(subtask)}
          />
        ))}
      </ul>
    </SortableContext>
  );

  return (
    <div
      ref={dragTaskId ? setNodeRef : undefined}
      className={cn(
        "space-y-1 rounded transition-colors",
        incoming && "bg-muted/50",
        className
      )}
      data-testid="subtasks"
      onClick={stop}
      onPointerDown={stop}
    >
      {subtasks.length > 0 &&
        (dragTaskId ? (
          list
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            {list}
          </DndContext>
        ))}
      <form onSubmit={handleAdd}>
        <SlashInput
          value={newText}
          onChange={setNewText}
          onTemplate={addTemplate}
          hint="adds its subtasks"
          placeholder="Add subtask... (/ for a template)"
          enterKeyHint="done"
          className="h-7 text-sm"
          aria-label="New subtask"
        />
      </form>
    </div>
  );
}

function SubtaskRow({
  subtask,
  dragTaskId,
  onTextChange,
  onDoneChange,
  onMoveBy,
  onRemove,
}: {
  subtask: Subtask;
  dragTaskId?: string;
  onTextChange: (text: string) => void;
  onDoneChange: (done: boolean) => void;
  onMoveBy: (delta: number) => void;
  onRemove: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(subtask.text);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: subtask.id,
    data: dragTaskId
      ? ({ type: "subtask", taskId: dragTaskId, subtask } as SubtaskDragData)
      : undefined,
  });

  const startEdit = () => {
    setEditText(subtask.text);
    setIsEditing(true);
  };

  const save = () => {
    const text = editText.trim();
    if (text && text !== subtask.text) onTextChange(text);
    setIsEditing(false);
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "list-none flex items-center gap-2 rounded px-1 py-0.5 text-sm group/subtask drag-handle",
        isDragging && "opacity-50"
      )}
      data-testid="subtask"
      {...attributes}
      {...listeners}
    >
      <input
        type="checkbox"
        checked={subtask.done}
        onChange={(e) => onDoneChange(e.target.checked)}
        onPointerDown={stop}
        className="size-3.5 accent-green-500 cursor-pointer shrink-0"
        aria-label={
          subtask.done
            ? `Mark "${subtask.text}" not done`
            : `Mark "${subtask.text}" done`
        }
      />
      {isEditing ? (
        <Input
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setIsEditing(false);
            // Alt+arrows move the item, as they move lines in notes
            if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
              e.preventDefault();
              onMoveBy(e.key === "ArrowUp" ? -1 : 1);
            }
          }}
          autoFocus
          onPointerDown={stop}
          className="flex-1 h-6 text-sm"
          aria-label="Subtask text"
        />
      ) : (
        <span
          onDoubleClick={startEdit}
          className={cn(
            "flex-1 min-w-0 break-words cursor-default",
            subtask.done && "line-through text-muted-foreground"
          )}
          title="Double-click to rename, drag to reorder"
        >
          <LinkedText text={subtask.text} />
        </span>
      )}
      <Button
        variant="ghost"
        size="icon-xs"
        onPointerDown={stop}
        onClick={onRemove}
        className="can-hover:opacity-0 group-hover/subtask:opacity-100 focus-visible:opacity-100"
        aria-label={`Delete subtask ${subtask.text}`}
      >
        ×
      </Button>
    </li>
  );
}

/** A subtask row as it follows the pointer between checklists. */
export const SubtaskOverlay = ({ subtask }: { subtask: Subtask }) => (
  <div className="flex items-center gap-2 rounded border bg-background shadow-lg px-1 py-0.5 text-sm">
    <input
      type="checkbox"
      checked={subtask.done}
      readOnly
      tabIndex={-1}
      className="size-3.5 accent-green-500 shrink-0"
      aria-hidden="true"
    />
    <span
      className={cn(
        "flex-1 min-w-0 break-words",
        subtask.done && "line-through text-muted-foreground"
      )}
    >
      <LinkedText text={subtask.text} />
    </span>
  </div>
);

/** "2/5" badge for a row whose checklist is folded away. */
export function SubtaskCount({ subtasks }: { subtasks: Subtask[] }) {
  const { done, total } = subtaskProgress(subtasks);
  if (total === 0) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs tabular-nums whitespace-nowrap",
        done === total ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
      )}
      data-testid="subtask-count"
      title={`${done} of ${total} subtasks done`}
      aria-label={`${done} of ${total} subtasks done`}
    >
      <ListChecks className="size-3.5" aria-hidden="true" />
      {done}/{total}
    </span>
  );
}

export default SubtaskList;
