import ApplicationServices
import CoreGraphics
import Foundation

// macOS has no public API for switching Spaces, so we simulate the Mission
// Control keyboard shortcuts (Ctrl+1...9). Requires Accessibility permission
// and the "Switch to Desktop N" shortcuts enabled in System Settings.

// MARK: - Current-space detection (private CGS API, read-only).
// Looked up via dlsym so the app degrades gracefully if Apple removes it.

private typealias CGSMainConnectionIDFunc = @convention(c) () -> UInt32
private typealias CGSCopyManagedDisplaySpacesFunc = @convention(c) (UInt32) -> Unmanaged<CFArray>?

private let cgsMainConnectionID: CGSMainConnectionIDFunc? = {
    guard let sym = dlsym(dlopen(nil, RTLD_NOW), "CGSMainConnectionID") else { return nil }
    return unsafeBitCast(sym, to: CGSMainConnectionIDFunc.self)
}()

private let cgsCopyManagedDisplaySpaces: CGSCopyManagedDisplaySpacesFunc? = {
    guard let sym = dlsym(dlopen(nil, RTLD_NOW), "CGSCopyManagedDisplaySpaces") else { return nil }
    return unsafeBitCast(sym, to: CGSCopyManagedDisplaySpacesFunc.self)
}()

/// Returns (currentDesktopNumber, totalDesktops), or nil if the private API
/// is unavailable or the current space is a fullscreen app.
///
/// Mission Control numbers desktops globally across displays (in the order
/// CGS reports them), so with "Displays have separate Spaces" the laptop's
/// lone desktop is 1 and the external monitor's start at 2 — the numbering
/// Ctrl+N shortcuts use. Each display has its own current space; `displayID`
/// picks which one counts as "where I am" (pass the display under the app
/// window). nil falls back to the display with the most desktops.
func currentSpaceInfo(displayID: CGDirectDisplayID? = nil) -> (current: Int, total: Int)? {
    guard let connFunc = cgsMainConnectionID,
          let copyFunc = cgsCopyManagedDisplaySpaces,
          let displays = copyFunc(connFunc())?.takeRetainedValue() as? [[String: Any]]
    else { return nil }

    let targetUUID = displayID.flatMap { id in
        CGDisplayCreateUUIDFromDisplayID(id)
            .map { CFUUIDCreateString(nil, $0.takeRetainedValue()) as String }
    }
    let chosen = displays.first { ($0["Display Identifier"] as? String) == targetUUID }
        ?? displays.max { a, b in
            ((a["Spaces"] as? [Any])?.count ?? 0) < ((b["Spaces"] as? [Any])?.count ?? 0)
        }
    guard let chosen,
          let currentID = (chosen["Current Space"] as? [String: Any])?["id64"] as? Int64
    else { return nil }

    // Flatten desktops across all displays for the global numbering.
    // type 0 = a normal desktop; other types are fullscreen-app spaces.
    var ids: [Int64] = []
    for display in displays {
        let desktops = (display["Spaces"] as? [[String: Any]] ?? [])
            .filter { ($0["type"] as? Int) == 0 }
        ids.append(contentsOf: desktops.compactMap { $0["id64"] as? Int64 })
    }
    guard let index = ids.firstIndex(of: currentID) else { return nil }
    return (index + 1, ids.count)
}

/// Virtual key codes for the number row keys 1...9 (not sequential!).
private let numberRowKeyCodes: [CGKeyCode] = [18, 19, 20, 21, 23, 22, 26, 28, 25]

func switchToSpace(_ number: Int) {
    guard (1...9).contains(number) else { return }
    let source = CGEventSource(stateID: .hidSystemState)
    let keyCode = numberRowKeyCodes[number - 1]
    for keyDown in [true, false] {
        guard let event = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: keyDown) else { continue }
        event.flags = .maskControl
        event.post(tap: .cghidEventTap)
    }
}
