import { useMemo, useState } from "react";
import type Task from "../types/Task";
import type { Project, ProjectTask } from "../types/Project";
import type { ProjectManager } from "../hooks/useProjects";
import type { Template } from "../types/Template";
import SubtaskList, { SubtaskCount } from "./SubtaskList";
import LinkedText from "./LinkedText";
import SlashInput from "./SlashInput";
import { findTemplateByCommand, subtasksFromTemplate } from "../lib/templates";
import { useTemplateList } from "../hooks/useTemplates";
import { POINT_OPTIONS, projectProgress } from "../lib/projectsReducer";
import { calculateDropOrder } from "../lib/calculateDropOrder";
import { findDayTask } from "../lib/projectSync";
import { handleLineMoveKeyDown } from "../lib/moveLine";
import { formatDuration } from "../lib/formatDuration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Sun } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
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
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

const stopPointer = (e: React.PointerEvent) => e.stopPropagation();

interface ProjectsPageProps {
  manager: ProjectManager;
  dayTasks: Task[];
  onAssignToday: (project: Project, task: ProjectTask) => void;
  onRemoveFromToday: (dayTask: Task) => void;
}

// Projects and their tasks share one DndContext. A project's task list is
// a droppable keyed by the project id, so the project's own sortable row
// gets a prefixed id to keep the two apart.
const PROJECT_PREFIX = "project:";
const projectSortableId = (projectId: string) => PROJECT_PREFIX + projectId;
const isProjectId = (id: string | number) =>
  String(id).startsWith(PROJECT_PREFIX);

// Dragging a project only considers other project rows; dragging a task
// only the task lists and rows, preferring a task under the pointer so the
// drop lands at a precise position (see TasksView)
const collisionDetection =
  (containerIds: Set<string>): CollisionDetection =>
  (args) => {
    const draggingProject = isProjectId(args.active.id);
    const scoped = {
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (c) => isProjectId(c.id) === draggingProject
      ),
    };
    if (draggingProject) return closestCenter(scoped);
    const pointerCollisions = pointerWithin(scoped);
    const collisions =
      pointerCollisions.length > 0
        ? pointerCollisions
        : rectIntersection(scoped);
    const item = collisions.find((c) => !containerIds.has(String(c.id)));
    return item ? [item] : collisions;
  };

