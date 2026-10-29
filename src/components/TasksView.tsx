import { useState, useEffect, useMemo } from "react";
import type Task from "../types/Task";
import type Subtask from "../types/Subtask";
import type { Template } from "../types/Template";
import SubtaskList, { SubtaskCount } from "./SubtaskList";
import LinkedText from "./LinkedText";
import AddInline from "./AddInline";
import TaskMenu from "./TaskMenu";
import TaskNotes from "./TaskNotes";
import { subtasksFromTemplate } from "../lib/templates";
import { formatDuration } from "../lib/formatDuration";
import { parseTime, formatEstimate } from "../lib/parseTime";
import { getAccomplishable, type AccomplishableResult } from "../lib/getAccomplishable";
import { calculateDropOrder } from "../lib/calculateDropOrder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ExternalLink, FolderKanban, Lock, LockOpen } from "lucide-react";
import { routeHash } from "../hooks/useHashRoute";
import TodoistImport from "./TodoistImport";
import { useSettingsContext } from "../hooks/useSettings";
import { useDragSensors } from "../hooks/useDragSensors";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  useDroppable,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import type { DraggableSyntheticListeners, DraggableAttributes } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

interface TaskManager {
  tasks: Task[];
  readyLocked: boolean;
  setReadyLocked: (locked: boolean) => void;
  getActiveTask: () => Task | undefined;
  getInactiveTasks: () => Task[];
  getTasksByStatus: (status: string, date?: string) => Task[];
  addTaskWithOptions: (
    text: string,
    status: Task["status"],
    position: "top" | "bottom",
    estimate?: number,
    subtasks?: Subtask[],
    date?: string
  ) => void;
  removeTask: (task: Task) => void;
  setNotes: (task: Task, text: string) => void;
  setText: (task: Task, text: string) => void;
  setStatus: (task: Task, status: Task["status"]) => void;
  setColor: (task: Task, color: string | undefined) => void;
  setEstimate: (task: Task, estimate: number | undefined) => void;
  setUrl: (task: Task, url: string | undefined) => void;
  addSubtask: (task: Task, text: string) => void;
  setSubtaskText: (task: Task, subtask: Subtask, text: string) => void;
  setSubtaskDone: (task: Task, subtask: Subtask, done: boolean) => void;
  moveSubtask: (task: Task, subtask: Subtask, index: number) => void;
  removeSubtask: (task: Task, subtask: Subtask) => void;
  reorderTask: (task: Task, direction: "up" | "down") => void;
  moveTask: (task: Task, toStatus: Task["status"], newOrder: number) => void;
  overrideDuration: (task: Task, duration: number) => void;
  importTasks: (tasks: Array<{
    text: string;
    notes: string;
    url?: string;
    color?: string;
    estimate?: number;
    todoistId?: string;
  }>) => void;
}

type DroppableStatus = "working" | "ready" | "done";

const CONTAINER_IDS = new Set<string>(["working", "ready", "done"]);

// Target whatever is under the pointer, preferring task items over their
// list containers — rectIntersection alone often picks the container,
// which loses the precise drop position
const preferItemCollision: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const collisions =
    pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
  const itemCollision = collisions.find(
    (c) => !CONTAINER_IDS.has(String(c.id))
  );
  return itemCollision ? [itemCollision] : collisions;
};

