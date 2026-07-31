import AppKit
import ApplicationServices

/// Best-effort mirror of a task's completed state to Workflowy. Imported
/// tasks carry the full node UUID; older ones get it backfilled by listing
/// the cached parent and matching the url's short id. Failures are silent —
/// doro's own state is the source of truth.
func syncCompletionToWorkflowy(store: TaskStore, index: Int, completed: Bool) {
    let token = store.workflowyApiKey.trimmingCharacters(in: .whitespaces)
    guard !token.isEmpty, store.tasks.indices.contains(index) else { return }
    let taskId = store.tasks[index].id
    let url = store.tasks[index].url
    let knownNodeId = store.tasks[index].workflowyId
    Task { @MainActor in
        var nodeId = knownNodeId
        if nodeId == nil,
           case .short(let shortId)? = Workflowy.parseParentInput(url),
           !store.workflowyParentId.isEmpty,
           let children = try? await Workflowy.listChildren(token: token, parentId: store.workflowyParentId) {
            nodeId = children.first {
                $0.id.replacingOccurrences(of: "-", with: "").lowercased().hasSuffix(shortId)
            }?.id
            if let nodeId, let current = store.tasks.firstIndex(where: { $0.id == taskId }) {
                store.tasks[current].workflowyId = nodeId
                store.save()
            }
        }
        guard let nodeId else { return }
        try? await Workflowy.setCompleted(token: token, nodeId: nodeId, completed: completed)
    }
}

