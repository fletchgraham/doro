import CoreGraphics

// macOS has no public API for switching Spaces, so we simulate the Mission
// Control keyboard shortcuts (Ctrl+1...9). Requires Accessibility permission
// and the "Switch to Desktop N" shortcuts enabled in System Settings.

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
