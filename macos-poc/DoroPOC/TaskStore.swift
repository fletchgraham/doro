import Foundation

struct DoroTask: Codable {
    var id = UUID()
    var name = "New Task"
    var url = ""
    var space = 1
    /// Cumulative seconds ever spent on this task.
    var seconds = 0
}

/// Task list + current task index, persisted as JSON in Application Support.
final class TaskStore {
    var tasks: [DoroTask] = []
    var currentIndex = 0
    var sessionMinutes = 20
    var workflowyApiKey = ""
    var workflowyParentInput = ""

    private struct State: Codable {
        var currentIndex: Int
        var tasks: [DoroTask]
        var sessionMinutes: Int?
        var workflowyApiKey: String?
        var workflowyParentInput: String?
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
        clampIndex(to: state.currentIndex)
    }

    func save() {
        let state = State(currentIndex: currentIndex, tasks: tasks,
                          sessionMinutes: sessionMinutes,
                          workflowyApiKey: workflowyApiKey,
                          workflowyParentInput: workflowyParentInput)
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

    func advance() {
        guard !tasks.isEmpty else { return }
        currentIndex = (currentIndex + 1) % tasks.count
        save()
    }
}
