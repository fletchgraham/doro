import { useMemo, useState } from "react";
import type { Template } from "../types/Template";
import type { TemplateManager } from "../hooks/useTemplates";
import { templateSteps } from "../lib/templates";
import { handleLineMoveKeyDown } from "../lib/moveLine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Templates are named checklists, edited as one subtask per line. They
// apply anywhere a task or subtask is typed, via "/name".

const stopPointer = (e: React.PointerEvent) => e.stopPropagation();

function TemplatesPage({ manager }: { manager: TemplateManager }) {
  const [newName, setNewName] = useState("");
  const ids = useMemo(
    () => manager.templates.map((t) => t.id),
    [manager.templates]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    })
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const template = manager.templates.find((t) => t.id === active.id);
    const index = manager.templates.findIndex((t) => t.id === over.id);
    if (template && index !== -1) manager.moveTemplate(template, index);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    manager.addTemplate(name);
    setNewName("");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        A template is a named list of subtasks. Type <kbd className="px-1 rounded bg-muted font-mono">/</kbd>{" "}
        in any task or subtask box to pick one: on a subtask it adds the
        steps, on a task it adds a task with those steps.
      </p>
      {manager.templates.length === 0 && (
        <p className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-lg">
          No templates yet. Add one below.
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {manager.templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              manager={manager}
            />
          ))}
        </SortableContext>
      </DndContext>
      <form onSubmit={handleAdd} className="flex gap-2 pt-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New template..."
          className="flex-1"
          aria-label="New template name"
        />
        <Button type="submit" disabled={!newName.trim()}>
          Add Template
        </Button>
      </form>
    </div>
  );
}

function TemplateCard({
  template,
  manager,
}: {
  template: Template;
  manager: TemplateManager;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(template.name);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: template.id });
  const stepCount = templateSteps(template).length;

  const saveName = () => {
    const name = editName.trim();
    if (name && name !== template.name) manager.renameTemplate(template, name);
    setIsEditing(false);
  };

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("rounded-lg border bg-background", isDragging && "opacity-50")}
      data-testid="template"
      aria-label={template.name}
    >
      {/* The header is the drag handle for reordering templates */}
      <div
        className="group/template flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <span className="text-muted-foreground font-mono text-sm shrink-0">/</span>
        {isEditing ? (
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveName();
              if (e.key === "Escape") {
                setEditName(template.name);
                setIsEditing(false);
              }
            }}
            autoFocus
            onPointerDown={stopPointer}
            className="h-7 font-semibold flex-1"
            aria-label="Template name"
          />
        ) : (
          <h3
            className="font-semibold cursor-text truncate flex-1"
            onDoubleClick={() => {
              setEditName(template.name);
              setIsEditing(true);
            }}
            title="Double-click to rename, drag to reorder"
          >
            {template.name}
          </h3>
        )}
        <span
          className="text-xs text-muted-foreground tabular-nums whitespace-nowrap"
          data-testid="template-step-count"
        >
          {stepCount} subtask{stepCount === 1 ? "" : "s"}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          className="opacity-0 group-hover/template:opacity-100 focus-visible:opacity-100"
          onPointerDown={stopPointer}
          onClick={() => {
            if (window.confirm(`Delete template "${template.name}"?`)) {
              manager.removeTemplate(template);
            }
          }}
          aria-label={`Delete template ${template.name}`}
        >
          ×
        </Button>
      </div>
      <div className="px-3 pb-3">
        <Textarea
          value={template.steps.join("\n")}
          onChange={(e) => manager.setSteps(template, e.target.value.split("\n"))}
          onKeyDown={(e) => {
            const moved = handleLineMoveKeyDown(e);
            if (moved !== null) manager.setSteps(template, moved.split("\n"));
          }}
          onPointerDown={stopPointer}
          placeholder={"One subtask per line...\nAlt+↑/↓ moves a line"}
          className="min-h-[80px] resize-y font-mono text-sm"
          aria-label={`Subtasks for ${template.name}`}
          data-testid="template-steps"
        />
      </div>
    </section>
  );
}

export default TemplatesPage;
