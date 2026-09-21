import { expect, test } from "vitest";
import templatesReducer, {
  EMPTY_TEMPLATES,
  findTemplateByCommand,
  loadTemplatesState,
  matchTemplates,
  parseSlashQuery,
  subtasksFromTemplate,
  templateSteps,
} from "./templates";
import type { Template, TemplatesState } from "../types/Template";

const t = (name: string, steps: string[] = []): Template => ({
  id: name.toLowerCase(),
  name,
  steps,
});

const withTemplate = (name = "Release", steps?: string[]): TemplatesState =>
  templatesReducer(EMPTY_TEMPLATES, { type: "ADD_TEMPLATE", name, steps });

test("adds templates in order, trimming the name", () => {
  let state = withTemplate("  A  ");
  state = templatesReducer(state, { type: "ADD_TEMPLATE", name: "B" });
  state = templatesReducer(state, { type: "ADD_TEMPLATE", name: "   " });
  expect(state.templates.map((x) => x.name)).toEqual(["A", "B"]);
  expect(state.templates[0].steps).toEqual([]);
  expect(state.templates[0].id).toBeTruthy();
});

test("renames, sets steps, reorders and removes", () => {
  let state = withTemplate("A");
  state = templatesReducer(state, { type: "ADD_TEMPLATE", name: "B" });
  state = templatesReducer(state, { type: "ADD_TEMPLATE", name: "C" });
  const [a, b] = state.templates;

  state = templatesReducer(state, {
    type: "RENAME_TEMPLATE",
    templateId: a.id,
    name: " Alpha ",
  });
  expect(state.templates[0].name).toBe("Alpha");
  // A blank rename is ignored
  state = templatesReducer(state, {
    type: "RENAME_TEMPLATE",
    templateId: a.id,
    name: "",
  });
  expect(state.templates[0].name).toBe("Alpha");

  state = templatesReducer(state, {
    type: "SET_TEMPLATE_STEPS",
    templateId: b.id,
    steps: ["one", "", "two"],
  });
  expect(state.templates[1].steps).toEqual(["one", "", "two"]);

  state = templatesReducer(state, {
    type: "MOVE_TEMPLATE",
    templateId: a.id,
    index: 99,
  });
  expect(state.templates.map((x) => x.name)).toEqual(["B", "C", "Alpha"]);
  expect(
    templatesReducer(state, { type: "MOVE_TEMPLATE", templateId: "nope", index: 0 })
  ).toBe(state);

  state = templatesReducer(state, { type: "REMOVE_TEMPLATE", templateId: b.id });
  expect(state.templates.map((x) => x.name)).toEqual(["C", "Alpha"]);
});

test("steps are trimmed and blank lines dropped when applied", () => {
  const template = t("Release", [" build ", "", "  ", "test", "ship "]);
  expect(templateSteps(template)).toEqual(["build", "test", "ship"]);
  const subtasks = subtasksFromTemplate(template);
  expect(subtasks.map((s) => s.text)).toEqual(["build", "test", "ship"]);
  expect(subtasks.every((s) => !s.done && s.id)).toBe(true);
  // Fresh ids every time, so two tasks from one template don't collide
  expect(subtasksFromTemplate(template)[0].id).not.toBe(subtasks[0].id);
});

test("parses a slash query", () => {
  expect(parseSlashQuery("/rel")).toBe("rel");
  expect(parseSlashQuery("/")).toBe("");
  expect(parseSlashQuery("  /rel")).toBe("rel");
  expect(parseSlashQuery("rel")).toBeNull();
  expect(parseSlashQuery("a /rel")).toBeNull();
  expect(parseSlashQuery("")).toBeNull();
});

test("matches templates by prefix first, then substring, case-insensitively", () => {
  const templates = [t("Weekly review"), t("Release"), t("Code review")];
  const names = (q: string) => matchTemplates(templates, q).map((x) => x.name);
  expect(names("")).toEqual(["Weekly review", "Release", "Code review"]);
  expect(names("re")).toEqual(["Release", "Weekly review", "Code review"]);
  expect(names("REVIEW")).toEqual(["Weekly review", "Code review"]);
  expect(names("zzz")).toEqual([]);
});

test("resolves a submitted command to a template", () => {
  const templates = [t("Weekly review"), t("Release"), t("Code review")];
  expect(findTemplateByCommand(templates, "/release")?.name).toBe("Release");
  expect(findTemplateByCommand(templates, "/Weekly Review")?.name).toBe(
    "Weekly review"
  );
  // A unique partial match is enough
  expect(findTemplateByCommand(templates, "/rel")?.name).toBe("Release");
  // Ambiguous, blank or not a command: nothing
  expect(findTemplateByCommand(templates, "/review")).toBeNull();
  expect(findTemplateByCommand(templates, "/")).toBeNull();
  expect(findTemplateByCommand(templates, "release")).toBeNull();
  expect(findTemplateByCommand(templates, "/nope")).toBeNull();
});

test("loads persisted state, dropping junk", () => {
  expect(loadTemplatesState(null)).toEqual(EMPTY_TEMPLATES);
  expect(loadTemplatesState("not json")).toEqual(EMPTY_TEMPLATES);
  expect(loadTemplatesState("[]")).toEqual(EMPTY_TEMPLATES);
  expect(
    loadTemplatesState(
      JSON.stringify({
        templates: [
          { id: "a", name: "A", steps: ["x", 3, "y"] },
          { id: "b", name: "B" },
          { id: "a", name: "dup" },
          { name: "no id" },
          null,
        ],
      })
    )
  ).toEqual({
    templates: [
      { id: "a", name: "A", steps: ["x", "y"] },
      { id: "b", name: "B", steps: [] },
    ],
  });
});
