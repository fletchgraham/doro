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
- Gold: earn it on some task colors, spend it on others (see below)
- Quick task entry with keyboard shortcuts
- Export tasks to clipboard

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
change modes and rates. A rate of 0 makes a color neutral.

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
