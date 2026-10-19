import { useMemo, useState } from "react";
import type Task from "../types/Task";
import type Subtask from "../types/Subtask";
import type { Template } from "../types/Template";
import SubtaskList, { SubtaskCount } from "./SubtaskList";
import LinkedText from "./LinkedText";
import SlashInput from "./SlashInput";
import { findTemplateByCommand, subtasksFromTemplate } from "../lib/templates";
import { useTemplateList } from "../hooks/useTemplates";
import { useDragSensors } from "../hooks/useDragSensors";
import { routeHash } from "../hooks/useHashRoute";
import { calculateDropOrder } from "../lib/calculateDropOrder";
import { formatDuration } from "../lib/formatDuration";
import { handleLineMoveKeyDown } from "../lib/moveLine";
import {
  addDays,
  formatDay,
  formatWeekRange,
  isDateKey,
  startOfWeek,
  weekDays,
} from "../lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  FolderKanban,
  Timer,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  useDroppable,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// The week planner: Monday to Sunday, each day a list of its tasks in an
// order of their own (reordering here leaves the day page's lists alone,
// and vice versa). Today's list is the same tasks the day page works
// through. Tasks drag within and between days; earlier days are greyed
// but stay fully editable.

export interface WeekTaskManager {
  setText: (task: Task, text: string) => void;
  setNotes: (task: Task, text: string) => void;
  addSubtask: (task: Task, text: string) => void;
  setSubtaskText: (task: Task, subtask: Subtask, text: string) => void;
  setSubtaskDone: (task: Task, subtask: Subtask, done: boolean) => void;
  moveSubtask: (task: Task, subtask: Subtask, index: number) => void;
  removeSubtask: (task: Task, subtask: Subtask) => void;
}

interface WeekPageProps {
  tasks: Task[];
  today: string;
  manager: WeekTaskManager;
  // The time on a task, live while it's on the clock
  getTaskDuration: (task: Task) => number;
  onAdd: (date: string, text: string, subtasks?: Subtask[]) => void;
  onMove: (task: Task, date: string, weekOrder?: number) => void;
  onToggleDone: (task: Task) => void;
  onRemove: (task: Task) => void;
  onOpenDay: (date: string) => void;
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

// Collapsed days are a per-browser convenience, remembered by date
const COLLAPSED_KEY = "doroWeekCollapsed";

const loadCollapsed = (): Set<string> => {
  try {
    const stored = JSON.parse(localStorage.getItem(COLLAPSED_KEY) || "[]");
    return new Set(Array.isArray(stored) ? stored.filter(isDateKey) : []);
  } catch {
    return new Set();
  }
};

const saveCollapsed = (collapsed: Set<string>) => {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
  } catch {
    // Storage unavailable: collapsing just won't be remembered
  }
};

// Prefer task rows under the pointer over the day lists holding them, so
// a drop lands at a precise position
const preferItemCollision: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const collisions =
    pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
  const itemCollision = collisions.find((c) => !isDateKey(String(c.id)));
  return itemCollision ? [itemCollision] : collisions;
};

