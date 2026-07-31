import AppKit
import WebKit

final class TimerViewController: NSViewController, WKUIDelegate, WKNavigationDelegate {
    private let store: TaskStore

    private var sessionLength: Int { store.sessionMinutes * 60 }
    private var remaining: Int
    private var running = false
    private var tick: Timer?
    private var alarmTimer: Timer?

    private let taskLabel = NSTextField(labelWithString: "")
    private let countdownLabel = NSTextField(labelWithString: "")
    private let totalLabel = NSTextField(labelWithString: "")
    private var startPauseButton: NSButton!
    private var resetButton: NSButton!
    private var nextButton: NSButton!
    private var webView: WKWebView!
    private var loadedURL: String?

    init(store: TaskStore) {
        self.store = store
        self.remaining = store.sessionMinutes * 60
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    override func loadView() {
        taskLabel.font = .boldSystemFont(ofSize: 16)
        taskLabel.lineBreakMode = .byTruncatingTail

        countdownLabel.font = .monospacedDigitSystemFont(ofSize: 52, weight: .light)
        countdownLabel.alignment = .center

        totalLabel.font = .monospacedDigitSystemFont(ofSize: 12, weight: .regular)
        totalLabel.textColor = .secondaryLabelColor

        startPauseButton = NSButton(title: "Start", target: self, action: #selector(startPauseClicked))
        resetButton = NSButton(title: "Reset", target: self, action: #selector(resetClicked))
        nextButton = NSButton(title: "Next Task →", target: self, action: #selector(nextClicked))
        [startPauseButton, resetButton, nextButton].forEach { $0.bezelStyle = .rounded }

        let buttonRow = NSStackView(views: [startPauseButton, resetButton, nextButton])
        buttonRow.orientation = .horizontal
        buttonRow.spacing = 8

        // Persistent data store: Workflowy (or any site) login survives relaunches.
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.applicationNameForUserAgent = "Version/26.0 Safari/605.1.15"
        webView = WKWebView(frame: .zero, configuration: config)
        webView.uiDelegate = self
        webView.navigationDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false

        let header = NSStackView(views: [taskLabel, countdownLabel, totalLabel, buttonRow])
        header.orientation = .vertical
        header.alignment = .centerX
        header.spacing = 6
        header.edgeInsets = NSEdgeInsets(top: 12, left: 20, bottom: 12, right: 20)
        header.translatesAutoresizingMaskIntoConstraints = false

        let root = NSView()
        root.addSubview(header)
        root.addSubview(webView)
        NSLayoutConstraint.activate([
            header.topAnchor.constraint(equalTo: root.topAnchor),
            header.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            header.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            webView.topAnchor.constraint(equalTo: header.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: root.bottomAnchor),
        ])
        view = root
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        refreshFromStore(switchSpace: false)
    }

    /// Re-reads the current task: labels, web page, and optionally its space.
    func refreshFromStore(switchSpace: Bool) {
        guard let task = store.currentTask else {
            taskLabel.stringValue = "No tasks — add some in Settings"
            startPauseButton.isEnabled = false
            resetButton.isEnabled = false
            nextButton.isEnabled = false
            setRunning(false)
            stopAlarm()
            loadPage("")
            updateLabels()
            return
        }
        startPauseButton.isEnabled = true
        resetButton.isEnabled = true
        nextButton.isEnabled = true
        taskLabel.stringValue = task.name
        loadPage(task.url)
        updateLabels()
        if switchSpace { switchToSpace(task.space) }
    }

    /// Make the store's current task active: fresh timer, its space, running.
    func startCurrent() {
        stopAlarm()
        remaining = sessionLength
        refreshFromStore(switchSpace: true)
        setRunning(true)
    }

    /// Pause without resetting (used when the user opens Settings).
    func pause() {
        if running { setRunning(false) }
    }

    /// Session length setting changed; adopt it if we're not mid-countdown.
    func sessionMinutesChanged() {
        if !running {
            remaining = sessionLength
            updateLabels()
        }
    }

    @objc private func startPauseClicked() {
        stopAlarm()
        if !running && remaining <= 0 { remaining = sessionLength }
        setRunning(!running)
        if running, let task = store.currentTask { switchToSpace(task.space) }
    }

    @objc private func resetClicked() {
        stopAlarm()
        setRunning(false)
        remaining = sessionLength
        updateLabels()
    }

    @objc private func nextClicked() {
        store.advance()
        startCurrent()
    }

    private func setRunning(_ shouldRun: Bool) {
        running = shouldRun && store.currentTask != nil
        startPauseButton.title = running ? "Pause" : "Start"
        tick?.invalidate()
        tick = nil
        if running {
            tick = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
                self?.tickFired()
            }
        } else {
            store.save()
        }
    }

    private func tickFired() {
        remaining -= 1
        store.addSecondToCurrent()
        if remaining % 30 == 0 { store.save() }
        if remaining <= 0 {
            remaining = 0
            setRunning(false)
            startAlarm()
        }
        updateLabels()
    }

    private func updateLabels() {
        countdownLabel.stringValue = String(format: "%02d:%02d", remaining / 60, remaining % 60)
        if let task = store.currentTask {
            totalLabel.stringValue = "Total on this task: \(formatDuration(task.seconds))"
        } else {
            totalLabel.stringValue = ""
        }
    }

    private func formatDuration(_ s: Int) -> String {
        let h = s / 3600, m = (s % 3600) / 60, sec = s % 60
        return h > 0 ? String(format: "%dh %02dm", h, m) : String(format: "%dm %02ds", m, sec)
    }

    // MARK: - Alarm (rings until Reset / Start / Next)

    private func startAlarm() {
        stopAlarm()
        alarmTimer = Timer.scheduledTimer(withTimeInterval: 1.5, repeats: true) { _ in
            if let sound = NSSound(named: "Glass") {
                sound.play()
            } else {
                NSSound.beep()
            }
        }
        alarmTimer?.fire()
    }

    private func stopAlarm() {
        alarmTimer?.invalidate()
        alarmTimer = nil
    }

    // MARK: - Web view

    private func loadPage(_ urlString: String) {
        guard loadedURL != urlString else { return }
        loadedURL = urlString
        if let url = URL(string: urlString), url.scheme?.hasPrefix("http") == true {
            webView.load(URLRequest(url: url))
        } else {
            webView.loadHTMLString("<body style='font-family:sans-serif;color:#888;padding:2em'>No URL for this task</body>", baseURL: nil)
        }
    }

    // Clicked links that leave the current site open in the default browser;
    // same-site navigation (e.g. moving around Workflowy) stays in the pane.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if navigationAction.navigationType == .linkActivated,
           let url = navigationAction.request.url, url.host != nil,
           url.host != webView.url?.host {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    // Popup/new-window requests: same-site ones (some login flows) load in
    // place; external ones go to the default browser.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
            if url.host == webView.url?.host {
                webView.load(navigationAction.request)
            } else {
                NSWorkspace.shared.open(url)
            }
        }
        return nil
    }
}
