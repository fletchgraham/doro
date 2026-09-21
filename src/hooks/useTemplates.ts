import { createContext, useContext, useEffect, useReducer, useRef } from "react";
import type { Template } from "../types/Template";
import templatesReducer, {
  loadTemplatesState,
  type TemplatesAction,
} from "../lib/templates";

const STORAGE_KEY = "doroTemplates";
const STORAGE_DEBOUNCE_MS = 500;

const useTemplates = () => {
  const [state, dispatch] = useReducer(templatesReducer, null, () =>
    loadTemplatesState(localStorage.getItem(STORAGE_KEY))
  );
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced like the other stores, so typing steps doesn't thrash storage
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, STORAGE_DEBOUNCE_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [state]);

  const apply = (action: TemplatesAction) => dispatch(action);

  return {
    templates: state.templates,
    addTemplate: (name: string, steps?: string[]) =>
      apply({ type: "ADD_TEMPLATE", name, steps }),
    renameTemplate: (template: Template, name: string) =>
      apply({ type: "RENAME_TEMPLATE", templateId: template.id, name }),
    setSteps: (template: Template, steps: string[]) =>
      apply({ type: "SET_TEMPLATE_STEPS", templateId: template.id, steps }),
    moveTemplate: (template: Template, index: number) =>
      apply({ type: "MOVE_TEMPLATE", templateId: template.id, index }),
    removeTemplate: (template: Template) =>
      apply({ type: "REMOVE_TEMPLATE", templateId: template.id }),
  };
};

export type TemplateManager = ReturnType<typeof useTemplates>;

// The template list is wanted by every add-task and add-subtask box, deep
// in the task lists, so it travels by context rather than props.
export const TemplatesContext = createContext<Template[]>([]);

export const useTemplateList = (): Template[] => useContext(TemplatesContext);

export default useTemplates;
