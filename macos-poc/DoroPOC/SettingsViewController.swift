import AppKit
import ApplicationServices

final class SettingsViewController: NSViewController, NSTableViewDataSource, NSTableViewDelegate {
    private let store: TaskStore
    var onTasksChanged: (() -> Void)?
    var onSessionMinutesChanged: (() -> Void)?
    var onStartTask: ((Int) -> Void)?
    var onToggleAllSpaces: ((Bool) -> Void)?
    var onToggleFloat: ((Bool) -> Void)?
    var onEditTime: ((Int) -> Void)?

    private let tableView = NSTableView()
    private var minutesField: NSTextField!
    private var apiKeyField: NSTextField!
    private let keySavedLabel = NSTextField(labelWithString: "API key saved ✓")
    private var changeKeyButton: NSButton!
    private var isEditingApiKey = false
    private var parentField: NSTextField!
    private var importButton: NSButton!
    private let importStatus = NSTextField(labelWithString: "")
    private let tsvStatus = NSTextField(labelWithString: "")
    private let webResolver = WorkflowyWebResolver()

    init(store: TaskStore) {
        self.store = store
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    override func loadView() {
        for (id, title, width) in [("done", "✓", 24.0), ("name", "Task", 130.0), ("time", "Time", 56.0), ("space", "Space", 52.0), ("url", "URL", 140.0)] {
            let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier(id))
            column.title = title
            column.width = width
            tableView.addTableColumn(column)
        }
        tableView.dataSource = self
        tableView.delegate = self
        tableView.usesAlternatingRowBackgroundColors = true
        tableView.allowsMultipleSelection = false

        let scroll = NSScrollView()
        scroll.documentView = tableView
        scroll.hasVerticalScroller = true
        scroll.borderType = .bezelBorder
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.heightAnchor.constraint(greaterThanOrEqualToConstant: 180).isActive = true

        let addButton = symbolButton("plus", tooltip: "Add task", target: self, action: #selector(addTask))
        let removeButton = symbolButton("minus", tooltip: "Remove selected task", target: self, action: #selector(removeTask))
        let upButton = symbolButton("arrow.up", tooltip: "Move task up", target: self, action: #selector(moveTaskUp))
        let downButton = symbolButton("arrow.down", tooltip: "Move task down", target: self, action: #selector(moveTaskDown))
        let startButton = symbolButton("play.fill", tooltip: "Start selected task", target: self, action: #selector(startSelected))
        let setSpaceButton = symbolButton("pin.fill", tooltip: "Set selected task's space to this desktop", target: self, action: #selector(setSpaceToCurrent))
        let goToSpaceButton = symbolButton("arrow.right.to.line", tooltip: "Go to selected task's space", target: self, action: #selector(goToSpace))
        let editTimeButton = symbolButton("clock", tooltip: "Edit recorded time for selected task", target: self, action: #selector(editRecordedTime))
        let buttonRow = NSStackView(views: [addButton, removeButton, upButton, downButton, startButton, setSpaceButton, goToSpaceButton, editTimeButton])
        buttonRow.orientation = .horizontal
        buttonRow.spacing = 6

        let hint = NSTextField(labelWithString: "Edit cells directly; press Return to commit. ✓ = complete (Next skips checked).")
        hint.font = .systemFont(ofSize: 11)
        hint.textColor = .secondaryLabelColor

        // Session length
        minutesField = NSTextField(string: String(store.sessionMinutes))
        minutesField.widthAnchor.constraint(equalToConstant: 44).isActive = true
        minutesField.target = self
        minutesField.action = #selector(minutesEdited)
        minutesField.cell?.sendsActionOnEndEditing = true
        let minutesRow = NSStackView(views: [NSTextField(labelWithString: "Session minutes:"), minutesField])
        minutesRow.orientation = .horizontal
        minutesRow.spacing = 6

        // Copy TSV
        let tsvButton = NSButton(title: "Copy TSV to Clipboard", target: self, action: #selector(copyTSV))
        tsvButton.bezelStyle = .rounded
        tsvStatus.font = .systemFont(ofSize: 11)
        tsvStatus.textColor = .secondaryLabelColor
        let tsvRow = NSStackView(views: [tsvButton, tsvStatus])
        tsvRow.orientation = .horizontal
        tsvRow.spacing = 8

        // Workflowy import
        apiKeyField = NSSecureTextField(string: store.workflowyApiKey)
        apiKeyField.placeholderString = "Workflowy API key"
        parentField = NSTextField(string: store.workflowyParentInput)
        parentField.placeholderString = "Parent node URL or id"
        [apiKeyField, parentField].forEach {
            $0.widthAnchor.constraint(equalToConstant: 300).isActive = true
            $0.target = self
            $0.action = #selector(workflowyFieldsEdited)
            $0.cell?.sendsActionOnEndEditing = true
        }
        keySavedLabel.font = .systemFont(ofSize: 11)
        keySavedLabel.textColor = .secondaryLabelColor
        changeKeyButton = NSButton(title: "Change…", target: self, action: #selector(changeApiKey))
        changeKeyButton.bezelStyle = .rounded
        changeKeyButton.controlSize = .small
        let apiKeyRow = NSStackView(views: [apiKeyField, keySavedLabel, changeKeyButton])
        apiKeyRow.orientation = .horizontal
        apiKeyRow.spacing = 8
        updateApiKeyRow()

        importButton = NSButton(title: "Import from Workflowy", target: self, action: #selector(importFromWorkflowy))
        importButton.bezelStyle = .rounded
        importStatus.font = .systemFont(ofSize: 11)
        importStatus.textColor = .secondaryLabelColor
        importStatus.lineBreakMode = .byTruncatingTail
        importStatus.maximumNumberOfLines = 1
        importStatus.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

        let workflowyTitle = NSTextField(labelWithString: "Workflowy")
        workflowyTitle.font = .boldSystemFont(ofSize: 12)
        let importRow = NSStackView(views: [importButton, importStatus])
        importRow.orientation = .horizontal
        importRow.spacing = 8

        // Window options
        let allSpacesCheck = NSButton(checkboxWithTitle: "Show window on all spaces",
                                      target: self, action: #selector(allSpacesToggled(_:)))
        allSpacesCheck.state = .on
        let floatCheck = NSButton(checkboxWithTitle: "Always on top",
                                  target: self, action: #selector(floatToggled(_:)))

        let axLabel = NSTextField(labelWithString: AXIsProcessTrusted()
            ? "Accessibility: granted ✓ (space switching will work)"
            : "Accessibility: NOT granted — space switching disabled. Grant in System Settings › Privacy & Security › Accessibility, then relaunch.")
        axLabel.font = .systemFont(ofSize: 11)
        axLabel.textColor = AXIsProcessTrusted() ? .systemGreen : .systemRed
        axLabel.lineBreakMode = .byWordWrapping
        axLabel.maximumNumberOfLines = 3
        axLabel.preferredMaxLayoutWidth = 380

        let stack = NSStackView(views: [scroll, buttonRow, hint, minutesRow, tsvRow,
                                        workflowyTitle, apiKeyRow, parentField, importRow,
                                        allSpacesCheck, floatCheck, axLabel])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 10
        stack.setCustomSpacing(18, after: tsvRow)
        stack.edgeInsets = NSEdgeInsets(top: 16, left: 20, bottom: 16, right: 20)
        stack.translatesAutoresizingMaskIntoConstraints = false
        scroll.widthAnchor.constraint(equalTo: stack.widthAnchor, constant: -40).isActive = true

        let root = NSView()
        root.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: root.topAnchor),
            stack.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: root.bottomAnchor),
        ])
        view = root
    }

    // MARK: - Table data

    func numberOfRows(in tableView: NSTableView) -> Int { store.tasks.count }

    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        guard let columnID = tableColumn?.identifier.rawValue else { return nil }
        let task = store.tasks[row]
        if columnID == "done" {
            let check = NSButton(checkboxWithTitle: "", target: self, action: #selector(completedToggled(_:)))
            check.state = task.completed ? .on : .off
            return check
        }
        if columnID == "space" {
            let popup = NSPopUpButton(frame: .zero, pullsDown: false)
            popup.addItems(withTitles: (1...8).map(String.init))
            popup.selectItem(at: min(max(task.space, 1), 8) - 1)
            popup.controlSize = .small
            popup.font = .systemFont(ofSize: 11)
            popup.isBordered = false
            popup.target = self
            popup.action = #selector(spacePicked(_:))
            return popup
        }
        let field = NSTextField(string: "")
        field.isBordered = false
        field.drawsBackground = false
        field.isEditable = true
        field.lineBreakMode = .byTruncatingTail
        field.font = .systemFont(ofSize: 12)
        field.target = self
        field.action = #selector(cellEdited(_:))
        field.cell?.sendsActionOnEndEditing = true
        switch columnID {
        case "name": field.stringValue = task.name
        case "url": field.stringValue = task.url
        case "time":
            field.stringValue = formatRecordedTime(seconds: task.seconds)
            field.isEditable = false
            field.textColor = .secondaryLabelColor
        default: break
        }
        return field
    }

    /// Refresh the table from outside (e.g. the timer page completed a task).
    func reloadTable() {
        tableView.reloadData()
    }

    @objc private func cellEdited(_ sender: NSTextField) {
        let row = tableView.row(for: sender)
        let column = tableView.column(for: sender)
        guard row >= 0, column >= 0, store.tasks.indices.contains(row) else { return }
        switch tableView.tableColumns[column].identifier.rawValue {
        case "name": store.tasks[row].name = sender.stringValue
        case "url": store.tasks[row].url = sender.stringValue
        default: break
        }
        store.save()
        onTasksChanged?()
    }

    @objc private func spacePicked(_ sender: NSPopUpButton) {
        let row = tableView.row(for: sender)
        guard store.tasks.indices.contains(row) else { return }
        store.tasks[row].space = sender.indexOfSelectedItem + 1
        store.save()
        onTasksChanged?()
    }

    @objc private func completedToggled(_ sender: NSButton) {
        let row = tableView.row(for: sender)
        guard store.tasks.indices.contains(row) else { return }
        let completed = sender.state == .on
        store.tasks[row].completed = completed
        store.save()
        onTasksChanged?()
        syncCompletionToWorkflowy(store: store, index: row, completed: completed)
    }

    // MARK: - Row actions

    @objc private func addTask() {
        store.tasks.append(DoroTask())
        store.clampIndex()
        store.save()
        tableView.reloadData()
        onTasksChanged?()
        let newRow = store.tasks.count - 1
        tableView.selectRowIndexes([newRow], byExtendingSelection: false)
        tableView.editColumn(1, row: newRow, with: nil, select: true) // column 1 = name (0 is the checkbox)
    }

    @objc private func removeTask() {
        let row = tableView.selectedRow
        guard store.tasks.indices.contains(row) else { return }
        store.tasks.remove(at: row)
        if store.currentIndex > row { store.currentIndex -= 1 }
        store.clampIndex()
        store.save()
        tableView.reloadData()
        onTasksChanged?()
    }

    @objc private func moveTaskUp() { moveSelected(by: -1) }
    @objc private func moveTaskDown() { moveSelected(by: 1) }

    private func moveSelected(by delta: Int) {
        let row = tableView.selectedRow
        let target = row + delta
        guard store.tasks.indices.contains(row), store.tasks.indices.contains(target) else { return }
        store.tasks.swapAt(row, target)
        // Keep the current-task pointer on the same task it was on.
        if store.currentIndex == row {
            store.currentIndex = target
        } else if store.currentIndex == target {
            store.currentIndex = row
        }
        store.save()
        tableView.reloadData()
        tableView.selectRowIndexes([target], byExtendingSelection: false)
        onTasksChanged?()
    }

    @objc private func startSelected() {
        let row = tableView.selectedRow
        guard store.tasks.indices.contains(row) else { return }
        onStartTask?(row)
    }

    /// The window follows you to every space, so "current" is whatever
    /// desktop you're standing on when you click — judged by the display
    /// the window is on, so it works docked or laptop-only.
    @objc private func setSpaceToCurrent() {
        let row = tableView.selectedRow
        let displayID = (view.window?.screen?
            .deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.uint32Value
        guard store.tasks.indices.contains(row),
              let info = currentSpaceInfo(displayID: displayID), (1...9).contains(info.current) else {
            NSSound.beep() // no row selected, fullscreen space, or private API gone
            return
        }
        store.tasks[row].space = info.current
        store.save()
        tableView.reloadData()
        tableView.selectRowIndexes([row], byExtendingSelection: false)
        onTasksChanged?()
    }

    @objc private func goToSpace() {
        let row = tableView.selectedRow
        guard store.tasks.indices.contains(row) else { NSSound.beep(); return }
        switchToSpace(store.tasks[row].space)
    }

    @objc private func editRecordedTime() {
        let row = tableView.selectedRow
        guard store.tasks.indices.contains(row) else { NSSound.beep(); return }
        onEditTime?(row)
    }

    // MARK: - Session length

    @objc private func minutesEdited() {
        if let minutes = Int(minutesField.stringValue), (1...180).contains(minutes) {
            store.sessionMinutes = minutes
            store.save()
            onSessionMinutesChanged?()
        } else {
            minutesField.stringValue = String(store.sessionMinutes)
        }
    }

    // MARK: - TSV export

    @objc private func copyTSV() {
        let rows = store.tasks.map { task in
            "\(task.name)\t\(String(format: "%.2f", Double(task.seconds) / 3600))"
        }
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(rows.joined(separator: "\n"), forType: .string)
        tsvStatus.stringValue = "Copied \(rows.count) rows"
    }

    // MARK: - Workflowy import

    /// The API key field collapses to "saved ✓" once a key is stored; the
    /// key only needs entering once.
    private func updateApiKeyRow() {
        let showField = store.workflowyApiKey.isEmpty || isEditingApiKey
        apiKeyField.isHidden = !showField
        keySavedLabel.isHidden = showField
        changeKeyButton.isHidden = showField
    }

    @objc private func changeApiKey() {
        isEditingApiKey = true
        updateApiKeyRow()
        view.window?.makeFirstResponder(apiKeyField)
    }

    @objc private func workflowyFieldsEdited() {
        // Changing the parent invalidates the cached resolved node id.
        if parentField.stringValue != store.workflowyParentInput {
            store.workflowyParentId = ""
        }
        store.workflowyApiKey = apiKeyField.stringValue
        store.workflowyParentInput = parentField.stringValue
        store.save()
        if !store.workflowyApiKey.isEmpty { isEditingApiKey = false }
        updateApiKeyRow()
    }

    private func setImportStatus(_ message: String) {
        importStatus.stringValue = message
        importStatus.toolTip = message // full text on hover; the label truncates
    }

    /// Short ids resolve via the hidden web view first (one page load, uses
    /// the Timer pane's login); the API tree walk is the fallback.
    private func resolveParent(token: String, target: WorkflowyParentTarget) async throws -> String {
        guard case .short(let shortId) = target else {
            return try await Workflowy.resolveParentId(token: token, target: target)
        }
        setImportStatus("Resolving node…")
        if let id = await webResolver.resolve(shortId: shortId) {
            return id
        }
        return try await Workflowy.resolveParentId(token: token, target: target) { searched in
            Task { @MainActor in
                self.setImportStatus("Finding node… (\(searched) lists searched)")
            }
        }
    }

    @objc private func importFromWorkflowy() {
        workflowyFieldsEdited()
        let token = store.workflowyApiKey.trimmingCharacters(in: .whitespaces)
        guard !token.isEmpty else {
            setImportStatus("Enter your Workflowy API key first")
            return
        }
        guard let target = Workflowy.parseParentInput(store.workflowyParentInput) else {
            setImportStatus("Couldn't parse that node URL / id")
            return
        }
        importButton.isEnabled = false
        setImportStatus("Importing…")
        Task { @MainActor in
            defer { importButton.isEnabled = true }
            let cachedId = store.workflowyParentId
            do {
                let parentId: String
                if !cachedId.isEmpty {
                    parentId = cachedId
                } else {
                    parentId = try await resolveParent(token: token, target: target)
                    store.workflowyParentId = parentId
                    store.save()
                }
                let nodes = try await Workflowy.listChildren(token: token, parentId: parentId)
                    .filter { $0.completedAt == nil }
                    .sorted { ($0.priority ?? 0) < ($1.priority ?? 0) }
                // Re-import adds new nodes and refreshes names of known ones
                // (matched by node URL); it never removes tasks.
                let indexByURL = Dictionary(store.tasks.enumerated().map { ($0.element.url, $0.offset) },
                                            uniquingKeysWith: { first, _ in first })
                var added = 0, renamed = 0
                for node in nodes {
                    let url = Workflowy.nodeURL(for: node.id)
                    let name = Workflowy.stripTags(node.name ?? "")
                    if let existing = indexByURL[url] {
                        if store.tasks[existing].workflowyId == nil {
                            store.tasks[existing].workflowyId = node.id
                        }
                        if store.tasks[existing].name != name {
                            store.tasks[existing].name = name
                            renamed += 1
                        }
                    } else {
                        var task = DoroTask()
                        task.name = name
                        task.url = url
                        task.workflowyId = node.id
                        store.tasks.append(task)
                        added += 1
                    }
                }
                store.clampIndex()
                store.save()
                tableView.reloadData()
                onTasksChanged?()
                var summary = "Imported \(added) new task\(added == 1 ? "" : "s")"
                if renamed > 0 { summary += ", renamed \(renamed)" }
                setImportStatus(summary)
            } catch {
                // A cached id can go stale (node deleted/moved); clear it so
                // the next attempt re-resolves from scratch.
                if !cachedId.isEmpty {
                    store.workflowyParentId = ""
                    store.save()
                }
                setImportStatus(error.localizedDescription)
            }
        }
    }

    // MARK: - Window options

    @objc private func allSpacesToggled(_ sender: NSButton) {
        onToggleAllSpaces?(sender.state == .on)
    }

    @objc private func floatToggled(_ sender: NSButton) {
        onToggleFloat?(sender.state == .on)
    }
}
