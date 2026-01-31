import { useState, useEffect, useMemo } from "react";
import type Task from "../types/Task";
import type Project from "../types/Project";
import { formatDuration } from "../lib/formatDuration";
import { parseTime, formatEstimate } from "../lib/parseTime";
import { getAccomplishable, type AccomplishableResult } from "../lib/getAccomplishable";
import { calculateDropOrder } from "../lib/calculateDropOrder";
import { PROJECT_COLORS } from "../hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import type { DraggableSyntheticListeners, DraggableAttributes } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

interface TaskManager {
  tasks: Task[];
  getActiveTask: () => Task | undefined;
  getInactiveTasks: () => Task[];
  getTasksByStatus: (status: string) => Task[];
  addTask: (text: string) => void;
  removeTask: (task: Task) => void;
  setNotes: (task: Task, text: string) => void;
  setText: (task: Task, text: string) => void;
  setStatus: (task: Task, status: Task["status"]) => void;
  setProject: (task: Task, projectId: string | undefined) => void;
  setEstimate: (task: Task, estimate: number | undefined) => void;
  reorderTask: (task: Task, direction: "up" | "down") => void;
  moveTask: (task: Task, toStatus: Task["status"], newOrder: number) => void;
}

interface ProjectManager {
  projects: Project[];
  getOrCreateProject: (name: string) => Project;
  getProjectById: (projectId: string) => Project | undefined;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
}

type DroppableStatus = "working" | "ready" | "done";