function ProjectsPage({
  manager,
  dayTasks,
  onAssignToday,
  onRemoveFromToday,
}: ProjectsPageProps) {
  const [newProject, setNewProject] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    })
  );

  const containerIds = useMemo(
    () => new Set(manager.projects.map((p) => p.id)),
    [manager.projects]
  );
  const detectCollisions = useMemo(
    () => collisionDetection(containerIds),
    [containerIds]
  );
  const projectSortableIds = useMemo(
    () => manager.projects.map((p) => projectSortableId(p.id)),
    [manager.projects]
  );

  const draggingTask = useMemo(
    () => manager.state.tasks.find((t) => t.id === activeId),
    [manager.state.tasks, activeId]
  );
  const draggingProject = useMemo(
    () =>
      activeId && isProjectId(activeId)
        ? manager.projects.find((p) => projectSortableId(p.id) === activeId)
        : undefined,
    [manager.projects, activeId]
  );

  const handleAddProject = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newProject.trim();
    if (!name) return;
    manager.addProject(name);
    setNewProject("");
  };

  const handleProjectDragEnd = (active: DragEndEvent["active"], over: NonNullable<DragEndEvent["over"]>) => {
    const project = manager.projects.find(
      (p) => projectSortableId(p.id) === active.id
    );
    const overIndex = over.data.current?.sortable?.index;
    if (!project || typeof overIndex !== "number") return;
    const order = calculateDropOrder(manager.projects, overIndex, project.id);
    if (order !== project.order) manager.moveProject(project, order);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    if (isProjectId(active.id)) {
      handleProjectDragEnd(active, over);
      return;
    }
    const task = manager.state.tasks.find((t) => t.id === active.id);
    if (!task) return;

    const overData = over.data.current;
    let projectId: string;
    let dropIndex: number;
    if (overData?.sortable) {
      projectId = String(overData.sortable.containerId);
      dropIndex = overData.sortable.index;
      // Across projects the target list doesn't open a gap, so the lower
      // half of the hovered task means "after it"
      if (task.projectId !== projectId) {
        const rect = active.rect.current.translated;
        if (rect) {
          const activeMiddle = rect.top + rect.height / 2;
          const overMiddle = over.rect.top + over.rect.height / 2;
          if (activeMiddle > overMiddle) dropIndex += 1;
        }
      }
    } else {
      projectId = String(over.id);
      dropIndex = Number.MAX_SAFE_INTEGER;
    }
    if (!containerIds.has(projectId)) return;

    const order = calculateDropOrder(
      manager.tasksFor(projectId),
      dropIndex,
      task.id
    );
    if (task.projectId !== projectId || task.order !== order) {
      manager.moveTask(task, projectId, order);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={detectCollisions}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="space-y-4">
        {manager.projects.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-lg">
            No projects yet. Add one below to start planning beyond today.
          </p>
        )}
        <SortableContext
          items={projectSortableIds}
          strategy={verticalListSortingStrategy}
        >
          {manager.projects.map((project) => (
            <ProjectSection
              key={project.id}
              project={project}
              tasks={manager.tasksFor(project.id)}
              manager={manager}
              dayTasks={dayTasks}
              onAssignToday={onAssignToday}
              onRemoveFromToday={onRemoveFromToday}
            />
          ))}
        </SortableContext>
        <form onSubmit={handleAddProject} className="flex gap-2 pt-2">
          <Input
            value={newProject}
            onChange={(e) => setNewProject(e.target.value)}
            placeholder="New project..."
            className="flex-1"
            aria-label="New project name"
          />
          <Button type="submit" disabled={!newProject.trim()}>
            Add Project
          </Button>
        </form>
      </div>
      <DragOverlay>
        {draggingTask ? (
          <ProjectTaskOverlay task={draggingTask} />
        ) : draggingProject ? (
          <ProjectOverlay
            project={draggingProject}
            tasks={manager.tasksFor(draggingProject.id)}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const fraction = total > 0 ? Math.min(done / total, 1) : 0;
  return (
    <div
      className="relative h-1.5 rounded-full bg-muted overflow-hidden"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-label={`${done} of ${total} points done`}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-[width]"
        style={{
          width: `${fraction * 100}%`,
          backgroundColor:
            "color-mix(in srgb, #4ade80 var(--goal-fill-strength, 100%), transparent)",
        }}
      />
    </div>
  );
}

// Header block shared by the live section and its drag overlay
function ProjectHeader({
  project,
  progress,
  todayCount = 0,
  name,
  actions,
  collapseButton,
}: {
  project: Project;
  progress: { done: number; total: number };
  // How many of the project's tasks are on today's list (timer view)
  todayCount?: number;
  name?: React.ReactNode;
  actions?: React.ReactNode;
  collapseButton?: React.ReactNode;
}) {
  return (
    <div className="px-3 pt-2 pb-2.5 space-y-1.5">
      <div className="flex items-center gap-2 min-w-0">
        {collapseButton ?? <div className="size-6 shrink-0" />}
        {name ?? <h3 className="font-semibold truncate flex-1">{project.name}</h3>}
        {todayCount > 0 && (
          <span
            className="inline-flex items-center gap-0.5 text-xs text-amber-500 tabular-nums whitespace-nowrap"
            data-testid="project-today-count"
            title={`${todayCount} task${todayCount === 1 ? "" : "s"} on today's list`}
            aria-label={`${todayCount} task${todayCount === 1 ? "" : "s"} on today's list`}
          >
            <Sun className="size-3.5" aria-hidden="true" />
            {todayCount}
          </span>
        )}
        <span
          className="text-xs text-muted-foreground tabular-nums whitespace-nowrap"
          data-testid="project-progress"
          title="Story points done / total"
        >
          {progress.done}/{progress.total}
        </span>
        {actions}
      </div>
      <ProgressBar done={progress.done} total={progress.total} />
    </div>
  );
}

const ProjectOverlay = ({
  project,
  tasks,
}: {
  project: Project;
  tasks: ProjectTask[];
}) => (
  <div className="rounded-lg border bg-background shadow-lg">
    <ProjectHeader project={project} progress={projectProgress(tasks)} />
  </div>
);

function ProjectSection({
  project,
  tasks,
  manager,
  dayTasks,
  onAssignToday,
  onRemoveFromToday,
}: {
  project: Project;
  tasks: ProjectTask[];
  manager: ProjectManager;
  dayTasks: Task[];
  onAssignToday: (project: Project, task: ProjectTask) => void;
  onRemoveFromToday: (dayTask: Task) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [newTask, setNewTask] = useState("");
  const templates = useTemplateList();
  const { setNodeRef, isOver } = useDroppable({ id: project.id });
  const {
    attributes: sortableAttributes,
    listeners: sortableListeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: projectSortableId(project.id) });
  const progress = projectProgress(tasks);
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);
  const todayCount = useMemo(
    () => tasks.filter((t) => findDayTask(dayTasks, t.id)).length,
    [tasks, dayTasks]
  );

  const saveName = () => {
    const name = editName.trim();
    if (name && name !== project.name) manager.renameProject(project, name);
    setIsEditing(false);
  };

  // A template makes a task named after it, with its steps as subtasks
  const addFromTemplate = (template: Template) => {
    manager.addTask(project, template.name, subtasksFromTemplate(template));
    setNewTask("");
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newTask.trim();
    if (!text) return;
    const template = findTemplateByCommand(templates, text);
    if (template) {
      addFromTemplate(template);
      return;
    }
    manager.addTask(project, text);
    setNewTask("");
  };

  const collapseButton = (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={() => manager.setCollapsed(project, !project.collapsed)}
      onPointerDown={stopPointer}
      aria-expanded={!project.collapsed}
      aria-label={project.collapsed ? "Expand project" : "Collapse project"}
    >
      {project.collapsed ? <ChevronRight /> : <ChevronDown />}
    </Button>
  );

  const name = isEditing ? (
    <Input
      value={editName}
      onChange={(e) => setEditName(e.target.value)}
      onBlur={saveName}
      onKeyDown={(e) => {
        if (e.key === "Enter") saveName();
        if (e.key === "Escape") {
          setEditName(project.name);
          setIsEditing(false);
        }
      }}
      autoFocus
      onPointerDown={stopPointer}
      className="h-7 font-semibold flex-1"
      aria-label="Project name"
    />
  ) : (
    <h3
      className="font-semibold cursor-text truncate flex-1"
      onDoubleClick={() => {
        setEditName(project.name);
        setIsEditing(true);
      }}
      title="Double-click to rename, drag to reorder"
    >
      {project.name}
    </h3>
  );

  const actions = (
    <Button
      variant="ghost"
      size="icon-xs"
      className="opacity-0 group-hover/project:opacity-100 focus-visible:opacity-100"
      onPointerDown={stopPointer}
      onClick={() => {
        const count = tasks.length;
        const detail = count
          ? ` and its ${count} task${count === 1 ? "" : "s"}`
          : "";
        if (window.confirm(`Delete project "${project.name}"${detail}?`)) {
          manager.removeProject(project);
        }
      }}
      aria-label={`Delete project ${project.name}`}
    >
      ×
    </Button>
  );

  return (
    <section
      ref={setSortableRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("rounded-lg border bg-background", isDragging && "opacity-50")}
      data-testid="project"
      aria-label={project.name}
    >
      {/* The header is the drag handle for reordering projects */}
      <div
        className="group/project cursor-grab active:cursor-grabbing"
        {...sortableAttributes}
        {...sortableListeners}
      >
        <ProjectHeader
          project={project}
          progress={progress}
          todayCount={todayCount}
          name={name}
          actions={actions}
          collapseButton={collapseButton}
        />
      </div>
      {!project.collapsed && (
        <div className="px-2 pb-2">
          <SortableContext
            id={project.id}
            items={taskIds}
            strategy={verticalListSortingStrategy}
          >
            <ul
              ref={setNodeRef}
              className={cn(
                "space-y-1 p-0 min-h-[24px] rounded-md transition-colors",
                isOver && "bg-muted/50"
              )}
            >
              {tasks.map((task) => (
                <SortableProjectTaskItem
                  key={task.id}
                  task={task}
                  project={project}
                  manager={manager}
                  dayTask={findDayTask(dayTasks, task.id)}
                  onAssignToday={onAssignToday}
                  onRemoveFromToday={onRemoveFromToday}
                />
              ))}
            </ul>
          </SortableContext>
          <form onSubmit={handleAddTask} className="flex gap-2 mt-2 pl-8">
            <SlashInput
              value={newTask}
              onChange={setNewTask}
              onTemplate={addFromTemplate}
              hint="adds a task with its subtasks"
              placeholder="New task... (/ for a template)"
              wrapperClassName="flex-1"
              className="h-8"
              aria-label={`New task in ${project.name}`}
            />
            <Button type="submit" size="sm" disabled={!newTask.trim()}>
              Add
            </Button>
          </form>
        </div>
      )}
    </section>
  );
}

const ProjectTaskOverlay = ({ task }: { task: ProjectTask }) => (
  <div className="list-none rounded-md bg-background border border-border shadow-lg p-2 px-3 flex items-center gap-2">
    <div className="size-6 shrink-0" />
    <span className={cn("flex-1", task.done && "line-through text-muted-foreground")}>
      <LinkedText text={task.text} />
    </span>
    <PointsBadge points={task.points} />
  </div>
);

const PointsBadge = ({ points }: { points?: number }) => (
  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded min-w-[2rem] text-center">
    {points ?? "—"}
  </span>
);

interface ProjectTaskItemProps {
  task: ProjectTask;
  project: Project;
  manager: ProjectManager;
  dayTask: Task | undefined;
  onAssignToday: (project: Project, task: ProjectTask) => void;
  onRemoveFromToday: (dayTask: Task) => void;
}

const SortableProjectTaskItem = (props: ProjectTaskItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.task.id });
  return (
    <ProjectTaskItem
      {...props}
      sortableRef={setNodeRef}
      sortableStyle={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      sortableAttributes={attributes}
      sortableListeners={listeners}
      isDragging={isDragging}
    />
  );
};

