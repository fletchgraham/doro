import WebKit

// Resolves a workflowy short id to a full node UUID by loading the node's
// page in a hidden WKWebView and asking the page for the zoomed item's id.
// The web view shares the Timer pane's website data store, so it rides the
// same logged-in session. One page load (~1-2s) instead of one API request
// per node in the tree — Workflowy.resolveParentId is the fallback when the
// page gives nothing up (logged out, frontend changed, bad short id).
@MainActor
final class WorkflowyWebResolver {
    private var webView: WKWebView?

    // WF is workflowy's in-page scripting API (the sturdier hook); the
    // projectid DOM attribute is the backup. Returns null until the SPA
    // has booted and zoomed to the node.
    private static let extractJS = """
    (function(){
      try {
        if (typeof WF !== 'undefined' && WF.currentItem) {
          var id = WF.currentItem().getId();
          if (id) return id;
        }
      } catch (e) {}
      var root = document.querySelector('.project.root');
      return root ? root.getAttribute('projectid') : null;
    })()
    """

    /// Returns the node's full UUID, or nil if the page didn't produce one
    /// in time. The result is only accepted if its hex suffix matches the
    /// short id, so a redirect to home/"not found" can't return a wrong node.
    func resolve(shortId: String, timeout: TimeInterval = 12) async -> String? {
        guard let url = URL(string: "https://workflowy.com/#/\(shortId)") else { return nil }
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.applicationNameForUserAgent = "Version/26.0 Safari/605.1.15"
        let webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 1024, height: 768), configuration: config)
        self.webView = webView
        defer { self.webView = nil } // one-shot; don't keep the SPA in memory
        webView.load(URLRequest(url: url))

        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            try? await Task.sleep(nanoseconds: 500_000_000)
            let result = await evaluate(Self.extractJS, in: webView)
            if let id = (result as? String)?.lowercased(),
               id.range(of: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                        options: .regularExpression) != nil,
               id.replacingOccurrences(of: "-", with: "").hasSuffix(shortId.lowercased()) {
                return id
            }
        }
        return nil
    }

    // The completion-handler variant, wrapped: the async overload of
    // evaluateJavaScript traps when the script returns null.
    private func evaluate(_ js: String, in webView: WKWebView) async -> Any? {
        await withCheckedContinuation { continuation in
            webView.evaluateJavaScript(js) { result, _ in
                continuation.resume(returning: result)
            }
        }
    }
}
