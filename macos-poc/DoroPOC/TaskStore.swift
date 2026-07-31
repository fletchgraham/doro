import Foundation

struct DoroTask: Codable {
    var id = UUID()
    var name = "New Task"
    var url = ""
    var space = 1
    /// Cumulative seconds ever spent on this task.
    var seconds = 0
    /// Completed tasks are skipped when advancing to the next task.
    var completed = false

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

    static let fileURL: URL = {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("DoroPOC", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("state.json")
    }()

    var currentTask: DoroTask? {
        tasks.indices.contains(currentIndex) ? tasks[currentIndex] : nil
    }

    func load() {
        guard let data = try? Data(contentsOf: Self.fileURL),
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
            try? data.write(to: Self.fileURL, options: .atomic)
        }
    }

    func clampIndex(to index: Int? = nil) {
        currentIndex = max(0, min(index ?? currentIndex, tasks.count - 1))
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