function WeekPage({
  tasks,
  today,
  manager,
  getTaskDuration,
  onAdd,
  onMove,
  onToggleDone,
  onRemove,
  onOpenDay,
}: WeekPageProps) {
  const [monday, setMonday] = useState(() => startOfWeek(today));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const sensors = useDragSensors();

  const setDayCollapsed = (date: string, value: boolean) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (value) next.add(date);
      else next.delete(date);
      saveCollapsed(next);
      return next;
    });
  const days = useMemo(() => weekDays(monday), [monday]);
  const thisWeek = startOfWeek(today);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>(days.map((d) => [d, []]));
    for (const task of tasks) map.get(task.date)?.push(task);
    for (const list of map.values()) list.sort((a, b) => a.weekOrder - b.weekOrder);
    return map;
  }, [tasks, days]);

  const draggedTask = tasks.find((t) => t.id === activeId);

  const handleDragStart = (event: DragStartEvent) =>
    setActiveId(String(event.active.id));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const task = tasks.find((t) => t.id === active.id);
    if (!task) return;

    const overData = over.data.current;
    let targetDate: string;
    let dropIndex: number;
    if (overData?.sortable) {
      targetDate = String(overData.sortable.containerId);
      dropIndex = overData.sortable.index;
      // Another day's rows don't shift to make room, so dropping on a
      // row's lower half means "after it"
      if (task.date !== targetDate) {
        const activeRect = active.rect.current.translated;
        if (activeRect) {
          const activeMiddle = activeRect.top + activeRect.height / 2;
          const overMiddle = over.rect.top + over.rect.height / 2;
          if (activeMiddle > overMiddle) dropIndex += 1;
        }
      }
    } else {
      // Empty space in a day: to the end
      targetDate = String(over.id);
      dropIndex = Number.MAX_SAFE_INTEGER;
    }
    if (!isDateKey(targetDate)) return;

    const targetList = (tasksByDay.get(targetDate) ?? []).map((t) => ({
      id: t.id,
      order: t.weekOrder,
    }));
    const weekOrder = calculateDropOrder(targetList, dropIndex, task.id);
    if (task.date !== targetDate || task.weekOrder !== weekOrder) {
      onMove(task, targetDate, weekOrder);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setMonday((m) => addDays(m, -7))}
          aria-label="Previous week"
          title="Previous week"
        >
          <ChevronLeft />
        </Button>
        <h1 className="text-lg font-semibold" data-testid="week-range">
          {formatWeekRange(monday)}
        </h1>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setMonday((m) => addDays(m, 7))}
          aria-label="Next week"
          title="Next week"
        >
          <ChevronRight />
        </Button>
        {monday !== thisWeek && (
          <Button variant="ghost" size="sm" onClick={() => setMonday(thisWeek)}>
            This week
          </Button>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={preferItemCollision}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="space-y-4">
          {days.map((date) => (
            <WeekDay
              key={date}
              date={date}
              collapsed={collapsed.has(date)}
              onCollapsedChange={(value) => setDayCollapsed(date, value)}
              today={today}
              tasks={tasksByDay.get(date) ?? []}
              manager={manager}
              getTaskDuration={getTaskDuration}
              onAdd={onAdd}
              onMove={onMove}
              onToggleDone={onToggleDone}
              onRemove={onRemove}
              onOpenDay={onOpenDay}
            />
          ))}
        </div>
        <DragOverlay>
          {draggedTask ? (
            <div className="rounded-md border bg-background shadow-lg px-3 py-1.5 text-sm">
              <LinkedText text={draggedTask.text} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function WeekDay({
  date,
  collapsed,
  onCollapsedChange,
  today,
  tasks,
  manager,
  getTaskDuration,
  onAdd,
  onMove,
  onToggleDone,
  onRemove,
  onOpenDay,
}: Omit<WeekPageProps, "tasks"> & {
  date: string;
  tasks: Task[];
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const [newTask, setNewTask] = useState("");
  // The add box only shows once the + is clicked
  const [adding, setAdding] = useState(false);
  const templates = useTemplateList();
  const { setNodeRef, isOver } = useDroppable({ id: date });
  const ids = useMemo(() => tasks.map((t) => t.id), [tasks]);
  const isToday = date === today;
  const isPast = date < today;
  const total = tasks.reduce((sum, t) => sum + getTaskDuration(t), 0);

  const closeAdd = () => {
    setAdding(false);
    setNewTask("");
  };

  const addFromTemplate = (template: Template) => {
    onAdd(date, template.name, subtasksFromTemplate(template));
    setNewTask("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newTask.trim();
    if (!text) return;
    const template = findTemplateByCommand(templates, text);
    if (template) {
      addFromTemplate(template);
      return;
    }
    onAdd(date, text);
    setNewTask("");
  };

  return (
    // The whole day is the drop target, so a task can be dropped onto a
    // collapsed day's header
    <section
      ref={setNodeRef}
      data-testid="week-day"
      data-date={date}
      aria-label={formatDay(date)}
      aria-current={isToday ? "date" : undefined}
      className={cn(
        "rounded-md transition-[opacity,background-color]",
        isPast && "opacity-60",
        isOver && "bg-muted/50"
      )}
    >
      <div className="flex items-center gap-1 min-h-8">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onCollapsedChange(!collapsed)}
          className="text-muted-foreground"
          aria-label={collapsed ? `Expand ${formatDay(date)}` : `Collapse ${formatDay(date)}`}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight /> : <ChevronDown />}
        </Button>
        <a
          href={routeHash.timer}
          onClick={(e) => {
            e.preventDefault();
            onOpenDay(date);
          }}
          className="font-semibold hover:underline underline-offset-2"
          title="Open in the day view"
        >
          {formatDay(date)}
        </a>
        {isToday && (
          <span className="ml-1 text-xs font-medium rounded bg-foreground text-background px-1.5 py-0.5">
            Today
          </span>
        )}
        {collapsed && tasks.length > 0 && (
          <span
            className="ml-1 text-xs text-muted-foreground"
            data-testid="week-day-count"
          >
            {tasks.length} task{tasks.length === 1 ? "" : "s"}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {total > 0 && (
            <span
              className="text-xs text-muted-foreground tabular-nums"
              data-testid="week-day-total"
              title="Time worked this day"
            >
              {formatDuration(total)}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => {
              onCollapsedChange(false);
              setAdding(true);
            }}
            className="text-muted-foreground"
            aria-label={`Add task to ${formatDay(date)}`}
            title="Add task"
          >
            <Plus />
          </Button>
        </div>
      </div>
      {!collapsed && (
        <>
          <SortableContext id={date} items={ids} strategy={verticalListSortingStrategy}>
            <ul className="p-0 pl-5">
              {tasks.map((task) => (
                <WeekTaskRow
                  key={task.id}
                  task={task}
                  duration={getTaskDuration(task)}
                  manager={manager}
                  onToggleDone={() => onToggleDone(task)}
                  onMoveNext={() => onMove(task, addDays(date, 1))}
                  onRemove={() => onRemove(task)}
                />
              ))}
            </ul>
          </SortableContext>
          {adding && (
            <form onSubmit={handleSubmit} className="pl-6 mt-1">
              <SlashInput
                value={newTask}
                onChange={setNewTask}
                onTemplate={addFromTemplate}
                hint="adds a task with its subtasks"
                placeholder="New task... (/ for a template)"
                aria-label={`New task for ${formatDay(date)}`}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Escape") closeAdd();
                }}
                // Clicking away from an empty box puts the + back
                onBlur={() => {
                  if (!newTask.trim()) closeAdd();
                }}
                className="h-8"
              />
            </form>
          )}
        </>
      )}
    </section>
  );
}

function WeekTaskRow({
  task,
  duration,
  manager,
  onToggleDone,
  onMoveNext,
  onRemove,
}: {
  task: Task;
  duration: number;
  manager: WeekTaskManager;
  onToggleDone: () => void;
  onMoveNext: () => void;
  onRemove: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });
  const done = task.status === "done";

  const save = () => {
    const text = editText.trim();
    if (text && text !== task.text) manager.setText(task, text);
    setIsEditing(false);
  };

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="list-none rounded-md group hover:bg-muted/40"
      data-testid="week-task"
    >
      <div
        className="flex items-center gap-2 px-1 py-1 cursor-grab drag-handle"
        {...attributes}
        {...listeners}
      >
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setIsExpanded((x) => !x)}
          onPointerDown={stop}
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
          onPointerDown={stop}
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
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              else if (e.key === "Escape") {
                setEditText(task.text);
                setIsEditing(false);
              }
            }}
            onPointerDown={stop}
            autoFocus
            aria-label="Task name"
            className="flex-1 min-w-0 h-7"
          />
        ) : (
          <span
            onDoubleClick={() => {
              setEditText(task.text);
              setIsEditing(true);
            }}
            className={cn(
              "flex-1 min-w-0 break-words text-sm",
              done && "line-through text-muted-foreground"
            )}
          >
            <LinkedText text={task.text} />
            {task.projectTaskId && (
              <FolderKanban
                className="inline size-3.5 align-[-2px] ml-1 text-muted-foreground"
                aria-label="Part of a project"
              />
            )}
            {task.status === "active" && (
              <Timer
                className="inline size-3.5 align-[-2px] ml-1 text-green-600 dark:text-green-400"
                aria-label="On the clock"
                data-testid="week-task-active"
              />
            )}
          </span>
        )}
        <SubtaskCount subtasks={task.subtasks} />
        {duration > 0 && (
          <span
            className="text-xs text-muted-foreground tabular-nums"
            data-testid="week-task-duration"
          >
            {formatDuration(duration)}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onMoveNext}
          onPointerDown={stop}
          className="can-hover:opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          title={
            duration > 0
              ? "Move to the next day (the time logged stays on this one)"
              : "Move to the next day"
          }
          aria-label={`Move "${task.text}" to the next day`}
        >
          <ArrowRight />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => {
            if (window.confirm(`Delete "${task.text}"?`)) onRemove();
          }}
          onPointerDown={stop}
          className="can-hover:opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          aria-label={`Delete ${task.text}`}
        >
          ×
        </Button>
      </div>
      {isExpanded && (
        <div className="px-3 pb-3 pl-10 space-y-2">
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
          <Textarea
            value={task.notes}
            onChange={(e) => manager.setNotes(task, e.target.value)}
            onKeyDown={(e) => {
              const moved = handleLineMoveKeyDown(e);
              if (moved !== null) manager.setNotes(task, moved);
            }}
            onPointerDown={stop}
            placeholder="Notes..."
            className="min-h-[60px] resize-y"
          />
        </div>
      )}
    </li>
  );
}

export default WeekPage;
