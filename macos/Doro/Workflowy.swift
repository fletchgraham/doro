import Foundation

// Direct client for the official Workflowy API v1 (the web app proxies the
// same calls through vercel only for CORS; a native app can go straight there).
// The API lives on the beta host (https://beta.workflowy.com/api-reference):
// same account data as workflowy.com, but new features such as mirror
// details in node responses land there first.
private let apiBase = "https://beta.workflowy.com/api/v1"

struct WorkflowyNode: Decodable {
    let id: String
    let name: String?
    let priority: Int?
    let completedAt: Double?
    /// Id of the node this one mirrors; nil for a regular node (an original
    /// that has mirrors elsewhere counts as regular). Mirrors are listed as
    /// their own node with an empty name, and which field carries the
    /// original's id depends on the API version, so this accepts the same
    /// shapes as the web app's `getMirrorOriginalId`: `data.mirror.originalId`
    /// (the export/backup shape), a top-level `mirror` object, or a flat id.
    let mirrorOriginalId: String?

    /// The id fields a response might use for "the node this mirror shows".
    private struct OriginalIdFields: Decodable {
        let originalId: String?
        let original_id: String?
        let originalNodeId: String?
        let original_node_id: String?
        let mirrorOf: String?
        let mirror_of: String?

        var first: String? {
            [originalId, original_id, originalNodeId, original_node_id, mirrorOf, mirror_of]
                .compactMap { $0 }
                .first { !$0.isEmpty }
        }
    }

    private struct DataFields: Decodable {
        let mirror: OriginalIdFields?
        let flat: OriginalIdFields?

        private enum CodingKeys: String, CodingKey { case mirror }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            mirror = (try? c.decodeIfPresent(OriginalIdFields.self, forKey: .mirror)) ?? nil
            flat = try? OriginalIdFields(from: decoder)
        }
    }

    private enum CodingKeys: String, CodingKey {
        case id, name, priority, completedAt, data, mirror
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decodeIfPresent(String.self, forKey: .name)
        priority = try c.decodeIfPresent(Int.self, forKey: .priority)
        completedAt = try c.decodeIfPresent(Double.self, forKey: .completedAt)

        let data = (try? c.decodeIfPresent(DataFields.self, forKey: .data)) ?? nil
        let mirror = (try? c.decodeIfPresent(OriginalIdFields.self, forKey: .mirror)) ?? nil
        let flat = try? OriginalIdFields(from: decoder)
        let original = data?.mirror?.first ?? mirror?.first ?? data?.flat?.first ?? flat?.first
        mirrorOriginalId = (original == nil || original == id) ? nil : original
    }

    var hasBlankName: Bool { Workflowy.stripTags(name ?? "").isEmpty }
}

enum WorkflowyParentTarget {
    case uuid(String)
    case short(String)
}

enum WorkflowyError: LocalizedError {
    case badParentInput
    case nodeNotFound
    case badResponse
    case http(Int)

    var errorDescription: String? {
        switch self {
        case .badParentInput:
            return "Couldn't parse that node URL / id"
        case .nodeNotFound:
            return "Couldn't find that node — try pasting its full UUID"
        case .badResponse:
            return "Unexpected response from the Workflowy API"
        case .http(401):
            return "Invalid Workflowy API key"
        case .http(429):
            return "Workflowy rate limit hit — wait a minute and retry"
        case .http(let code):
            return "Workflowy API error \(code)"
        }
    }
}

enum Workflowy {
    static func listChildren(token: String, parentId: String?) async throws -> [WorkflowyNode] {
        var components = URLComponents(string: "\(apiBase)/nodes")!
        if let parentId {
            components.queryItems = [URLQueryItem(name: "parent_id", value: parentId)]
        }
        var request = URLRequest(url: components.url!)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode != 200 {
            throw WorkflowyError.http(http.statusCode)
        }
        if let nodes = try? JSONDecoder().decode([WorkflowyNode].self, from: data) {
            return nodes
        }
        struct Wrapper: Decodable { let nodes: [WorkflowyNode] }
        if let wrapped = try? JSONDecoder().decode(Wrapper.self, from: data) {
            return wrapped.nodes
        }
        // A shape we don't recognize must surface as an error — returning []
        // here would masquerade as "node has no children" / "node not found".
        throw WorkflowyError.badResponse
    }

