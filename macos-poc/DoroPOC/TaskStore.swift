import Foundation

/// Same default palette as the doro webapp (TASK_COLORS in TasksView.tsx).
let taskColors: [(name: String, hex: String)] = [
    ("gray", "#9ca3af"),
    ("red", "#f87171"),
    ("orange", "#fb923c"),
    ("yellow", "#facc15"),
    ("green", "#4ade80"),
    ("blue", "#60a5fa"),
    ("purple", "#c084fc"),
]

struct DoroTask: Codable {
    var id = UUID()
    var name = "New Task"
    var url = ""
    var space = 1
    /// Cumulative seconds ever spent on this task.
    var seconds = 0
    /// Completed tasks are skipped when advancing to the next task.
    var completed = false
    /// Full workflowy node UUID for imported tasks (needed for API calls;
    /// the url only carries the short id).
    var workflowyId: String?
    /// Hex color from the taskColors palette; nil renders as gray.
    var color: String?

    init() {}

    // Custom decode so fields added later fall back to defaults when
    // loading an older state.json.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? "New Task"
        url = try c.decodeIfPresent(String.self, forKey: .url) ?? ""
        space = try c.decodeIfPresent(Int.self, forKey: .space) ?? 1
        seconds = try c.decodeIfPresent(Int.self, forKey: .seconds) ?? 0
        workflowyId = try c.decodeIfPresent(String.self, forKey: .workflowyId)
        color = try c.decodeIfPresent(String.self, forKey: .color)
        if let done = try c.decodeIfPresent(Bool.self, forKey: .completed) {
            completed = done
        } else {
            // Briefly shipped with the opposite meaning under "inRotation".
            struct Legacy: CodingKey {
                var stringValue = "inRotation"; var intValue: Int? { nil }
                init() {}
                init?(stringValue: String) { self.stringValue = stringValue }
                init?(intValue: Int) { nil }
            }
            let legacy = try decoder.container(keyedBy: Legacy.self)
            completed = !(try legacy.decodeIfPresent(Bool.self, forKey: Legacy()) ?? true)
        }
    }
}

/// Task list + current task index, persisted as JSON in Application Support.
final class TaskStore {
    var tasks: [DoroTask] = []
    var currentIndex = 0
    var sessionMinutes = 20
    var workflowyApiKey = ""
    var workflowyParentInput = ""
    /// Resolved parent node UUID, cached so the slow short-id tree search
    /// runs at most once. Cleared whenever the parent input changes.
    var workflowyParentId = ""

    private struct State: Codable {
        var currentIndex: Int
        var tasks: [DoroTask]
        var sessionMinutes: Int?
        var workflowyApiKey: String?
        var workflowyParentInput: String?
        var workflowyParentId: String?
    }

    static let defaultFileURL: URL = {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("DoroPOC", isDirectory: true)
            .appendingPathComponent("state.json")
    }()

    /// Injectable so tests never touch the real state file.
    let fileURL: URL

    init(fileURL: URL = TaskStore.defaultFileURL) {
        self.fileURL = fileURL
    }

    var currentTask: DoroTask? {
        tasks.indices.contains(currentIndex) ? tasks[currentIndex] : nil
    }

    func load() {
        guard let data = try? Data(contentsOf: fileURL),
              let state = try? JSONDecoder().decode(State.self, from: data) else { return }
        tasks = state.tasks
        sessionMinutes = state.sessionMinutes ?? 20
        workflowyApiKey = state.workflowyApiKey ?? ""
        workflowyParentInput = state.workflowyParentInput ?? ""
        workflowyParentId = state.workflowyParentId ?? ""
        clampIndex(to: state.currentIndex)
    }

    func save() {
        let state = State(currentIndex: currentIndex, tasks: tasks,
                          sessionMinutes: sessionMinutes,
                          workflowyApiKey: workflowyApiKey,
                          workflowyParentInput: workflowyParentInput,
                          workflowyParentId: workflowyParentId)
        if let data = try? JSONEncoder().encode(state) {
            try? FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(),
                                                     withIntermediateDirectories: true)
            try? data.write(to: fileURL, options: .atomic)
        }
    }

    func clampIndex(to index: Int? = nil) {
        currentIndex = max(0, min(index ?? currentIndex, tasks.count - 1))
    }

    /// Accumulated time grouped by task color, largest first. Fractions of
    /// the total recorded time; colorless tasks count as gray.
    func colorBreakdown() -> [(hex: String, seconds: Int, fraction: Double)] {
        var secondsByHex: [String: Int] = [:]
        for task in tasks where task.seconds > 0 {
            secondsByHex[task.color ?? taskColors[0].hex, default: 0] += task.seconds
        }
        let total = secondsByHex.values.reduce(0, +)
        guard total > 0 else { return [] }
        return secondsByHex
            .map { (hex: $0.key, seconds: $0.value, fraction: Double($0.value) / Double(total)) }
            .sorted { $0.seconds > $1.seconds }
    }

    func addSecondToCurrent() {
        guard tasks.indices.contains(currentIndex) else { return }
        tasks[currentIndex].seconds += 1
    }

    /// Move to the next uncompleted task (stays put if all are complete).
    func advance() {
        guard !tasks.isEmpty else { return }
        var next = currentIndex
        for _ in 0..<tasks.count {
            next = (next + 1) % tasks.count
            if !tasks[next].completed { break }
        }
        currentIndex = next
        save()
    }
}
