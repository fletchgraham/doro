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
  Task shape: `{ id, text, notes: "", events: [], status, duration, order, estimate }`
  with status one of ready | working | active | done.
- **Use a tall viewport** (e.g. 1280x2000). With a few tasks the Ready/Done
  lists fall below the default 720px fold and mouse events silently miss.
- **Drag & drop** (dnd-kit, 8px pointer activation): mouse.down on the row
  center, move 12px to activate, then move in steps to the target, brief
  pause, mouse.up. Task lists only render while the timer is paused.
- **Timer flows**: set the minutes input to 1 for a fast completion cycle.
  Keyboard: `a` add modal, `s` switch modal (type + Enter creates & starts).
- **Notifications**: stub `window.Notification` via addInitScript and
  override `document.hasFocus = () => false` (completion notification is
  skipped when the app has focus).
- localStorage writes are debounced 500ms — wait ~700ms before reading
  `doroTasks` back.