    /// Fetch a single node (GET /nodes/:id); the API wraps it as `{ node }`.
    static func getNode(token: String, id: String) async throws -> WorkflowyNode {
        var request = URLRequest(url: URL(string: "\(apiBase)/nodes/\(id)")!)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode != 200 {
            throw WorkflowyError.http(http.statusCode)
        }
        struct Wrapper: Decodable { let node: WorkflowyNode }
        if let wrapped = try? JSONDecoder().decode(Wrapper.self, from: data) {
            return wrapped.node
        }
        if let node = try? JSONDecoder().decode(WorkflowyNode.self, from: data) {
            return node
        }
        throw WorkflowyError.badResponse
    }

    /// A mirror's original could itself be reported as a mirror; don't chase forever.
    private static let mirrorHops = 3

    /// Follow a listed child to the node it mirrors, so the imported task gets
    /// the original's name and completion state (same logic as the web app's
    /// `resolveMirror`). A blank-named node with no original id in the listing
    /// is fetched on its own first, since the single-node endpoint may carry
    /// details the children listing leaves out. Anything that can't be
    /// resolved comes back unchanged, so one bad mirror doesn't sink the import.
    static func resolveMirror(token: String, node: WorkflowyNode) async -> WorkflowyNode {
        var current = node
        for _ in 0..<mirrorHops {
            let targetId: String
            if let originalId = current.mirrorOriginalId {
                targetId = originalId
            } else {
                if current.id != node.id || !current.hasBlankName { return current }
                targetId = current.id
            }
            guard let fetched = try? await getNode(token: token, id: targetId) else {
                return current
            }
            if targetId == current.id && fetched.hasBlankName && fetched.mirrorOriginalId == nil {
                return current // a genuinely empty node, not a mirror
            }
            current = fetched
        }
        return current
    }

    /// Mark a node complete / uncomplete.
    static func setCompleted(token: String, nodeId: String, completed: Bool) async throws {
        let op = completed ? "complete" : "uncomplete"
        var request = URLRequest(url: URL(string: "\(apiBase)/nodes/\(nodeId)/\(op)")!)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (_, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            throw WorkflowyError.http(http.statusCode)
        }
    }

    /// Accepts a full node UUID, a workflowy.com/#/xxxxxxxxxxxx link, or a
    /// bare 12-char short id (same inputs the web app accepts).
    static func parseParentInput(_ raw: String) -> WorkflowyParentTarget? {
        let input = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if input.range(of: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                       options: .regularExpression) != nil {
            return .uuid(input)
        }
        if let match = input.range(of: "workflowy\\.com/#/[0-9a-f]{12}\\b", options: .regularExpression) {
            return .short(String(input[match].suffix(12)))
        }
        if input.range(of: "^[0-9a-f]{12}$", options: .regularExpression) != nil {
            return .short(input)
        }
        return nil
    }

    /// Short ids from workflowy links are the last 12 hex chars of the node
    /// UUID; the API only lists children, so resolve by BFS from the root.
    /// `progress` is called with the running request count (this can take a
    /// minute on a big tree — one API request per node visited).
    static func resolveParentId(token: String, target: WorkflowyParentTarget,
                                progress: (@Sendable (Int) -> Void)? = nil) async throws -> String {
        switch target {
        case .uuid(let id):
            return id
        case .short(let shortId):
            var queue: [String?] = [nil] // nil = root
            var requests = 0
            while !queue.isEmpty && requests < 200 {
                let parentId = queue.removeFirst()
                requests += 1
                progress?(requests)
                let children = try await listChildren(token: token, parentId: parentId)
                for child in children {
                    if child.id.replacingOccurrences(of: "-", with: "").lowercased().hasSuffix(shortId) {
                        return child.id
                    }
                    queue.append(child.id)
                }
            }
            throw WorkflowyError.nodeNotFound
        }
    }

    /// Workflowy's internal links use the last 12 hex chars of the node id.
    static func nodeURL(for id: String) -> String {
        let hex = id.replacingOccurrences(of: "-", with: "").lowercased()
        return "https://workflowy.com/#/\(hex.suffix(12))"
    }

    /// Workflowy names can carry inline formatting tags; strip them.
    static func stripTags(_ value: String) -> String {
        value.replacingOccurrences(of: "<[^>]*>", with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
    }
}
