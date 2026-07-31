# Doro macOS POC

Native AppKit prototype of doro (`DoroPOC.app`). Motivation: the web app can't
switch macOS Spaces; Fletcher keeps one space per task and wants doro to jump
to a task's space when the task starts.

## Build & run

```sh
./build.sh          # compiles DoroPOC/*.swift into DoroPOC.app (plain swiftc, no Xcode project)
open DoroPOC.app
```

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
  via dlsym in `Spaces.swift`, backing the "Set Space to Current" button).
  It reports one entry per display, each with its own current space. Mission
  Control numbers desktops globally across displays in CGS order — Fletcher
  docked runs "Displays have separate Spaces", so the built-in display's lone
  desktop is Desktop 1 and the external's are 2+ (an earlier note called the
  built-in entry a "phantom display"; numbering within one display is off by
  the other displays' desktop count). Flatten all displays' desktops for the
  number; use the display under the app window as "where I am".
- **Workflowy import calls the official API v1 directly** (Bearer token, no
  CORS in a native app). The web app's `src/lib/workflowy.ts` +
  `api/workflowy.ts` proxy is the reference implementation; keep parsing
  behavior in sync with it.
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
file: `~/Library/Application Support/DoroPOC/state.json`. Delete it to reset.
The resolved Workflowy parent UUID is cached there too (short-id resolution
walks the whole tree at ~1 API request per node, so it runs at most once);
editing the parent input clears the cache.

## Scope

Deliberately minimal — features are added incrementally from the web app as
needed, and some web-app features will intentionally never come over.
