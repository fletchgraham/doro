import AppKit
import ApplicationServices

final class SettingsViewController: NSViewController, NSTableViewDataSource, NSTableViewDelegate {
    private let store: TaskStore
    var onTasksChanged: (() -> Void)?
    var onSessionMinutesChanged: (() -> Void)?
    var onStartTask: ((Int) -> Void)?
    var onToggleAllSpaces: ((Bool) -> Void)?
    var onToggleFloat: ((Bool) -> Void)?

    private let tableView = NSTableView()
    private var minutesField: NSTextField!
    private var apiKeyField: NSTextField!
    private var parentField: NSTextField!
    private var importButton: NSButton!
    private let importStatus = NSTextField(labelWithString: "")

    init(store: TaskStore) {
        self.store = store
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    override func loadView() {
        for (id, title, width) in [("name", "Task", 140.0), ("url", "URL", 200.0), ("space", "Space", 44.0)] {
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

        let addButton = NSButton(title: "+", target: self, action: #selector(addTask))
        let removeButton = NSButton(title: "−", target: self, action: #selector(removeTask))
        let upButton = NSButton(title: "↑", target: self, action: #selector(moveTaskUp))
        let downButton = NSButton(title: "↓", target: self, action: #selector(moveTaskDown))
        let startButton = NSButton(title: "Start Selected Task", target: self, action: #selector(startSelected))
        [addButton, removeButton, upButton, downButton, startButton].forEach { $0.bezelStyle = .rounded }
        let buttonRow = NSStackView(views: [addButton, removeButton, upButton, downButton, startButton])
        buttonRow.orientation = .horizontal
        buttonRow.spacing = 6

        let hint = NSTextField(labelWithString: "Edit cells directly; press Return to commit. Row order = task order.")
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
        importButton = NSButton(title: "Import from Workflowy", target: self, action: #selector(importFromWorkflowy))
        importButton.bezelStyle = .rounded
        importStatus.font = .systemFont(ofSize: 11)
        importStatus.textColor = .secondaryLabelColor
        importStatus.lineBreakMode = .byWordWrapping
        importStatus.maximumNumberOfLines = 2
        importStatus.preferredMaxLayoutWidth = 380

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

        let stack = NSStackView(views: [scroll, buttonRow, hint, minutesRow, tsvButton,
                                        workflowyTitle, apiKeyField, parentField, importRow,
                                        allSpacesCheck, floatCheck, axLabel])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 10
        stack.setCustomSpacing(18, after: tsvButton)
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
        case "space": field.stringValue = String(task.space)
        default: break
        }
        return field
    }

    @objc private func cellEdited(_ sender: NSTextField) {
        let row = tableView.row(for: sender)
        let column = tableView.column(for: sender)
        guard row >= 0, column >= 0, store.tasks.indices.contains(row) else { return }
        switch tableView.tableColumns[column].identifier.rawValue {
        case "name": store.tasks[row].name = sender.stringValue
        case "url": store.tasks[row].url = sender.stringValue
        case "space":
            if let space = Int(sender.stringValue), (1...9).contains(space) {
                store.tasks[row].space = space
            } else {
                sender.stringValue = String(store.tasks[row].space)
            }
        default: break
        }
        store.save()
        onTasksChanged?()
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
        tableView.editColumn(0, row: newRow, with: nil, select: true)
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
        importStatus.stringValue = "Copied \(rows.count) rows"
    }

    // MARK: - Workflowy import

    @objc private func workflowyFieldsEdited() {
        store.workflowyApiKey = apiKeyField.stringValue
        store.workflowyParentInput = parentField.stringValue
        store.save()
    }

    @objc private func importFromWorkflowy() {
        workflowyFieldsEdited()
        let token = store.workflowyApiKey.trimmingCharacters(in: .whitespaces)
        guard !token.isEmpty else {
            importStatus.stringValue = "Enter your Workflowy API key first"
            return
        }
        guard let target = Workflowy.parseParentInput(store.workflowyParentInput) else {
            importStatus.stringValue = "Couldn't parse that node URL / id"
            return
        }
        importButton.isEnabled = false
        importStatus.stringValue = "Importing…"
        Task { @MainActor in
            defer { importButton.isEnabled = true }
            do {
                let parentId = try await Workflowy.resolveParentId(token: token, target: target)
                let nodes = try await Workflowy.listChildren(token: token, parentId: parentId)
                    .sorted { ($0.priority ?? 0) < ($1.priority ?? 0) }
                for node in nodes {
                    var task = DoroTask()
                    task.name = Workflowy.stripTags(node.name ?? "")
                    task.url = Workflowy.nodeURL(for: node.id)
                    store.tasks.append(task)
                }
                store.clampIndex()
                store.save()
                tableView.reloadData()
                onTasksChanged?()
                importStatus.stringValue = "Imported \(nodes.count) tasks"
            } catch {
                importStatus.stringValue = error.localizedDescription
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
