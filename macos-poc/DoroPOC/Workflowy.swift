import Foundation

// Direct client for the official Workflowy API v1 (the web app proxies the
// same calls through vercel only for CORS; a native app can go straight there).

struct WorkflowyNode: Decodable {
    let id: String
    let name: String?
    let priority: Int?
}

enum WorkflowyParentTarget {
    case uuid(String)
    case short(String)
}

enum WorkflowyError: LocalizedError {
    case badParentInput
    case nodeNotFound
    case http(Int)

    var errorDescription: String? {
        switch self {
        case .badParentInput:
            return "Couldn't parse that node URL / id"
        case .nodeNotFound:
            return "Couldn't find that node — try pasting its full UUID"
        case .http(401):
            return "Invalid Workflowy API key"
        case .http(let code):
            return "Workflowy API error \(code)"
        }
    }
}

enum Workflowy {
    static func listChildren(token: String, parentId: String?) async throws -> [WorkflowyNode] {
        var components = URLComponents(string: "https://workflowy.com/api/v1/nodes")!
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
        return (try? JSONDecoder().decode(Wrapper.self, from: data))?.nodes ?? []
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
    static func resolveParentId(token: String, target: WorkflowyParentTarget) async throws -> String {
        switch target {
        case .uuid(let id):
            return id
        case .short(let shortId):
            var queue: [String?] = [nil] // nil = root
            var requests = 0
            while !queue.isEmpty && requests < 200 {
                let parentId = queue.removeFirst()
                requests += 1
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
