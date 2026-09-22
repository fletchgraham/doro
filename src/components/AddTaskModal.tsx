import { useState, useEffect, useRef } from "react";
import type Task from "../types/Task";
import type Subtask from "../types/Subtask";
import type { Template } from "../types/Template";
import { parseTime, formatEstimate } from "../lib/parseTime";
import {
  findTemplateByCommand,
  parseSlashQuery,
  subtasksFromTemplate,
  templateSteps,
} from "../lib/templates";
import { useTemplateList } from "../hooks/useTemplates";
import SlashInput from "./SlashInput";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ListChecks } from "lucide-react";

const DEFAULT_ESTIMATE = 20 * 60 * 1000; // 20 minutes

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (
    text: string,
    status: Task["status"],
    position: "top" | "bottom",
    estimate?: number,
    subtasks?: Subtask[]
  ) => void;
}

function AddTaskModal({ isOpen, onClose, onAdd }: AddTaskModalProps) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Task["status"]>("ready");
  const [position, setPosition] = useState<"top" | "bottom">("bottom");
  const [estimateInput, setEstimateInput] = useState(formatEstimate(DEFAULT_ESTIMATE) || "");
  // Picked from the slash menu: its steps ride along as subtasks, while
  // the name stays editable so the task can be called something else
  const [template, setTemplate] = useState<Template | null>(null);
  const templates = useTemplateList();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  const handleClose = () => {
    setText("");
    setStatus("ready");
    setPosition("bottom");
    setEstimateInput(formatEstimate(DEFAULT_ESTIMATE) || "");
    setTemplate(null);
    onClose();
  };

  const pickTemplate = (picked: Template) => {
    setTemplate(picked);
    setText(picked.name);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    // "/name" typed straight in, without picking from the menu
    const chosen = template ?? findTemplateByCommand(templates, trimmed);
    const name =
      chosen && parseSlashQuery(trimmed) !== null ? chosen.name : trimmed;
    const estimate = parseTime(estimateInput) ?? undefined;
    onAdd(
      name,
      status,
      position,
      estimate,
      chosen ? subtasksFromTemplate(chosen) : undefined
    );
    handleClose();
  };

  const statuses: Task["status"][] = ["active", "working", "ready"];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <SlashInput
            ref={inputRef}
            type="text"
            value={text}
            onChange={setText}
            onTemplate={pickTemplate}
            hint="names the task and attaches its subtasks"
            placeholder="Task description... (/ for a template)"
          />
          {template && (
            <div
              className="flex items-center gap-2 text-sm text-muted-foreground"
              data-testid="add-task-template"
            >
              <ListChecks className="size-4 shrink-0" aria-hidden="true" />
              <span className="flex-1 truncate">
                {templateSteps(template).length} subtask
                {templateSteps(template).length === 1 ? "" : "s"} from "
                {template.name}"
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setTemplate(null)}
                aria-label="Remove template"
              >
                ×
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as Task["status"])}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Estimate:</span>
              <Input
                type="text"
                value={estimateInput}
                onChange={(e) => setEstimateInput(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="20m"
                className="w-20"
              />
            </div>
          </div>

          <div className="flex justify-between items-center">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setPosition(position === "top" ? "bottom" : "top")}
              title={position === "top" ? "Add to top" : "Add to bottom"}
            >
              {position === "top" ? "↑" : "↓"}
            </Button>

            <Button type="submit" disabled={!text.trim()}>
              Add
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AddTaskModal;
