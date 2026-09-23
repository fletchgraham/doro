---
name: verify
description: How to build, run, and drive Doro to verify changes end-to-end.
---

# Verifying Doro changes

Vite + React SPA, all state in localStorage. No backend needed for core flows
(Todoist import hits `/api/todoist`, absent in dev without vercel).

## Launch

```bash
npm run dev -- --port 5199   # ready in <1s
```

## Drive headlessly

Playwright with the pre-installed browser: `chromium.launch({ executablePath: "/opt/pw-browsers/chromium" })`.

- **Seed state** instead of clicking through modals:
  `page.addInitScript(seed => localStorage.setItem("doroTasks", JSON.stringify(seed)), SEED)`.
  Task shape: `{ id, text, notes: "", subtasks: [], events: [], status, duration, order, estimate }`
  with status one of ready | working | active | done (a missing `subtasks`
  is migrated to `[]` on load). Every pause
  recomputes `duration` from `events`, so a seeded duration only survives
  if backed by a matching `start`/`stop` pair.
- **Settings**: the gear button (aria-label "Open settings", right of the
  toolbar) opens `[data-testid="settings-modal"]`: theme radios
  (`role="radio"`, names Light/Dark/System), feature switches
  `#feature-gold`, `#feature-accomplishable`, `#feature-goals`, and
  `#todoist-mode` / `#workflowy-mode` switches whose inputs (aria-labels
  "Todoist API token", "Todoist label filter", "Workflowy API key",
  "Workflowy parent node") show while the mode is on. Flags persist at
  once to `doroFeatures` (`{ gold, accomplishable, goals }`; seed it to
  skip the modal). Off, gold hides its readout and never stops the timer,
  accomplishable hides the "Time left" bar and row coloring, goals hides
  the goal bars. Accomplishable is off by default (a legacy
  `doroShowAccomplishable` of `"true"` turns it on when `doroFeatures` is
  absent); coloring needs `doroTimeBudget` (ms) > 0 as well. Todoist mode
  (`doroTodoistEnabled`, defaulting to on when `doroTodoistToken` exists)
  shows "Import from Todoist" only with a token; Workflowy mode
  (`doroWorkflowyEnabled` + `doroWorkflowyApiKey` +
  `doroWorkflowyParentInput`) adds a "Workflowy mode … Sync" footer to
  the timer page and syncs on enable/load once configured. The modal
  fades out over ~200ms, so wait for it to detach before asserting on
  the page behind it.
- **Backup**: the settings modal's Backup section has "Export data"
  (downloads `doro-backup-YYYY-MM-DD.json`: `{ app: "doro", version,
  exportedAt, data }` with every `doro*` localStorage key; object/array
  values embedded as JSON, the rest as raw strings) and "Restore from
  file" (hidden `[data-testid="backup-file-input"]`, so use
  `setInputFiles`). Restore validates, asks via window.confirm, replaces
  all `doro*` keys, then reloads the page; bad files show an error line.
- **Gold**: rates live in `doroGoldSettings`
  (`{ version: 2, rules: { [hex]: { mode, rate } } }`, rate per minute; an
  unversioned bare map is read as the old per-10-minute format and divided
  by 10). Seed a huge spend rate to hit the out-of-gold stop in seconds.
  The readout is `[data-testid="gold-readout"]`.
- **Projects**: the projects page is `#/projects`; the timer page stays
  mounted (hidden) underneath so the countdown keeps running (same for
  `#/templates`). Seed
  `doroProjects` as `{ projects: [{ id, name, order, collapsed }],
  tasks: [{ id, projectId, text, notes, subtasks?, done, order, points? }] }`.
  A day task pulled from a project carries `projectTaskId`;
  notes/subtasks/done sync both ways through effects in `App`, so wait
  ~700ms before reading either store.
  Rows are `[data-testid="project-task"]`; projects are
  `section[data-testid="project"]` and reorder by dragging their header
  (their sortable id is `project:<id>`, the task list droppable is the
  bare id). Each project header has a ⋮ button (aria-label
  `Actions for project <name>`) opening `[data-testid="project-menu"]`
  with Archive (Unarchive on archived ones) and Delete (window.confirm).
  Archived projects (`archived: true`) show only on `#/archive`, the
  Archive tab; their tasks stay on today's list. The sun button is labelled
  "Add to today" / "Remove from today", progress is
  `[data-testid="project-progress"]`. A project header shows
  `[data-testid="project-today-count"]` (sun + count) only while one of its
  tasks is on today's list; in the timer view a linked day task carries
  `[data-testid="task-project-indicator"]`, a folder icon linking to
  `#/projects`. Uncolored tasks spend gold by
  default, so seed an earning rule for `#9ca3af` before running the timer.
