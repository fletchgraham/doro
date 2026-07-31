# Doro macOS app

Native AppKit version of doro (`Doro.app`). Started as a Spaces-integration
POC, now the app Fletcher actually runs: the web app can't switch macOS
Spaces, and Fletcher keeps one desktop per task — doro jumps to a task's
space when the task starts.

Naming residue from the POC era, kept deliberately: the bundle identifier is
`com.fletchgraham.doro-poc` — the WebKit website data store (workflowy pane
login) and the Accessibility TCC grant are both keyed to it, so renaming it
would log the pane out and orphan the grant.

## Build & run

```sh
./build.sh          # compiles Doro/*.swift into Doro.app (plain swiftc, no Xcode project)
open Doro.app
```

## Tests

```sh
swift test          # from macos/
```

Package.swift exists only for testing — build.sh does not use it. The
`DoroCore` target covers the AppKit-free logic files (TaskStore, Workflowy
parsing, SpacesLogic desktop numbering, TimeText parsing); keep new pure
logic in those files (or new ones added to Package.swift) so it stays
testable. TaskStore takes an injectable fileURL so tests never touch the
real state.json.

## Layout

- `Doro/main.swift` — app delegate: window, menu bar, Timer/Settings/Stats
  page switching, the slide-down recorded-time editor, workflowy completion
  sync helper.
- `Doro/TimerViewController.swift` — countdown (green running / yellow
  paused / flashing after a minute paused), embedded WKWebView showing the
  task's URL, complete / next / go-to-space / pin-space / edit-time buttons.
- `Doro/SettingsViewController.swift` — task table (complete checkbox,
  name, time, space + color dropdowns, url), session length, TSV export,
  workflowy import.
- `Doro/TaskStore.swift`, `Workflowy.swift`, `SpacesLogic.swift`,
  `TimeText.swift` — pure logic, unit-tested.
- `Doro/WebResolver.swift` — hidden-WKWebView short-link resolution.
- `Doro/StatsViewController.swift` — pie + per-color time breakdown.
- `Doro/Spaces.swift` — CGS private-API glue and Ctrl+N keystroke synthesis.

## Gotchas (the reason this file exists)

- **Every rebuild invalidates the Accessibility grant.** The app is ad-hoc
  signed; the signature hash changes per build and the TCC grant is tied to it.
  After rebuilding: `tccutil reset Accessibility com.fletchgraham.doro-poc`,
  relaunch, re-approve the prompt. The System Settings slider can show enabled
  while the current build is untrusted — believe the in-app status line, not
  the slider. A real Apple Development cert would make grants survive rebuilds.
- **Space switching = simulated Ctrl+N keystrokes.** There is no public API.
  Requires Accessibility permission AND the "Switch to Desktop N" shortcuts
  enabled in System Settings › Keyboard › Shortcuts › Mission Control (as of
  July 2026, Fletcher has 1–6 enabled; desktops beyond that are unreachable
  until enabled). Verified working on macOS 26.
- **Current-space detection uses private API** (`CGSCopyManagedDisplaySpaces`
  via dlsym in `Spaces.swift`, backing the pin-space buttons).
  It reports one entry per display, each with its own current space. Mission
  Control numbers desktops globally across displays in CGS order — Fletcher
  docked runs "Displays have separate Spaces", so the built-in display's lone
  desktop is Desktop 1 and the external's are 2+ (an earlier note called the
  built-in entry a "phantom display"; numbering within one display is off by
  the other displays' desktop count). Flatten all displays' desktops for the
  number; use the display under the app window as "where I am". Covered by
  regression tests in `Tests/DoroCoreTests.swift`.
- **Workflowy calls the official API v1 directly** (Bearer token, no CORS in
  a native app). The web app's `src/lib/workflowy.ts` + `api/workflowy.ts`
  proxy is the reference implementation; keep parsing behavior in sync with
  it. Completing/uncompleting a task in doro mirrors to the workflowy node
  (best-effort, silent on failure — doro's state is the source of truth).
- **Short-id resolution goes through a hidden WKWebView first**
  (`WebResolver.swift`): it loads the short link with the Timer pane's
  logged-in session and reads the full UUID from the page (`WF.currentItem()
  .getId()`, then the `projectid` DOM attribute) — both are undocumented
  frontend surfaces, verified working July 2026. If neither yields a UUID in
  12s, it falls back to the API tree walk (BFS from root, ~1 request/node,
  capped at 200), which is also what the web app does every time.
- **Web pane login persists** because WKWebView uses the default website data
  store (`~/Library/WebKit/com.fletchgraham.doro-poc/`). Deleting that folder
  logs the pane out.

## State

App state (tasks, cumulative seconds, settings, Workflowy key) is one JSON
file: `~/Library/Application Support/Doro/state.json`. Delete it to reset.
(First launch after the rename copies it from the old `DoroPOC/` folder,
which is left in place as a backup.)
The resolved Workflowy parent UUID is cached there too (short-id resolution
walks the whole tree at ~1 API request per node, so it runs at most once);
editing the parent input clears the cache.

## Scope

Features are added incrementally from the web app as needed; some web-app
features (drag-and-drop ordering, Todoist import, estimates) intentionally
haven't come over.
