import type { Template, TemplatesState } from "../types/Template";
import type Subtask from "../types/Subtask";
import { createSubtask } from "./subtasks";

// Templates are named checklists. Typing "/" in an add-task or add-subtask
// box brings them up; picking one (or submitting "/name") adds its steps
// as subtasks — on the task being edited, or on a new task named after
// the template.

export type TemplatesAction =
  | { type: "ADD_TEMPLATE"; name: string; steps?: string[] }
  | { type: "RENAME_TEMPLATE"; templateId: string; name: string }
  | { type: "SET_TEMPLATE_STEPS"; templateId: string; steps: string[] }
  | { type: "MOVE_TEMPLATE"; templateId: string; index: number }
  | { type: "REMOVE_TEMPLATE"; templateId: string };

export const EMPTY_TEMPLATES: TemplatesState = { templates: [] };

export const createTemplate = (name: string, steps: string[] = []): Template => ({
  id: crypto.randomUUID(),
  name,
  steps,
});

/** The steps that would actually be added: trimmed, blank lines dropped. */
export const templateSteps = (template: Template): string[] =>
  template.steps.map((s) => s.trim()).filter(Boolean);

/** Fresh, unticked subtasks for a template's steps, in order. */
export const subtasksFromTemplate = (template: Template): Subtask[] =>
  templateSteps(template).map(createSubtask);

/**
 * The text after a leading slash, or null when the text isn't a slash
 * command. Leading whitespace before the slash is tolerated.
 */
export const parseSlashQuery = (text: string): string | null => {
  const trimmed = text.trimStart();
  return trimmed.startsWith("/") ? trimmed.slice(1) : null;
};

const normalize = (s: string) => s.trim().toLowerCase();

/**
 * Templates matching a slash query, for the autocomplete: names that
 * start with the query come first, then names containing it. An empty
 * query lists everything.
 */
export const matchTemplates = (
  templates: Template[],
  query: string
): Template[] => {
  const q = normalize(query);
  if (!q) return templates;
  const starts: Template[] = [];
  const contains: Template[] = [];
  for (const template of templates) {
    const name = normalize(template.name);
    if (name.startsWith(q)) starts.push(template);
    else if (name.includes(q)) contains.push(template);
  }
  return [...starts, ...contains];
};

/**
 * The template a submitted "/name" refers to, or null. An exact name
 * (case-insensitive) wins; otherwise a single autocomplete match is
 * taken so "/rel" + Enter works when only "Release" fits.
 */
export const findTemplateByCommand = (
  templates: Template[],
  text: string
): Template | null => {
  const query = parseSlashQuery(text);
  if (query === null) return null;
  const q = normalize(query);
  if (!q) return null;
  const exact = templates.find((t) => normalize(t.name) === q);
  if (exact) return exact;
  const matches = matchTemplates(templates, q);
  return matches.length === 1 ? matches[0] : null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Parse the persisted store, dropping anything malformed. */
export const loadTemplatesState = (raw: string | null): TemplatesState => {
  if (!raw) return EMPTY_TEMPLATES;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.templates)) {
      return EMPTY_TEMPLATES;
    }
    const seen = new Set<string>();
    const templates: Template[] = [];
    for (const item of parsed.templates) {
      if (
        !isRecord(item) ||
        typeof item.id !== "string" ||
        typeof item.name !== "string" ||
        seen.has(item.id)
      ) {
        continue;
      }
      seen.add(item.id);
      templates.push({
        id: item.id,
        name: item.name,
        steps: Array.isArray(item.steps)
          ? item.steps.filter((s): s is string => typeof s === "string")
          : [],
      });
    }
    return { templates };
  } catch {
    return EMPTY_TEMPLATES;
  }
};

const updateTemplate = (
  state: TemplatesState,
  templateId: string,
  patch: Partial<Template>
): TemplatesState => ({
  templates: state.templates.map((t) =>
    t.id === templateId ? { ...t, ...patch } : t
  ),
});

const templatesReducer = (
  state: TemplatesState,
  action: TemplatesAction
): TemplatesState => {
  switch (action.type) {
    case "ADD_TEMPLATE": {
      const name = action.name.trim();
      if (!name) return state;
      return {
        templates: [...state.templates, createTemplate(name, action.steps ?? [])],
      };
    }
    case "RENAME_TEMPLATE": {
      const name = action.name.trim();
      if (!name) return state;
      return updateTemplate(state, action.templateId, { name });
    }
    case "SET_TEMPLATE_STEPS":
      return updateTemplate(state, action.templateId, { steps: action.steps });
    case "MOVE_TEMPLATE": {
      const from = state.templates.findIndex((t) => t.id === action.templateId);
      if (from === -1) return state;
      const to = Math.max(0, Math.min(action.index, state.templates.length - 1));
      if (from === to) return state;
      const templates = [...state.templates];
      const [moved] = templates.splice(from, 1);
      templates.splice(to, 0, moved);
      return { templates };
    }
    case "REMOVE_TEMPLATE":
      return {
        templates: state.templates.filter((t) => t.id !== action.templateId),
      };
  }
};

export default templatesReducer;