function TasksView({
  taskManager,
  projectManager,
  selectedTaskId,
  onSelectTask,
}: {
  taskManager: TaskManager;
  projectManager: ProjectManager;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string | null) => void;
}) {
  const [newTask, setNewTask] = useState("");
  const [timeBudgetInput, setTimeBudgetInput] = useState("");
  const [timeBudget, setTimeBudget] = useState<number>(0);
  const [showAccomplishable, setShowAccomplishable] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Configure sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px activation distance prevents click conflicts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 200ms delay prevents scroll conflicts on touch
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Get tasks by status
  const workingTasks = useMemo(
    () => taskManager.getTasksByStatus("working"),
    [taskManager]
  );
  const readyTasks = useMemo(
    () => taskManager.getTasksByStatus("ready"),
    [taskManager]
  );
  const doneTasks = useMemo(
    () => taskManager.getTasksByStatus("done"),
    [taskManager]
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
  const accomplishableMap = useMemo(() => {
    if (!showAccomplishable || timeBudget <= 0) {
      return new Map<string, AccomplishableResult>();
    }
    return getAccomplishable(orderedTasks, timeBudget);
  }, [orderedTasks, timeBudget, showAccomplishable]);

  const exportTasks = () => {
    const lines: string[] = [];
    const statuses: Task["status"][] = ["working", "ready", "done"];

    for (const status of statuses) {
      const tasks = taskManager.getTasksByStatus(status);
      if (tasks.length === 0) continue;

      lines.push(status);
      for (const task of tasks) {
        const project = task.projectId
          ? projectManager.getProjectById(task.projectId)
          : undefined;
        lines.push(`\t${task.text}`);
        if (project) {
          lines.push(`\t\tproject: ${project.name}`);
        }
        if (task.duration > 0) {
          lines.push(`\t\tduration: ${formatDuration(task.duration)}`);
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedTaskId) return;

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

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTask.trim()) {
      taskManager.addTask(newTask.trim());
      setNewTask("");
    }
  };

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
    } else {
      // Dropped on an empty container
      targetStatus = over.id as DroppableStatus;
      dropIndex = 0;
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
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div>
        {/* Time budget controls */}
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
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch
              checked={showAccomplishable}
              onCheckedChange={setShowAccomplishable}
            />
            <span className="text-sm">Show accomplishable</span>
          </label>
        </div>

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
                projectManager={projectManager}
                isSelected={selectedTaskId === task.id}
                onSelect={(id) => onSelectTask(id)}
                accomplishable={accomplishableMap.get(task.id)}
                showAccomplishable={showAccomplishable}
              />
            ))}
          </DroppableList>
        </SortableContext>

        <h3 className="text-lg font-semibold mt-6 mb-2">Ready</h3>
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
                projectManager={projectManager}
                isSelected={selectedTaskId === task.id}
                onSelect={(id) => onSelectTask(id)}
                accomplishable={accomplishableMap.get(task.id)}
                showAccomplishable={showAccomplishable}
              />
            ))}
          </DroppableList>
        </SortableContext>

        <div className="mt-4">
          <form onSubmit={handleAddTask} className="flex gap-2">
            <Input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="New task..."
              className="flex-1"
            />
            <Button type="submit" disabled={newTask.length === 0}>
              Add
            </Button>
          </form>
        </div>

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
                projectManager={projectManager}
                isSelected={selectedTaskId === task.id}
                onSelect={(id) => onSelectTask(id)}
                showAccomplishable={false}
              />
            ))}
          </DroppableList>
        </SortableContext>

        <div className="mt-8">
          <Button variant="outline" onClick={exportTasks}>
            Export to Clipboard
          </Button>
        </div>
        <datalist id="doro-projects">
          {projectManager.projects.map((p) => (
            <option key={p.id} value={p.name} />
          ))}
        </datalist>
      </div>

      <DragOverlay>
        {activeTask ? (
          <TaskItemOverlay
            task={activeTask}
            projectManager={projectManager}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface TaskItemProps {
  task: Task;
  manager: TaskManager;
  projectManager: ProjectManager;
  isSelected: boolean;
  onSelect: (taskId: string) => void;
  accomplishable?: AccomplishableResult;
  showAccomplishable: boolean;
}

// Drag overlay component - simplified preview shown during drag
const TaskItemOverlay = ({
  task,
  projectManager,
}: {
  task: Task;
  projectManager: ProjectManager;
}) => {
  const project = task.projectId
    ? projectManager.getProjectById(task.projectId)
    : undefined;

  return (
    <div className="list-none rounded-md bg-background border border-border shadow-lg p-2 px-3 flex items-center gap-2">
      {/* Placeholder for expand button */}
      <div className="size-6 shrink-0" />
      <div
        className="w-4 h-4 rounded-full border border-muted-foreground shrink-0"
        style={{ backgroundColor: project?.color || "#ccc" }}
      />
      <span className="flex-1">{task.text}</span>
      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded min-w-[3rem] text-center">
        {formatEstimate(task.estimate) || "—"}
      </span>
      <span className="text-muted-foreground text-xs min-w-[50px] text-right">
        {formatDuration(task.duration)}
      </span>
      {/* Placeholder for delete button */}
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
  projectManager,
  isSelected,
  onSelect,
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
  const [projectInput, setProjectInput] = useState("");
  const [estimateInput, setEstimateInput] = useState("");
  const [isEditingEstimate, setIsEditingEstimate] = useState(false);
  const [inlineEstimateInput, setInlineEstimateInput] = useState("");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const project = task.projectId
    ? projectManager.getProjectById(task.projectId)
    : undefined;

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

  const handleEstimateBlur = () => {
    const parsed = parseTime(estimateInput);
    manager.setEstimate(task, parsed ?? undefined);
    setEstimateInput("");
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
      <div
        onClick={handleClick}
        className="cursor-pointer p-2 px-3 flex items-center gap-2"
        {...sortableAttributes}
        {...sortableListeners}
      >
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={toggleExpand}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "opacity-0 group-hover:opacity-100",
            isExpanded && "opacity-100"
          )}
        >
          {isExpanded ? "▼" : "▶"}
        </Button>

        <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
          <PopoverTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-4 h-4 rounded-full border border-muted-foreground cursor-pointer p-0 shrink-0"
              style={{ backgroundColor: project?.color || "#ccc" }}
              title={project?.name || "No project"}
            />
          </PopoverTrigger>
          {project && (
            <PopoverContent className="w-auto p-2" align="start">
              <div className="flex gap-1">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    onClick={(e) => {
                      e.stopPropagation();
                      projectManager.updateProject(project.id, { color: c.hex });
                      setColorPickerOpen(false);
                    }}
                    className={cn(
                      "w-4 h-4 rounded-full cursor-pointer p-0",
                      c.hex === project.color
                        ? "border-2 border-foreground"
                        : "border border-muted-foreground"
                    )}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  />
                ))}
              </div>
            </PopoverContent>
          )}
        </Popover>

        {isEditing ? (
          <Input
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex-1 h-7"
          />
        ) : (
          <span
            onDoubleClick={handleDoubleClick}
            className={cn(
              "flex-1",
              task.status === "done" && "line-through text-muted-foreground"
            )}
          >
            {task.text}
          </span>
        )}

        {/* Inline editable estimate */}
        {isEditingEstimate ? (
          <Input
            value={inlineEstimateInput}
            onChange={(e) => setInlineEstimateInput(e.target.value)}
            onBlur={handleInlineEstimateBlur}
            onKeyDown={handleInlineEstimateKeyDown}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
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

        <span className="text-muted-foreground text-xs min-w-[50px] text-right">
          {formatDuration(task.duration)}
        </span>

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Delete "${task.text}"?`)) {
              manager.removeTask(task);
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100"
        >
          ×
        </Button>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 pl-10">
          <div className="mb-2 flex gap-4">
            <label className="text-xs text-muted-foreground flex items-center gap-2">
              Project:
              <Input
                type="text"
                list="doro-projects"
                value={projectInput}
                placeholder={project?.name || "none"}
                onChange={(e) => setProjectInput(e.target.value)}
                onBlur={() => {
                  if (projectInput.trim()) {
                    const p = projectManager.getOrCreateProject(
                      projectInput.trim()
                    );
                    manager.setProject(task, p.id);
                  }
                  setProjectInput("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (projectInput.trim()) {
                      const p = projectManager.getOrCreateProject(
                        projectInput.trim()
                      );
                      manager.setProject(task, p.id);
                    }
                    setProjectInput("");
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-32 h-7 text-xs"
              />
            </label>
            <label className="text-xs text-muted-foreground flex items-center gap-2">
              Estimate:
              <Input
                type="text"
                value={estimateInput}
                placeholder={formatEstimate(task.estimate) || "e.g., 20m"}
                onChange={(e) => setEstimateInput(e.target.value)}
                onBlur={handleEstimateBlur}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleEstimateBlur();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-24 h-7 text-xs"
              />
            </label>
          </div>
          <Textarea
            value={task.notes}
            onChange={(e) => manager.setNotes(task, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder="Notes..."
            className="min-h-[60px] resize-y"
          />
        </div>
      )}
    </li>
  );
};

export default TasksView;
