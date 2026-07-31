import AppKit
import ApplicationServices

final class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    let store = TaskStore()
    var timerVC: TimerViewController!
    var settingsVC: SettingsViewController!
    let container = NSView()
    var pageControl: NSSegmentedControl!

    func applicationDidFinishLaunching(_ notification: Notification) {
        _ = AXIsProcessTrustedWithOptions(["AXTrustedCheckOptionPrompt": true] as CFDictionary)

        store.load()
        timerVC = TimerViewController(store: store)
        settingsVC = SettingsViewController(store: store)
        settingsVC.onTasksChanged = { [weak self] in
            self?.timerVC.refreshFromStore(switchSpace: false)
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

        buildWindow()
        // First run with no tasks? Land on Settings.
        showPage(store.tasks.isEmpty ? 1 : 0)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func buildWindow() {
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 460, height: 760),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: false)
        window.title = "Doro"
        window.center()
        window.isReleasedWhenClosed = false
        window.collectionBehavior = [.canJoinAllSpaces]
        window.minSize = NSSize(width: 380, height: 500)

        pageControl = NSSegmentedControl(labels: ["Timer", "Settings"], trackingMode: .selectOne,
                                         target: self, action: #selector(pageChanged(_:)))
        pageControl.translatesAutoresizingMaskIntoConstraints = false
        container.translatesAutoresizingMaskIntoConstraints = false

        let content = NSView()
        content.addSubview(pageControl)
        content.addSubview(container)
        NSLayoutConstraint.activate([
            pageControl.topAnchor.constraint(equalTo: content.topAnchor, constant: 10),
            pageControl.centerXAnchor.constraint(equalTo: content.centerXAnchor),
            container.topAnchor.constraint(equalTo: pageControl.bottomAnchor, constant: 8),
            container.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            container.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            container.bottomAnchor.constraint(equalTo: content.bottomAnchor),
        ])
        window.contentView = content
        window.makeKeyAndOrderFront(nil)
    }

    @objc private func pageChanged(_ sender: NSSegmentedControl) {
        showPage(sender.selectedSegment)
    }

    private func showPage(_ index: Int) {
        pageControl.selectedSegment = index
        if index == 1 { timerVC.pause() }
        container.subviews.forEach { $0.removeFromSuperview() }
        let pageView = (index == 0 ? timerVC : settingsVC as NSViewController).view
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
