import { useId, useState } from "react";
import type { Template } from "../types/Template";
import { useTemplateList } from "../hooks/useTemplates";
import { matchTemplates, parseSlashQuery, templateSteps } from "../lib/templates";
import { routeHash } from "../hooks/useHashRoute";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ListChecks } from "lucide-react";

// A text box that offers the templates as slash commands: typing "/"
// opens a menu of them, narrowed by what follows, and Enter, Tab or a
// click picks one. The caller decides what picking means (add the
// steps as subtasks, or create a task with them). Any other key leaves
// the box behaving like a plain input, so its form still submits.

export interface SlashInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
  onTemplate: (template: Template) => void;
  // What picking a template does, shown in the menu's footer
  hint: string;
  wrapperClassName?: string;
}

function SlashInput({
  value,
  onChange,
  onTemplate,
  hint,
  wrapperClassName,
  className,
  onKeyDown,
  onFocus,
  onBlur,
  ...inputProps
}: SlashInputProps) {
  const templates = useTemplateList();
  const id = useId();
  const [highlight, setHighlight] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [focused, setFocused] = useState(false);

  const query = parseSlashQuery(value);
  const matches = query === null ? [] : matchTemplates(templates, query);
  const open = focused && query !== null && !dismissed;
  const active = Math.min(highlight, Math.max(matches.length - 1, 0));
  const optionId = (index: number) => `${id}-option-${index}`;

  const pick = (template: Template) => {
    setDismissed(true);
    onTemplate(template);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (open) {
      if (e.key === "ArrowDown" && matches.length > 0) {
        e.preventDefault();
        setHighlight((active + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp" && matches.length > 0) {
        e.preventDefault();
        setHighlight((active - 1 + matches.length) % matches.length);
        return;
      }
      if ((e.key === "Enter" || e.key === "Tab") && matches.length > 0) {
        e.preventDefault();
        pick(matches[active]);
        return;
      }
      if (e.key === "Escape") {
        // Only the menu closes, not a dialog the box might be in
        e.preventDefault();
        e.stopPropagation();
        setDismissed(true);
        return;
      }
    }
    onKeyDown?.(e);
  };

  return (
    <div className={cn("relative min-w-0", wrapperClassName)}>
      <Input
        {...inputProps}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setDismissed(false);
          setHighlight(0);
        }}
        onKeyDown={handleKeyDown}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        className={className}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? `${id}-listbox` : undefined}
        aria-activedescendant={
          open && matches.length > 0 ? optionId(active) : undefined
        }
        aria-autocomplete="list"
        autoComplete="off"
      />
      {open && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover text-popover-foreground shadow-md text-sm overflow-hidden"
          data-testid="slash-menu"
          // Keep focus in the input while clicking an option
          onMouseDown={(e) => e.preventDefault()}
        >
          {matches.length > 0 ? (
            <ul id={`${id}-listbox`} role="listbox" className="p-1 max-h-60 overflow-y-auto">
              {matches.map((template, index) => {
                const steps = templateSteps(template);
                return (
                  <li
                    key={template.id}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === active}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => pick(template)}
                    className={cn(
                      "flex items-center gap-2 rounded-sm px-2 py-1.5 cursor-pointer",
                      index === active && "bg-accent text-accent-foreground"
                    )}
                  >
                    <ListChecks
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="flex-1 truncate">{template.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {steps.length} subtask{steps.length === 1 ? "" : "s"}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-3 py-2 text-muted-foreground">
              {templates.length === 0 ? (
                <>
                  No templates yet. Make one on the{" "}
                  <a
                    href={routeHash.templates}
                    className="underline underline-offset-2"
                  >
                    Templates page
                  </a>
                  .
                </>
              ) : (
                "No matching templates."
              )}
            </p>
          )}
          <p className="border-t px-3 py-1 text-xs text-muted-foreground">
            {matches.length > 0 ? `Enter ${hint}` : "Esc to dismiss"}
          </p>
        </div>
      )}
    </div>
  );
}

export default SlashInput;
