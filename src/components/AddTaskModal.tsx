import { useState, useEffect, useRef } from "react";
import type Task from "../types/Task";
import { parseTime, formatEstimate } from "../lib/parseTime";
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

const DEFAULT_ESTIMATE = 20 * 60 * 1000; // 20 minutes

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (
    text: string,
    status: Task["status"],
    position: "top" | "bottom",
    estimate?: number
  ) => void;
}

function AddTaskModal({ isOpen, onClose, onAdd }: AddTaskModalProps) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Task["status"]>("ready");
  const [position, setPosition] = useState<"top" | "bottom">("bottom");
  const [estimateInput, setEstimateInput] = useState(formatEstimate(DEFAULT_ESTIMATE) || "");
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
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      const estimate = parseTime(estimateInput) ?? undefined;
      onAdd(text.trim(), status, position, estimate);
      handleClose();
    }
  };

  const statuses: Task["status"][] = ["active", "working", "ready", "backlog"];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Task description..."
          />

          <div className="flex items-center gap-4">
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
