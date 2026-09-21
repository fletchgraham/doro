import { useState } from "react";
import type Task from "../types/Task";
import type Subtask from "../types/Subtask";
import type { Template } from "../types/Template";
import {
  matchTemplates,
  parseSlashQuery,
  subtasksFromTemplate,
  templateSteps,
} from "../lib/templates";
import { useTemplateList } from "../hooks/useTemplates";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { ListChecks } from "lucide-react";

interface SwitchTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  onSwitch: (task: Task) => void;
  onCreate: (text: string, subtasks?: Subtask[]) => void;
}

function SwitchTaskModal({
  isOpen,
  onClose,
  tasks,
  onSwitch,
  onCreate,
}: SwitchTaskModalProps) {
  const [query, setQuery] = useState("");
  const templates = useTemplateList();

  // "/name" offers the templates instead: starting one makes a task
  // named after it, with its steps as subtasks
  const slashQuery = parseSlashQuery(query);
  const matchingTemplates =
    slashQuery === null ? [] : matchTemplates(templates, slashQuery);

  // Filter to incomplete tasks that match query
  const incompleteTasks = tasks.filter(
    (t) => t.status !== "done" && t.status !== "active"
  );

  const filteredTasks = query.trim()
    ? incompleteTasks.filter((t) =>
        t.text.toLowerCase().includes(query.toLowerCase())
      )
    : incompleteTasks;

  const handleClose = () => {
    setQuery("");
    onClose();
  };

  const handleTaskSelect = (task: Task) => {
    onSwitch(task);
    handleClose();
  };

  const handleCreate = () => {
    if (query.trim()) {
      onCreate(query.trim());
      handleClose();
    }
  };

  const handleTemplate = (template: Template) => {
    onCreate(template.name, subtasksFromTemplate(template));
    handleClose();
  };

  const hasMatches = filteredTasks.length > 0 || matchingTemplates.length > 0;
  const showCreateOption = query.trim() && !hasMatches;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="p-0 sm:max-w-md overflow-hidden">
        <Command shouldFilter={false} className="rounded-lg">
          <CommandInput
            placeholder="Search tasks..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {matchingTemplates.map((template) => {
              const count = templateSteps(template).length;
              return (
                <CommandItem
                  key={`template:${template.id}`}
                  value={`template:${template.id}`}
                  onSelect={() => handleTemplate(template)}
                  className="flex justify-between items-center cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <ListChecks className="size-4" aria-hidden="true" />
                    Start "{template.name}"
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {count} subtask{count === 1 ? "" : "s"}
                  </Badge>
                </CommandItem>
              );
            })}
            {filteredTasks.map((task) => (
              <CommandItem
                key={task.id}
                value={task.id}
                onSelect={() => handleTaskSelect(task)}
                className="flex justify-between items-center cursor-pointer"
              >
                <span>{task.text}</span>
                <Badge variant="secondary" className="text-xs">
                  {task.status}
                </Badge>
              </CommandItem>
            ))}

            {showCreateOption && (
              <CommandItem onSelect={handleCreate} className="cursor-pointer">
                Press Enter to create "{query}" and start
              </CommandItem>
            )}

            {!query.trim() && filteredTasks.length === 0 && (
              <CommandEmpty>No incomplete tasks</CommandEmpty>
            )}
            {slashQuery !== null && !hasMatches && templates.length === 0 && (
              <CommandEmpty>No templates yet</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

export default SwitchTaskModal;