// The lists of one day's tasks (`date`, a date key) on the day page
function TasksView({
  taskManager,
  date,
  selectedTaskId,
  onSelectTask,
  onToggleDone,
  onOpenSettings,
}: {
  taskManager: TaskManager;
  date: string;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string | null) => void;
  onToggleDone: (task: Task) => void;
  onOpenSettings: () => void;
}) {
  const { features, todoist } = useSettingsContext();
  // Accomplishable coloring is a feature flag (Settings); the time budget
  // it works against is entered here
  const showAccomplishable = features.accomplishable;
  const [timeBudgetInput, setTimeBudgetInput] = useState(
    () => localStorage.getItem("doroTimeBudgetInput") || ""
  );
  const [timeBudget, setTimeBudget] = useState<number>(
    () => Number(localStorage.getItem("doroTimeBudget")) || 0
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  // Persist time budget settings to localStorage
  useEffect(() => {
    localStorage.setItem("doroTimeBudgetInput", timeBudgetInput);
  }, [timeBudgetInput]);

  useEffect(() => {
    localStorage.setItem("doroTimeBudget", String(timeBudget));
  }, [timeBudget]);

  // Note: KeyboardSensor omitted to avoid conflicts with existing arrow key reordering
  const sensors = useDragSensors();

  // Get tasks by status
  const workingTasks = useMemo(
    () => taskManager.getTasksByStatus("working", date),
    [taskManager, date]
  );
  const readyTasks = useMemo(
    () => taskManager.getTasksByStatus("ready", date),
    [taskManager, date]
  );
  const doneTasks = useMemo(
    () => taskManager.getTasksByStatus("done", date),
    [taskManager, date]
  );

  // Get task IDs for SortableContext
  const workingIds = useMemo(
    () => workingTasks.map((t) => t.id),
    [workingTasks]
  );
  const readyIds = useMemo(() => readyTasks.map((t) => t.id), [readyTasks]);
  const doneIds = useMemo(() => doneTasks.map((t) => t.id), [doneTasks]);

  // Get the active task being dragged
  const activeTask = useMemo(
    () => taskManager.tasks.find((t) => t.id === activeId),
    [taskManager.tasks, activeId]
  );

  // Get tasks in display order for accomplishable calculation
  const orderedTasks = useMemo(() => {
    return [...workingTasks, ...readyTasks];
  }, [workingTasks, readyTasks]);

  // Calculate accomplishable map
  const { results: accomplishableMap, totalRemainingWork } = useMemo(() => {
    if (!showAccomplishable || timeBudget <= 0) {
      return { results: new Map<string, AccomplishableResult>(), totalRemainingWork: 0 };
    }
    return getAccomplishable(orderedTasks, timeBudget);
  }, [orderedTasks, timeBudget, showAccomplishable]);

  const exportTasks = () => {
    const lines: string[] = [];
    const statuses: Task["status"][] = ["working", "ready", "done"];

    for (const status of statuses) {
      const tasks = taskManager.getTasksByStatus(status, date);
      if (tasks.length === 0) continue;

      lines.push(status);
      for (const task of tasks) {
        lines.push(`\t${task.text}`);
        if (task.duration > 0) {
          lines.push(`\t\tduration: ${formatDuration(task.duration)}`);
        }
        for (const subtask of task.subtasks) {
          lines.push(`\t\t[${subtask.done ? "x" : " "}] ${subtask.text}`);
        }
        if (task.notes.trim()) {
          lines.push(`\t\tnotes`);
          for (const noteLine of task.notes.split("\n")) {
            lines.push(`\t\t\t${noteLine}`);
          }
        }
      }
    }

    const text = lines.join("\n");
    navigator.clipboard.writeText(text);
  };

  const exportTasksForSheets = () => {
    const allTasks = [...workingTasks, ...readyTasks, ...doneTasks];
    const rows = allTasks.map((task) => {
      const hours = (task.duration / 3_600_000).toFixed(2);
      const notes = task.notes.replace(/[\r\n]+/g, " ").trim();
      return `${date}\t${task.text}\t${notes}\t${hours}`;
    });
    navigator.clipboard.writeText(rows.join("\n"));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedTaskId) return;

      // Don't hijack keys while typing in a field (task text edits, notes,
      // estimates...) — arrow keys should move the caret, not the task
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const task = taskManager.tasks.find((t) => t.id === selectedTaskId);
      if (!task) return;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        taskManager.reorderTask(task, "up");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        taskManager.reorderTask(task, "down");
      } else if (e.key === "Escape") {
        onSelectTask(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTaskId, taskManager, onSelectTask]);

  // The + under a list adds to the end of it; a template makes a task
  // named after it, with its steps as subtasks
  const addTo = (status: "working" | "ready") => ({
    onAdd: (text: string) =>
      taskManager.addTaskWithOptions(text, status, "bottom", undefined, undefined, date),
    onTemplate: (template: Template) =>
      taskManager.addTaskWithOptions(
        template.name,
        status,
        "bottom",
        undefined,
        subtasksFromTemplate(template),
        date
      ),
  });

  const handleTimeBudgetBlur = () => {
    const parsed = parseTime(timeBudgetInput);
    setTimeBudget(parsed ?? 0);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeTask = taskManager.tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    // Determine the target container and drop index
    const overData = over.data.current;
    let targetStatus: DroppableStatus;
    let dropIndex: number;

    if (overData?.sortable) {
      // Dropped on another sortable item
      targetStatus = overData.sortable.containerId as DroppableStatus;
      dropIndex = overData.sortable.index;
      // When dragging across lists, the target list's items don't shift to
      // make room, so the hovered item's index alone is ambiguous: dropping
      // on its lower half means "insert after it"
      if (activeTask.status !== targetStatus) {
        const activeRect = active.rect.current.translated;
        if (activeRect) {
          const activeMiddle = activeRect.top + activeRect.height / 2;
          const overMiddle = over.rect.top + over.rect.height / 2;
          if (activeMiddle > overMiddle) {
            dropIndex += 1;
          }
        }
      }
    } else {
      // Dropped on a container's empty space: place at the end
      targetStatus = over.id as DroppableStatus;
      dropIndex = Number.MAX_SAFE_INTEGER;
    }

    // Get the target tasks list
    const targetTasks =
      targetStatus === "working"
        ? workingTasks
        : targetStatus === "ready"
          ? readyTasks
          : doneTasks;

    // Calculate the new order value
    const newOrder = calculateDropOrder(targetTasks, dropIndex, activeTask.id);

    // Only move if something changed
    if (activeTask.status !== targetStatus || activeTask.order !== newOrder) {
      taskManager.moveTask(activeTask, targetStatus, newOrder);
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={preferItemCollision}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div>
        {/* Time budget controls */}
        {showAccomplishable && (
        <div className="flex items-center gap-4 mt-6 mb-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground whitespace-nowrap">
              Time left:
            </label>
            <Input
              value={timeBudgetInput}
              onChange={(e) => setTimeBudgetInput(e.target.value)}
              onBlur={handleTimeBudgetBlur}
              onKeyDown={(e) => e.key === "Enter" && handleTimeBudgetBlur()}
              onClick={(e) => e.stopPropagation()}
              placeholder="e.g., 3h"
              className="w-24 h-8"
            />
          </div>
          {timeBudget > 0 && (
            <span
              className={cn(
                "text-sm font-medium ml-auto",
                totalRemainingWork <= timeBudget
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              )}
            >
              {totalRemainingWork === timeBudget
                ? "On budget"
                : totalRemainingWork < timeBudget
                  ? `${formatEstimate(timeBudget - totalRemainingWork)} under`
                  : `${formatEstimate(totalRemainingWork - timeBudget)} over`}
            </span>
          )}
        </div>
        )}

        <h3 className="text-lg font-semibold mt-6 mb-2">Working</h3>
        <SortableContext
          id="working"
          items={workingIds}
          strategy={verticalListSortingStrategy}
        >
          <DroppableList id="working">
            {workingTasks.map((task: Task) => (
              <SortableTaskItem
                key={task.id}
                task={task}
                manager={taskManager}
                isSelected={selectedTaskId === task.id}
                onSelect={(id) => onSelectTask(id)}
                onToggleDone={() => onToggleDone(task)}
                accomplishable={accomplishableMap.get(task.id)}
                showAccomplishable={showAccomplishable}
              />
            ))}
          </DroppableList>
        </SortableContext>
        <AddInline
          {...addTo("working")}
          hint="adds a task with its subtasks"
          placeholder="New task... (/ for a template)"
          buttonLabel="Add task to Working"
          inputLabel="New task for Working"
          className="pl-2"
        />

        <div className="flex items-center gap-2 mt-6 mb-2">
          <h3 className="text-lg font-semibold">Next</h3>
          <Button
            variant={taskManager.readyLocked ? "default" : "ghost"}
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation();
              taskManager.setReadyLocked(!taskManager.readyLocked);
            }}
            title={
              taskManager.readyLocked
                ? "Next is locked: completing a task won't pull new work from here"
                : "Next is unlocked: completing a task pulls the next one from here"
            }
            aria-pressed={taskManager.readyLocked}
            aria-label="Toggle next list lock"
          >
            {taskManager.readyLocked ? (
              <Lock className="size-3.5" />
            ) : (
              <LockOpen className="size-3.5" />
            )}
          </Button>
          {taskManager.readyLocked && (
            <span className="text-xs text-muted-foreground">locked</span>
          )}
        </div>
        <SortableContext
          id="ready"
          items={readyIds}
          strategy={verticalListSortingStrategy}
        >
          <DroppableList id="ready">
            {readyTasks.map((task: Task) => (
              <SortableTaskItem
                key={task.id}
                task={task}
                manager={taskManager}
                isSelected={selectedTaskId === task.id}
                onSelect={(id) => onSelectTask(id)}
                onToggleDone={() => onToggleDone(task)}
                accomplishable={accomplishableMap.get(task.id)}
                showAccomplishable={showAccomplishable}
              />
            ))}
          </DroppableList>
        </SortableContext>

        <AddInline
          {...addTo("ready")}
          hint="adds a task with its subtasks"
          placeholder="New task... (/ for a template)"
          buttonLabel="Add task to Next"
          inputLabel="New task for Next"
          className="pl-2"
        />

        <h3 className="text-lg font-semibold mt-6 mb-2">Done</h3>
        <SortableContext
          id="done"
          items={doneIds}
          strategy={verticalListSortingStrategy}
        >
          <DroppableList id="done">
            {doneTasks.map((task: Task) => (
              <SortableTaskItem
                key={task.id}
                task={task}
                manager={taskManager}
                isSelected={selectedTaskId === task.id}
                onSelect={(id) => onSelectTask(id)}
                onToggleDone={() => onToggleDone(task)}
                showAccomplishable={false}
              />
            ))}
          </DroppableList>
        </SortableContext>

        {todoist.enabled && (
          <div className="mt-6">
            <TodoistImport
              onImport={taskManager.importTasks}
              onOpenSettings={onOpenSettings}
            />
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportTasks}>
            Export to Clipboard
          </Button>
          <Button variant="outline" onClick={exportTasksForSheets}>
            Export for Sheets
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (doneTasks.length === 0) return;
              if (window.confirm(`Delete ${doneTasks.length} completed task(s)?`)) {
                for (const task of doneTasks) {
                  taskManager.removeTask(task);
                }
              }
            }}
            disabled={doneTasks.length === 0}
          >
            Delete Completed
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const allTasks = [...workingTasks, ...readyTasks, ...doneTasks];
              if (allTasks.length === 0) return;
              if (window.confirm(`Delete all ${allTasks.length} task(s)? This cannot be undone.`)) {
                for (const task of allTasks) {
                  taskManager.removeTask(task);
                }
              }
            }}
            disabled={workingTasks.length + readyTasks.length + doneTasks.length === 0}
          >
            Delete All
          </Button>
        </div>
      </div>

      <DragOverlay>
        {activeTask ? <TaskItemOverlay task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

interface TaskItemProps {
  task: Task;
  manager: TaskManager;
  isSelected: boolean;
  onSelect: (taskId: string) => void;
  onToggleDone: () => void;
  accomplishable?: AccomplishableResult;
  showAccomplishable: boolean;
}

// Drag overlay component - simplified preview shown during drag
const TaskItemOverlay = ({ task }: { task: Task }) => {
  return (
    <div className="list-none rounded-md bg-background border border-border shadow-lg p-2 px-3 flex items-center gap-2">
      {/* Placeholder for expand button */}
      <div className="size-6 shrink-0" />
      <input
        type="checkbox"
        checked={task.status === "done"}
        readOnly
        tabIndex={-1}
        className="size-3.5 accent-green-500 shrink-0"
        aria-hidden="true"
      />
      <div
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: task.color || "#9ca3af" }}
      />
      <span className="flex-1 flex items-center gap-1">
        <LinkedText text={task.text} />
        {task.projectTaskId && (
          <FolderKanban
            className="size-3.5 text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </span>
      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded min-w-[3rem] text-center">
        {formatEstimate(task.estimate) || "—"}
      </span>
      <span className="text-muted-foreground text-xs min-w-[50px] text-right">
        {formatDuration(task.duration)}
      </span>
      {/* Placeholder for the ⋮ menu */}
      <div className="size-6 shrink-0" />
    </div>
  );
};

// Droppable list container for empty list support
const DroppableList = ({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <ul
      ref={setNodeRef}
      className={cn(
        "space-y-1 p-0 min-h-[40px] rounded-md transition-colors",
        isOver && "bg-muted/50"
      )}
    >
      {children}
    </ul>
  );
};

// Sortable wrapper for TaskItem
const SortableTaskItem = (props: TaskItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TaskItem
      {...props}
      sortableRef={setNodeRef}
      sortableStyle={style}
      sortableAttributes={attributes}
      sortableListeners={listeners}
      isDragging={isDragging}
    />
  );
};

