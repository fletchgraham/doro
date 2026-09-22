# Doro

A focused task timer for working through your day.

## Philosophy

Doro is like a doctor's notepad—start fresh each morning, throw it away at the end of the day. The timer page isn't meant for persistent task storage; it's a tool for deciding, moment by moment, what to work on right now. Longer-term planning lives on the separate Projects page, which feeds tasks into the day one at a time (see below).

## Features

- Pomodoro-style countdown timer
- Drag-and-drop task organization
- Task status workflow: Ready → Working → Active → Done
- Time tracking per task
- Estimate vs. actual duration tracking
- Gold: earn it on some task colors, spend it on others (see below)
- Projects page for longer-term planning, with story points and progress (see below)
- Subtasks: a checklist inside any task (see below)
- Templates: named subtask lists, applied with `/name` slash commands (see below)
- Links in task and subtask text open in a new tab
- Quick task entry with keyboard shortcuts
- Export tasks to clipboard
- Settings modal (gear icon): theme, feature flags, Todoist and Workflowy
  modes (see below)

## Usage

```bash
npm install
npm run dev
```

## Gold

A light gamification layer over the color-coded time tracking. Each task
color either earns or spends gold, at a rate you set per minute worked:

- Gold accrues continuously: 30 seconds of red at 1 gold / min earns 0.5,
  and 4.25 minutes of green at 1 gold / min costs 4.25.
- Gold is always computed live from the task durations; nothing is stored
  except the rates. Editing a task's time, changing its color, or changing
  a rate re-prices the whole day, and a page refresh changes nothing.
- When gold runs out on a spending task the timer drops to zero, Reset is
  disabled and the readout turns red. Only Next Task moves things along.

Defaults: red earns 1 and blue earns 0.2 per minute; every other color
spends 1 per minute. Click the gold readout next to the shuffle button to
change modes and rates. A rate of 0 makes a color neutral. The whole
feature can be switched off in Settings (see below); off, the readout is
hidden and the timer never stops for lack of gold.

## Settings

The gear icon at the right of the timer page's toolbar opens Settings.
Everything in it is saved as you change it:

- **Appearance**: light, dark or follow the system.
- **Features**: feature flags to simplify the app. Each hides its feature
  entirely while keeping its data, so it comes back as it was when
  switched on again.
  - *Gold economy*: the gold readout, its rates and the out-of-gold stop.
  - *Accomplishable color coding*: the "Time left" budget above the task
    lists. With a budget entered, each Working/Ready task turns green if
    its remaining estimate (20 minutes when it has none) still fits in
    order, red once the budget is used up, with an over/under readout.
    Off by default.
  - *Goals*: the per-color goal bars at the top of the timer page.
- **Todoist mode**: with a token entered, an "Import from Todoist" button
  on the timer page pulls today's tasks into Ready, optionally only those
  with a given label. Priorities map to colors.
- **Workflowy mode**: two-way sync between the day's tasks and the
  children of one Workflowy node (paste a node link or UUID and your API
  key). The timer page shows a Sync button and the last sync's result.

Flags live in `doroFeatures` in localStorage; the first load carries the
old "Show accomplishable" switch over.

## Projects

The Projects page (`#/projects`, via the nav at the top) is where work that
outlives a single day is kept. Each project is a collapsible list of tasks
that can be renamed, drag-reordered (within or across projects), pointed
like agile tickets (1, 3, 5 or 8) and ticked off. Projects themselves are
reordered by dragging their header, and each shows story points finished
over total, e.g. `5/62`, with a progress bar underneath.

The sun button on a task adds it to today's Ready list on the timer page,
titled `Project X - do thing` so it reads on its own there. The two copies
share notes and completion:

- Completing it on the timer page ticks it off in the project (struck
  through and greyed); unticking it in the project reopens the day copy.
- Deleting the day copy (Delete Completed, Delete All, or the row's ×)
  never touches the project. Add it to today again tomorrow and it comes
  back with the same notes, so one task can span several days.
- Renaming the task or its project retitles the day copy.

Projects are stored separately from the day's tasks (`doroProjects` in
localStorage) and survive the daily clear-out.

## Subtasks

Any task, on either page, can hold a checklist of subtasks. Expand the
task (or look at the active task on the timer page) to see it: type in
the "Add subtask..." box and press Enter to add one, tick it off, drag it
to reorder (or Alt+↑/↓ while renaming it), double-click to rename, × to
delete. Subtasks are deliberately plain: no duration, estimate, points
or notes of their own. A collapsed row shows how many are ticked, e.g.
`2/5`.

A project task keeps its subtasks and their ticks between sessions, and
a day copy pulled in with the sun button shares the same checklist, so
ticking a step on the timer page ticks it in the project and vice versa.
Subtasks don't affect story points or progress.

## Templates

The Templates page (`#/templates`) holds named lists of subtasks, one
step per line (Alt+↑/↓ moves a line, double-click the name to rename,
drag the header to reorder). They're applied as slash commands: type `/`
in any box that adds a task or subtask and an autocomplete lists the
templates, narrowed by what you type after the slash. ↑/↓ moves through
them, Enter, Tab or a click picks one, Escape dismisses the menu. Typing
the whole command and pressing Enter works too, as does a partial name
that only one template matches (`/rel` for "Release").

What picking does depends on the box:

- In an "Add subtask..." box, the template's steps are added to that
  task's checklist, in order.
- In a "New task..." box (timer page or a project), a task named after
  the template is added with the steps as its subtasks.
- In the Add Task modal, the template's name fills the description and
  its steps are attached (shown under the box). The name stays editable,
  so `/release` can become "Release v2" and keep the checklist.
- In the switch-task modal (`s`), a "Start" entry creates the task with
  its subtasks and starts the timer on it.

Templates are stored in `doroTemplates` in localStorage and survive the
daily clear-out. A template only holds text; the subtasks it adds are
ordinary subtasks from then on.

## Links

URLs in a task's or subtask's text (`https://...`, `http://...` or
`www....`) render as links that open in a new tab, as do markdown-style
`[label](https://...)` links. Trailing punctuation stays outside the
link. Clicking a link doesn't select, drag or start editing the row.

## Keyboard Shortcuts

- `a` - Open add task modal (timer page)
- `s` - Open switch task modal (timer page)
- `↑/↓` - Reorder selected task
- `Cmd+V` (when paused) - Bulk add tasks from clipboard (one per line)

## macOS App

A native macOS version lives in `macos/` (`Doro.app`) — same doro spirit
plus things only a native app can do: jumping to a task's dedicated macOS
Space when it starts, an embedded Workflowy pane, per-task desktop pinning,
and a stats page. See `macos/CLAUDE.md` for build instructions and platform
gotchas.

```bash
cd macos
./build.sh && open Doro.app   # build
swift test                    # tests
```
