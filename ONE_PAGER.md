# Doro — One-Pager

**A focused task timer for working through your day.**

Doro is like a doctor's notepad: start fresh each morning, throw it away at the end of the day. It is not a project manager or a persistent task database — everything lives in your browser's local storage. It's a tool for deciding, moment by moment, what to work on *right now*, and for keeping an honest record of where the day's time actually went.

## How it works

Doro combines a Pomodoro-style countdown timer with a small, opinionated task workflow. Every task is in one of four states:

- **Active** — the single task you're working on right now, shown front and center under the timer.
- **Working** — today's short list: tasks you've pulled in and are cycling through.
- **Ready** — the on-deck queue that feeds Working as you finish things.
- **Done** — finished tasks, kept around for the end-of-day export.

While the timer runs, the app logs start/stop events against the active task, so per-task time tracking happens automatically as a side effect of just using the timer. When the countdown ends, a bell rings and a desktop notification fires (if the tab isn't focused). Pausing the timer flips the app into planning mode: the task lists appear so you can reorder, edit, and reorganize; starting it again hides them so only the active task remains.

## The user flow

1. **Set up the day.** Add tasks via the add modal (`a`), the inline entry field, bulk paste from the clipboard (one task per line, while paused), or a one-click **Todoist import** that pulls today's and overdue tasks through a serverless proxy — with an optional label filter, priorities mapped to colors, links back to the Todoist task, and de-duplication on re-import.
2. **Plan.** Drag tasks between Ready, Working, and Done, or reorder with ↑/↓. Give each task a color (seven options), a time estimate (natural input like `20m` or `1h30m`; 20 minutes is the default), a URL, and free-form notes. Enter your remaining time for the day ("Time left: 3h") and toggle **Show accomplishable**: tasks that fit in the budget highlight green, ones that don't highlight red, with an over/under summary.
3. **Begin.** Hit **Begin** to pull the first task in and start the countdown (default 20 minutes, adjustable). The active task card shows live elapsed time against its estimate — turning red when you run over — plus its notes and URL.
4. **Work the loop.** When the bell rings (or whenever you choose): **Complete** finishes the task with a burst of confetti, promotes the next Ready task into Working, and activates the next one automatically. **Next Task »** rotates the current task to the back of Working and activates the next — in order, or randomly with **shuffle mode** on. Need something specific? The switch modal (`s`) fuzzy-searches all tasks, or creates and starts a new one on the spot. **Lock** the Ready list when you don't want completions pulling in more work.
5. **Wrap up.** Click the "worked" total for a donut-chart breakdown of time by color. Export the day as an indented text outline, or as tab-separated rows (date, task, notes, hours) ready to paste into a spreadsheet. Then delete completed — or everything — and start tomorrow fresh.

## What's under the hood

A client-side React + TypeScript app (Vite, Tailwind, dnd-kit, shadcn/ui) with a single Vercel serverless function proxying the Todoist API. All state persists to localStorage with debounced writes; there is no backend, no account, and no sync. Each task carries an append-only event log (start / stop / manual duration override) from which durations are computed, so the time record stays consistent even when edited by hand.

## Feature summary

| Area | What it has today |
| --- | --- |
| Timer | Configurable countdown, pause/reset, bell + desktop notification, timer state in the tab title, "paused for" indicator |
| Tasks | Active/Working/Ready/Done workflow, drag-and-drop, keyboard reorder, colors, notes, URLs, inline editing |
| Time tracking | Automatic per-task durations, estimates vs. actuals, manual overrides, time-by-color donut, daily total |
| Planning | Time budget with accomplishable highlighting, ready-list lock, shuffle mode |
| Input | Add modal (`a`), switch/create modal (`s`), inline entry, bulk paste, Todoist import |
| Output | Clipboard export (outline), spreadsheet export (TSV), delete completed / delete all |