interface TaskItemInternalProps extends TaskItemProps {
  sortableRef?: (node: HTMLElement | null) => void;
  sortableStyle?: React.CSSProperties;
  sortableAttributes?: DraggableAttributes;
  sortableListeners?: DraggableSyntheticListeners;
  isDragging?: boolean;
}

const TaskItem = ({
  task,
  manager,
  isSelected,
  onSelect,
  onToggleDone,
  accomplishable,
  showAccomplishable,
  sortableRef,
  sortableStyle,
  sortableAttributes,
  sortableListeners,
  isDragging,
}: TaskItemInternalProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingEstimate, setIsEditingEstimate] = useState(false);
  const [inlineEstimateInput, setInlineEstimateInput] = useState("");
  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [inlineDurationInput, setInlineDurationInput] = useState("");
  const [notesEditing, setNotesEditing] = useState(false);
  const done = task.status === "done";

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditText(task.text);
  };

  const handleSave = () => {
    if (editText.trim()) {
      manager.setText(task, editText.trim());
    } else {
      setEditText(task.text);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditText(task.text);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditing) {
      onSelect(task.id);
    }
  };

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleInlineEstimateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingEstimate(true);
    setInlineEstimateInput(formatEstimate(task.estimate) || "");
  };

  const handleInlineEstimateBlur = () => {
    const parsed = parseTime(inlineEstimateInput);
    if (parsed !== null) {
      manager.setEstimate(task, parsed);
    }
    setIsEditingEstimate(false);
    setInlineEstimateInput("");
  };

  const handleInlineEstimateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleInlineEstimateBlur();
    } else if (e.key === "Escape") {
      setIsEditingEstimate(false);
      setInlineEstimateInput("");
    }
  };

  const handleInlineDurationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingDuration(true);
    setInlineDurationInput(formatEstimate(task.duration) || formatDuration(task.duration));
  };

  const handleInlineDurationBlur = () => {
    const parsed = parseTime(inlineDurationInput);
    if (parsed !== null) {
      manager.overrideDuration(task, parsed);
    }
    setIsEditingDuration(false);
    setInlineDurationInput("");
  };

  const handleInlineDurationKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleInlineDurationBlur();
    } else if (e.key === "Escape") {
      setIsEditingDuration(false);
      setInlineDurationInput("");
    }
  };

  // Determine background color based on accomplishable status
  const getAccomplishableClasses = () => {
    if (!showAccomplishable || !accomplishable) return "";
    return accomplishable.isAccomplishable
      ? "bg-green-100 dark:bg-green-900/30"
      : "bg-red-100 dark:bg-red-900/30";
  };

  return (
    <li
      ref={sortableRef}
      style={sortableStyle}
      className={cn(
        "list-none rounded-md mb-1 group",
        isSelected ? "ring-2 ring-ring" : "",
        isDragging ? "opacity-50" : "",
        getAccomplishableClasses()
      )}
    >
      {/* Below sm the row may wrap: the first group sizes to its text, so
          the estimate, duration and delete controls drop to a second line
          only when they don't fit beside it */}
      <div
        onClick={handleClick}
        className="cursor-pointer p-2 px-3 flex flex-wrap items-center gap-2 drag-handle"
        {...sortableAttributes}
        {...sortableListeners}
      >
        <div className="flex-auto sm:flex-1 min-w-0 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={toggleExpand}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            !isExpanded &&
              "can-hover:opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          )}
          aria-label={isExpanded ? "Hide details" : "Show details"}
          aria-expanded={isExpanded}
        >
          {isExpanded ? "▼" : "▶"}
        </Button>

        <input
          type="checkbox"
          checked={done}
          onChange={onToggleDone}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="size-3.5 accent-green-500 cursor-pointer shrink-0"
          aria-label={done ? `Mark "${task.text}" not done` : `Mark "${task.text}" done`}
        />
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: task.color || "#9ca3af" }}
          aria-hidden="true"
        />

        {isEditing ? (
          <Input
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 h-7"
          />
        ) : (
          <span
            onDoubleClick={handleDoubleClick}
            className={cn(
              "flex-1 min-w-0 break-words",
              done && "line-through text-muted-foreground"
            )}
          >
            <LinkedText text={task.text} />
            {/* Icons flow inline after the last word, so they stay with the
                text when it wraps */}
            {task.projectTaskId && (
              <a
                href={routeHash.projects}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="inline-flex align-[-2px] ml-1 text-muted-foreground hover:text-foreground"
                title="Part of a project — open Projects"
                aria-label="Part of a project — open Projects"
                data-testid="task-project-indicator"
              >
                <FolderKanban className="size-3.5" />
              </a>
            )}
            {task.url && (
              <a
                href={task.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="inline-flex align-[-2px] ml-1 text-muted-foreground hover:text-foreground"
                title={task.url}
              >
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </span>
        )}

        </div>
        <div className="ml-auto flex items-center gap-2">
        <SubtaskCount subtasks={task.subtasks} />

        {/* Inline editable estimate */}
        {isEditingEstimate ? (
          <Input
            value={inlineEstimateInput}
            onChange={(e) => setInlineEstimateInput(e.target.value)}
            onBlur={handleInlineEstimateBlur}
            onKeyDown={handleInlineEstimateKeyDown}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onFocus={(e) => e.target.select()}
            autoFocus
            className="w-16 h-6 text-xs px-1.5"
            placeholder="20m"
          />
        ) : (
          <span
            onClick={handleInlineEstimateClick}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded cursor-text hover:bg-muted/80 min-w-[3rem] text-center"
            title="Click to edit estimate"
          >
            {formatEstimate(task.estimate) || "—"}
          </span>
        )}

        {isEditingDuration ? (
          <Input
            value={inlineDurationInput}
            onChange={(e) => setInlineDurationInput(e.target.value)}
            onBlur={handleInlineDurationBlur}
            onKeyDown={handleInlineDurationKeyDown}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onFocus={(e) => e.target.select()}
            autoFocus
            className="w-16 h-6 text-xs px-1.5"
            placeholder="20m"
          />
        ) : (
          <span
            onClick={handleInlineDurationClick}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-muted-foreground text-xs min-w-[50px] text-right cursor-text hover:bg-muted/80 rounded px-1"
            title="Click to edit duration"
          >
            {formatDuration(task.duration)}
          </span>
        )}

        <TaskMenu
          task={task}
          onColorChange={(color) => manager.setColor(task, color)}
          onUrlChange={(url) => manager.setUrl(task, url)}
          onAddNotes={() => {
            setIsExpanded(true);
            setNotesEditing(true);
          }}
          onRemove={() => manager.removeTask(task)}
        />
        </div>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 pl-20 space-y-1">
          <TaskNotes
            notes={task.notes}
            onChange={(notes) => manager.setNotes(task, notes)}
            editing={notesEditing}
            onEditingChange={setNotesEditing}
          />
          <SubtaskList
            subtasks={task.subtasks}
            onAdd={(text) => manager.addSubtask(task, text)}
            onTextChange={(subtask, text) =>
              manager.setSubtaskText(task, subtask, text)
            }
            onDoneChange={(subtask, done) =>
              manager.setSubtaskDone(task, subtask, done)
            }
            onMove={(subtask, index) => manager.moveSubtask(task, subtask, index)}
            onRemove={(subtask) => manager.removeSubtask(task, subtask)}
          />
        </div>
      )}
    </li>
  );
};

export default TasksView;