const ProjectTaskItem = ({
  task,
  project,
  manager,
  dayTask,
  onAssignToday,
  onRemoveFromToday,
  sortableRef,
  sortableStyle,
  sortableAttributes,
  sortableListeners,
  isDragging,
}: ProjectTaskItemProps & {
  sortableRef?: (node: HTMLElement | null) => void;
  sortableStyle?: React.CSSProperties;
  sortableAttributes?: DraggableAttributes;
  sortableListeners?: DraggableSyntheticListeners;
  isDragging?: boolean;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const [isExpanded, setIsExpanded] = useState(false);
  const [pointsOpen, setPointsOpen] = useState(false);

  const save = () => {
    const text = editText.trim();
    if (text && text !== task.text) manager.setTaskText(task, text);
    setIsEditing(false);
  };

  return (
    <li
      ref={sortableRef}
      style={sortableStyle}
      className={cn(
        "list-none rounded-md group/task",
        isDragging && "opacity-50",
        task.done && "opacity-60"
      )}
      data-testid="project-task"
    >
      <div
        className="p-1 px-2 flex items-center gap-2"
        {...sortableAttributes}
        {...sortableListeners}
      >
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setIsExpanded((v) => !v)}
          onPointerDown={stopPointer}
          className={cn(
            "opacity-0 group-hover/task:opacity-100 focus-visible:opacity-100",
            isExpanded && "opacity-100"
          )}
          aria-label={isExpanded ? "Hide details" : "Show details"}
          aria-expanded={isExpanded}
        >
          {isExpanded ? "▼" : "▶"}
        </Button>
        <input
          type="checkbox"
          checked={task.done}
          onChange={(e) => manager.setTaskDone(task, e.target.checked)}
          onPointerDown={stopPointer}
          className="size-4 accent-green-500 cursor-pointer shrink-0"
          aria-label={task.done ? "Mark not done" : "Mark done"}
        />
        {isEditing ? (
          <Input
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") {
                setEditText(task.text);
                setIsEditing(false);
              }
            }}
            autoFocus
            onPointerDown={stopPointer}
            className="flex-1 h-7"
            aria-label="Task text"
          />
        ) : (
          <span
            onDoubleClick={() => {
              setEditText(task.text);
              setIsEditing(true);
            }}
            className={cn(
              "flex-1 cursor-default",
              task.done && "line-through text-muted-foreground"
            )}
            title="Double-click to rename"
          >
            <LinkedText text={task.text} />
          </span>
        )}
        <SubtaskCount subtasks={task.subtasks} />
        {dayTask && dayTask.duration >= 1000 && (
          <span
            className="text-xs text-muted-foreground"
            title="Time worked today"
          >
            {formatDuration(dayTask.duration)}
          </span>
        )}
        <Popover open={pointsOpen} onOpenChange={setPointsOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              onPointerDown={stopPointer}
              className="cursor-pointer"
              title="Story points"
              aria-label={`Points: ${task.points ?? "none"}. Click to change`}
            >
              <PointsBadge points={task.points} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="end">
            <div className="flex gap-1">
              {POINT_OPTIONS.map((p) => (
                <Button
                  key={p}
                  variant={task.points === p ? "default" : "outline"}
                  size="icon-sm"
                  onClick={() => {
                    manager.setTaskPoints(task, p);
                    setPointsOpen(false);
                  }}
                >
                  {p}
                </Button>
              ))}
              <Button
                variant={task.points === undefined ? "default" : "outline"}
                size="icon-sm"
                onClick={() => {
                  manager.setTaskPoints(task, undefined);
                  setPointsOpen(false);
                }}
                aria-label="No points"
              >
                —
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <Button
          variant={dayTask ? "default" : "ghost"}
          size="icon-xs"
          onPointerDown={stopPointer}
          onClick={() =>
            dayTask ? onRemoveFromToday(dayTask) : onAssignToday(project, task)
          }
          className={cn(
            !dayTask &&
              "opacity-0 group-hover/task:opacity-100 focus-visible:opacity-100 text-muted-foreground"
          )}
          title={
            dayTask
              ? "On today's list — click to take it off"
              : "Add to today's list"
          }
          aria-pressed={!!dayTask}
          aria-label={dayTask ? "Remove from today" : "Add to today"}
        >
          <Sun className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onPointerDown={stopPointer}
          onClick={() => {
            if (window.confirm(`Delete "${task.text}"?`)) manager.removeTask(task);
          }}
          className="opacity-0 group-hover/task:opacity-100 focus-visible:opacity-100"
          aria-label={`Delete ${task.text}`}
        >
          ×
        </Button>
      </div>
      {isExpanded && (
        <div className="px-2 pb-2 pl-14 space-y-2">
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
            onChange={(e) => manager.setTaskNotes(task, e.target.value)}
            onKeyDown={(e) => {
              const moved = handleLineMoveKeyDown(e);
              if (moved !== null) manager.setTaskNotes(task, moved);
            }}
            onPointerDown={stopPointer}
            placeholder="Notes..."
            className="min-h-[60px] resize-y"
            aria-label="Task notes"
          />
        </div>
      )}
    </li>
  );
};

export default ProjectsPage;