/// Compact icon button (SF Symbol) with a tooltip; falls back to a title
/// button if the symbol is missing.
func symbolButton(_ symbol: String, tooltip: String, target: AnyObject?, action: Selector) -> NSButton {
    let button: NSButton
    if let image = NSImage(systemSymbolName: symbol, accessibilityDescription: tooltip) {
        button = NSButton(image: image, target: target, action: action)
    } else {
        button = NSButton(title: tooltip, target: target, action: action)
    }
    button.bezelStyle = .rounded
    button.toolTip = tooltip
    return button
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSTextFieldDelegate {
    var window: NSWindow!
    let store = TaskStore()
    var timerVC: TimerViewController!
    var settingsVC: SettingsViewController!
    var statsVC: StatsViewController!
    let container = NSView()
    var pageControl: NSSegmentedControl!

    // Slide-down recorded-time editor (shared by both pages).
    var timeEditorBar: NSStackView!
    var timeEditorLabel: NSTextField!
    var timeField: NSTextField!
    var editingIndex: Int?

    func applicationDidFinishLaunching(_ notification: Notification) {
        _ = AXIsProcessTrustedWithOptions(["AXTrustedCheckOptionPrompt": true] as CFDictionary)

        store.load()
        timerVC = TimerViewController(store: store)
        settingsVC = SettingsViewController(store: store)
        statsVC = StatsViewController(store: store)
        settingsVC.onTasksChanged = { [weak self] in
            self?.timerVC.refreshFromStore(switchSpace: false)
        }
        timerVC.onTasksEdited = { [weak self] in
            self?.settingsVC.reloadTable()
        }
        settingsVC.onEditTime = { [weak self] row in
            self?.beginTimeEdit(taskIndex: row)
        }
        timerVC.onEditTime = { [weak self] in
            guard let self else { return }
            self.beginTimeEdit(taskIndex: self.store.currentIndex)
        }
        settingsVC.onSessionMinutesChanged = { [weak self] in
            self?.timerVC.sessionMinutesChanged()
        }
        settingsVC.onStartTask = { [weak self] row in
            guard let self, self.store.tasks.indices.contains(row) else { return }
            self.store.currentIndex = row
            self.store.save()
            self.showPage(0)
            self.timerVC.startCurrent()
        }
        settingsVC.onToggleAllSpaces = { [weak self] on in
            guard let window = self?.window else { return }
            if on { window.collectionBehavior.insert(.canJoinAllSpaces) }
            else { window.collectionBehavior.remove(.canJoinAllSpaces) }
        }
        settingsVC.onToggleFloat = { [weak self] on in
            self?.window.level = on ? .floating : .normal
        }

        buildMenu()
        buildWindow()
        // First run with no tasks? Land on Settings.
        showPage(store.tasks.isEmpty ? 1 : 0)
        NSApp.activate(ignoringOtherApps: true)
    }

    // Without a main menu, none of the standard editing key equivalents
    // (Cmd+V/C/X/A, Cmd+Q...) reach the app at all.
    private func buildMenu() {
        let mainMenu = NSMenu()

        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Hide Doro", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "Quit Doro", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        mainMenu.addItem(appItem)

        let editItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = editMenu
        mainMenu.addItem(editItem)

        let windowItem = NSMenuItem()
        let windowMenu = NSMenu(title: "Window")
        windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        windowItem.submenu = windowMenu
        mainMenu.addItem(windowItem)

        NSApp.mainMenu = mainMenu
    }

    private func buildWindow() {
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 520, height: 760),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: false)
        window.title = "Doro"
        window.center()
        window.isReleasedWhenClosed = false
        window.collectionBehavior = [.canJoinAllSpaces]
        window.minSize = NSSize(width: 380, height: 500)

        pageControl = NSSegmentedControl(labels: ["Timer", "Settings", "Stats"], trackingMode: .selectOne,
                                         target: self, action: #selector(pageChanged(_:)))

        // Recorded-time editor bar, hidden until a clock button opens it.
        timeEditorLabel = NSTextField(labelWithString: "")
        timeField = NSTextField(string: "")
        timeField.widthAnchor.constraint(equalToConstant: 90).isActive = true
        timeField.placeholderString = "1h 30m"
        timeField.delegate = self
        timeField.target = self
        timeField.action = #selector(saveTimeEdit)
        let saveButton = NSButton(title: "Save", target: self, action: #selector(saveTimeEdit))
        let cancelButton = NSButton(title: "Cancel", target: self, action: #selector(cancelTimeEdit))
        [saveButton, cancelButton].forEach { $0.bezelStyle = .rounded; $0.controlSize = .small }
        timeEditorBar = NSStackView(views: [timeEditorLabel, timeField, saveButton, cancelButton])
        timeEditorBar.orientation = .horizontal
        timeEditorBar.spacing = 6
        timeEditorBar.isHidden = true

        let rootStack = NSStackView(views: [pageControl, timeEditorBar, container])
        rootStack.orientation = .vertical
        rootStack.alignment = .centerX
        rootStack.spacing = 8
        rootStack.edgeInsets = NSEdgeInsets(top: 10, left: 0, bottom: 0, right: 0)
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        container.setContentHuggingPriority(.defaultLow, for: .vertical)

        let content = NSView()
        content.addSubview(rootStack)
        NSLayoutConstraint.activate([
            rootStack.topAnchor.constraint(equalTo: content.topAnchor),
            rootStack.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            rootStack.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            rootStack.bottomAnchor.constraint(equalTo: content.bottomAnchor),
            container.widthAnchor.constraint(equalTo: rootStack.widthAnchor),
        ])
        window.contentView = content
        window.makeKeyAndOrderFront(nil)
    }

    // MARK: - Recorded-time editor

    private func beginTimeEdit(taskIndex: Int) {
        guard store.tasks.indices.contains(taskIndex) else { NSSound.beep(); return }
        editingIndex = taskIndex
        timeEditorLabel.stringValue = "Time on “\(store.tasks[taskIndex].name)”:"
        timeField.stringValue = formatRecordedTime(seconds: store.tasks[taskIndex].seconds)
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.2
            context.allowsImplicitAnimation = true
            timeEditorBar.animator().isHidden = false
        }
        window.makeFirstResponder(timeField)
    }

    @objc private func saveTimeEdit() {
        guard let index = editingIndex, store.tasks.indices.contains(index) else {
            dismissTimeEdit()
            return
        }
        guard let seconds = parseRecordedTime(timeField.stringValue) else {
            NSSound.beep() // unparseable — leave the editor open to fix it
            return
        }
        store.tasks[index].seconds = seconds
        store.save()
        settingsVC.reloadTable()
        timerVC.refreshFromStore(switchSpace: false)
        dismissTimeEdit()
    }

    @objc private func cancelTimeEdit() {
        dismissTimeEdit()
    }

    private func dismissTimeEdit() {
        editingIndex = nil
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.2
            context.allowsImplicitAnimation = true
            timeEditorBar.animator().isHidden = true
        }
    }

    // Esc in the time field cancels the edit.
    func control(_ control: NSControl, textView: NSTextView, doCommandBy commandSelector: Selector) -> Bool {
        if control == timeField, commandSelector == #selector(NSResponder.cancelOperation(_:)) {
            cancelTimeEdit()
            return true
        }
        return false
    }

    @objc private func pageChanged(_ sender: NSSegmentedControl) {
        showPage(sender.selectedSegment)
        // Landing on the Timer page means "get to work": start ticking.
        if sender.selectedSegment == 0 { timerVC.resume() }
    }

    private func showPage(_ index: Int) {
        pageControl.selectedSegment = index
        if index == 1 {
            timerVC.pause()
            settingsVC.reloadTable()
        }
        if index == 2 { statsVC.refresh() }
        container.subviews.forEach { $0.removeFromSuperview() }
        let pages: [NSViewController] = [timerVC, settingsVC, statsVC]
        let pageView = pages[index].view
        pageView.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(pageView)
        NSLayoutConstraint.activate([
            pageView.topAnchor.constraint(equalTo: container.topAnchor),
            pageView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            pageView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            pageView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])
        if index == 0 { timerVC.refreshFromStore(switchSpace: false) }
    }

    func applicationWillTerminate(_ notification: Notification) {
        store.save()
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
