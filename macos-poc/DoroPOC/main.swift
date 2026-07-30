import AppKit
import ApplicationServices
import WebKit

// MARK: - Private CGS API (read-only, used to display the current space number).
// Looked up via dlsym so the app degrades gracefully if Apple removes them.

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

/// Returns (currentDesktopNumber, totalDesktops) for the main display, or nil if
/// the private API is unavailable or the current space is a fullscreen app.
func currentSpaceInfo() -> (current: Int, total: Int)? {
    guard let connFunc = cgsMainConnectionID,
          let copyFunc = cgsCopyManagedDisplaySpaces,
          let displays = copyFunc(connFunc())?.takeRetainedValue() as? [[String: Any]]
    else { return nil }

    // CGSCopyManagedDisplaySpaces returns one entry per display; find the main one
    // by UUID, falling back to whichever display has the most desktops.
    let mainUUID = CGDisplayCreateUUIDFromDisplayID(CGMainDisplayID())
        .map { CFUUIDCreateString(nil, $0.takeRetainedValue()) as String }
    let display = displays.first { ($0["Display Identifier"] as? String) == mainUUID }
        ?? displays.max { a, b in
            ((a["Spaces"] as? [Any])?.count ?? 0) < ((b["Spaces"] as? [Any])?.count ?? 0)
        }

    guard let display,
          let currentSpace = display["Current Space"] as? [String: Any],
          let currentID = currentSpace["id64"] as? Int64,
          let spaces = display["Spaces"] as? [[String: Any]]
    else { return nil }

    // type 0 = a normal desktop; other types are fullscreen-app spaces.
    let desktops = spaces.filter { ($0["type"] as? Int) == 0 }
    let ids = desktops.compactMap { $0["id64"] as? Int64 }
    guard let index = ids.firstIndex(of: currentID) else { return nil }
    return (index + 1, ids.count)
}

// MARK: - Space switching by simulating the Mission Control Ctrl+N shortcuts.

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

// MARK: - App

final class AppDelegate: NSObject, NSApplicationDelegate, WKUIDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    let spaceLabel = NSTextField(labelWithString: "Current space: …")
    let axLabel = NSTextField(labelWithString: "")

    static let workflowyURL = URL(string: "https://workflowy.com/#/918d3ae85711")!

    func applicationDidFinishLaunching(_ notification: Notification) {
        let trusted = AXIsProcessTrustedWithOptions(
            ["AXTrustedCheckOptionPrompt": true] as CFDictionary)
        axLabel.stringValue = trusted
            ? "Accessibility: granted ✓"
            : "Accessibility: NOT granted — enable in System Settings › Privacy & Security › Accessibility, then relaunch"
        axLabel.textColor = trusted ? .systemGreen : .systemRed

        buildWindow()
        NSApp.activate(ignoringOtherApps: true)

        Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            if let info = currentSpaceInfo() {
                self?.spaceLabel.stringValue = "Current space: \(info.current) of \(info.total)"
            } else {
                self?.spaceLabel.stringValue = "Current space: unknown (fullscreen app or private API unavailable)"
            }
        }
    }

    private func buildWindow() {
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 440, height: 720),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: false)
        window.title = "Doro Spaces POC"
        window.center()
        window.isReleasedWhenClosed = false
        // The headline feature: this window follows you to every space.
        window.collectionBehavior = [.canJoinAllSpaces]

        let title = NSTextField(labelWithString: "Switch to space:")
        title.font = .boldSystemFont(ofSize: 13)

        let buttonRow = NSStackView()
        buttonRow.orientation = .horizontal
        buttonRow.spacing = 6
        for n in 1...6 {
            let button = NSButton(title: "\(n)", target: self, action: #selector(spaceButtonClicked(_:)))
            button.tag = n
            button.bezelStyle = .rounded
            buttonRow.addArrangedSubview(button)
        }

        let allSpacesCheck = NSButton(checkboxWithTitle: "Show this window on all spaces",
                                      target: self, action: #selector(toggleAllSpaces(_:)))
        allSpacesCheck.state = .on

        let floatCheck = NSButton(checkboxWithTitle: "Always on top",
                                  target: self, action: #selector(toggleFloat(_:)))

        spaceLabel.font = .monospacedDigitSystemFont(ofSize: 12, weight: .regular)
        axLabel.font = .systemFont(ofSize: 11)
        axLabel.lineBreakMode = .byWordWrapping
        axLabel.maximumNumberOfLines = 3
        axLabel.preferredMaxLayoutWidth = 340

        let stack = NSStackView(views: [title, buttonRow, allSpacesCheck, floatCheck, spaceLabel, axLabel])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 10
        stack.edgeInsets = NSEdgeInsets(top: 16, left: 20, bottom: 16, right: 20)
        stack.translatesAutoresizingMaskIntoConstraints = false

        // Workflowy pane. The default WKWebsiteDataStore persists cookies/localStorage
        // on disk, so a login survives relaunches — the app has its own browser profile.
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.applicationNameForUserAgent = "Version/26.0 Safari/605.1.15"
        webView = WKWebView(frame: .zero, configuration: config)
        webView.uiDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.load(URLRequest(url: Self.workflowyURL))

        let content = NSView()
        content.addSubview(stack)
        content.addSubview(webView)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: content.topAnchor),
            stack.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: content.trailingAnchor),
            webView.topAnchor.constraint(equalTo: stack.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: content.bottomAnchor),
        ])
        window.contentView = content
        window.makeKeyAndOrderFront(nil)
    }

    // Some logins (Google OAuth, etc.) try to open a popup window; load those
    // requests in the main web view instead of dropping them.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil {
            webView.load(navigationAction.request)
        }
        return nil
    }

    @objc func spaceButtonClicked(_ sender: NSButton) {
        switchToSpace(sender.tag)
    }

    @objc func toggleAllSpaces(_ sender: NSButton) {
        if sender.state == .on {
            window.collectionBehavior.insert(.canJoinAllSpaces)
        } else {
            window.collectionBehavior.remove(.canJoinAllSpaces)
        }
    }

    @objc func toggleFloat(_ sender: NSButton) {
        window.level = sender.state == .on ? .floating : .normal
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = AppDelegate()
app.delegate = delegate
app.run()
