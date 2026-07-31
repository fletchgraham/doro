# Doro

A focused task timer for working through your day.

## Philosophy

Doro is like a doctor's notepad—start fresh each morning, throw it away at the end of the day. It's not meant for persistent task storage or long-term project management. It's a tool for deciding, moment by moment, what to work on right now.

## Features

- Pomodoro-style countdown timer
- Drag-and-drop task organization
- Task status workflow: Ready → Working → Active → Done
- Time tracking per task
- Estimate vs. actual duration tracking
- Quick task entry with keyboard shortcuts
- Export tasks to clipboard

## Usage

```bash
npm install
npm run dev
```

## Keyboard Shortcuts

- `a` - Open add task modal
- `s` - Open switch task modal
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