- **Subtasks**: `{ id, text, done }[]` on both task kinds, ordered by
  array position. The checklist renders inside a task's expanded area
  (the row's "Show details" button on projects, the ▶ toggle on the timer
  page) and in the active task view, as `[data-testid="subtasks"]` with
  `[data-testid="subtask"]` rows; the "New subtask" input adds on Enter
  and keeps focus, so blur it before using the `a`/`s` shortcuts.
  Checkboxes are labelled `Mark "<text>" done` / `not done`, rows drag
  to reorder in their own nested DndContext (5px activation), and a
  folded row shows `[data-testid="subtask-count"]` as `done/total`.
  Prefer `exact: true` on role/label locators and scope them to a row:
  the timer page stays mounted (hidden) under the projects page, so its
  checklist is also in the DOM.
- **Templates**: the templates page is `#/templates`; seed `doroTemplates`
  as `{ templates: [{ id, name, steps: string[] }] }` (array order is the
  display order). Cards are `[data-testid="template"]` with a
  `[data-testid="template-steps"]` textarea (aria-label
  `Subtasks for <name>`, one step per line) and
  `[data-testid="template-step-count"]`; the header drags to reorder and
  double-clicks to rename (`Template name` input, use `exact: true` — the
  "New template name" box also matches). Every add-task / add-subtask
  `Input` is a `SlashInput` (`role="combobox"`, placeholder ends in
  "(/ for a template)"): typing `/` opens `[data-testid="slash-menu"]`
  with `role="option"` rows; ArrowUp/Down move, Enter/Tab/click pick,
  Escape closes just the menu. Picking fires no change event, so after
  an Escape retype the slash (`fill("")` then `pressSequentially("/")`)
  to reopen it. Picking in a subtask box adds the steps as subtasks; in a
  task box it adds a task named after the template with them; in the
  Add Task modal it fills the name and shows
  `[data-testid="add-task-template"]` (subtasks ride along on Add); in
  the switch modal "/name" lists `Start "<name>"` items. The template
  list reaches these through `TemplatesContext`, so a component rendered
  outside `App` sees none.
- **Links**: task/subtask text renders through `LinkedText`: bare
  http(s)/www URLs and `[label](url)` become `<a target="_blank">`
  (locate with `a[href='...']`); clicks on them stop propagation.
- **Use a tall viewport** (e.g. 1280x2000). With a few tasks the Ready/Done
  lists fall below the default 720px fold and mouse events silently miss.
- **Drag & drop** (dnd-kit, 8px pointer activation): mouse.down on the row
  center, move 12px to activate, then move in steps to the target, brief
  pause, mouse.up. Task lists only render while the timer is paused.
  Sensors come from `useDragSensors`: the pointer sensor ignores touch,
  which drags after a 250ms hold instead (`Input.dispatchTouchEvent` via
  a CDP session: touchStart, wait 400ms, touchMove steps, touchEnd; a
  quick swipe scrolls). A hold that starts on an input, button or link
  never drags.
- **Touch screens**: controls that reveal on hover (`can-hover:opacity-0`,
  see `index.css`) are always visible where `(hover: none)`. Chromium's
  emulation of that query is unreliable across navigations and taps, so
  pin it per page with `Emulation.setEmulatedMedia` `features:
  [{ name: "hover", value: "none" }]` on a fresh page. Below `sm` a task
  row wraps its estimate/duration/delete controls onto a second line when
  they don't fit beside the text.
- **Timer flows**: set the minutes input to 1 for a fast completion cycle.
  Keyboard: `a` add modal, `s` switch modal (type + Enter creates & starts).
- **Notifications**: stub `window.Notification` via addInitScript and
  override `document.hasFocus = () => false` (completion notification is
  skipped when the app has focus).
- localStorage writes are debounced 500ms — wait ~700ms before reading
  `doroTasks` back.
