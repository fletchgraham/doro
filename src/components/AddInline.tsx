import { useState } from "react";
import type { Template } from "../types/Template";
import { findTemplateByCommand } from "../lib/templates";
import { useTemplateList } from "../hooks/useTemplates";
import SlashInput from "./SlashInput";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

// The + under the last item of a list. Clicking it opens an add box in
// its place; Enter adds and keeps the box open for the next one, Escape
// or clicking away from an empty box puts the + back. Typing "/" offers
// the templates, as everywhere else.

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

function AddInline({
  onAdd,
  onTemplate,
  hint,
  placeholder,
  buttonLabel,
  inputLabel,
  size = "default",
  className,
}: {
  onAdd: (text: string) => void;
  onTemplate: (template: Template) => void;
  // What picking a template does, shown in the slash menu
  hint: string;
  placeholder: string;
  // Accessible names for the + and the box it opens
  buttonLabel: string;
  inputLabel: string;
  // "sm" for checklists
  size?: "default" | "sm";
  className?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const templates = useTemplateList();

  const close = () => {
    setAdding(false);
    setText("");
  };

  const pickTemplate = (template: Template) => {
    onTemplate(template);
    setText("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    const template = findTemplateByCommand(templates, value);
    if (template) {
      pickTemplate(template);
      return;
    }
    onAdd(value);
    setText("");
  };

  if (!adding) {
    return (
      <div className={className} onClick={stop} onPointerDown={stop}>
        <Button
          variant="ghost"
          size={size === "sm" ? "icon-xs" : "icon-sm"}
          onClick={() => setAdding(true)}
          className="text-muted-foreground"
          aria-label={buttonLabel}
          title={buttonLabel}
        >
          <Plus />
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={className}
      onClick={stop}
      onPointerDown={stop}
    >
      <SlashInput
        value={text}
        onChange={setText}
        onTemplate={pickTemplate}
        hint={hint}
        placeholder={placeholder}
        aria-label={inputLabel}
        enterKeyHint="done"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
        }}
        onBlur={() => {
          if (!text.trim()) close();
        }}
        className={cn(size === "sm" ? "h-7 text-sm" : "h-8")}
      />
    </form>
  );
}

export default AddInline;
