import XCTest
@testable import DoroCore

// MARK: - DoroTask coding

final class TaskCodingTests: XCTestCase {
    private func decode(_ json: String) throws -> DoroTask {
        try JSONDecoder().decode(DoroTask.self, from: Data(json.utf8))
    }

    func testDecodeEmptyObjectFallsBackToDefaults() throws {
        let task = try decode("{}")
        XCTAssertEqual(task.name, "New Task")
        XCTAssertEqual(task.url, "")
        XCTAssertEqual(task.space, 1)
        XCTAssertEqual(task.seconds, 0)
        XCTAssertFalse(task.completed)
    }

    func testDecodeLegacyInRotationTrueMeansNotCompleted() throws {
        XCTAssertFalse(try decode(#"{"inRotation": true}"#).completed)
    }

    func testDecodeLegacyInRotationFalseMeansCompleted() throws {
        XCTAssertTrue(try decode(#"{"inRotation": false}"#).completed)
    }

    func testCompletedKeyWinsOverLegacyKey() throws {
        XCTAssertFalse(try decode(#"{"completed": false, "inRotation": false}"#).completed)
        XCTAssertTrue(try decode(#"{"completed": true, "inRotation": true}"#).completed)
    }

    func testRoundTripPreservesAllFields() throws {
        var task = DoroTask()
        task.name = "GE hero shots"
        task.url = "https://workflowy.com/#/abc123def456"
        task.space = 4
        task.seconds = 3661
        task.completed = true
        task.workflowyId = "ed17a094-f327-45fc-a460-cef238cb12d8"
        task.color = "#facc15"
        let back = try JSONDecoder().decode(DoroTask.self, from: JSONEncoder().encode(task))
        XCTAssertEqual(back.id, task.id)
        XCTAssertEqual(back.name, task.name)
        XCTAssertEqual(back.url, task.url)
        XCTAssertEqual(back.space, task.space)
        XCTAssertEqual(back.seconds, task.seconds)
        XCTAssertEqual(back.completed, task.completed)
        XCTAssertEqual(back.workflowyId, task.workflowyId)
        XCTAssertEqual(back.color, task.color)
    }

    func testRoundTripPreservesNilWorkflowyId() throws {
        let back = try JSONDecoder().decode(DoroTask.self, from: JSONEncoder().encode(DoroTask()))
        XCTAssertNil(back.workflowyId)
    }
}

// MARK: - TaskStore

final class TaskStoreTests: XCTestCase {
    private var tempDir: URL!

    override func setUpWithError() throws {
        tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("DoroCoreTests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: tempDir)
    }

    private func makeStore(names: [String] = [], completed: Set<Int> = []) -> TaskStore {
        let store = TaskStore(fileURL: tempDir.appendingPathComponent("state.json"))
        for (i, name) in names.enumerated() {
            var task = DoroTask()
            task.name = name
            task.completed = completed.contains(i)
            store.tasks.append(task)
        }
        return store
    }

    func testSaveLoadRoundTrip() {
        let store = makeStore(names: ["a", "b", "c"], completed: [1])
        store.currentIndex = 2
        store.sessionMinutes = 25
        store.workflowyApiKey = "key"
        store.workflowyParentInput = "https://workflowy.com/#/abc123def456"
        store.workflowyParentId = "11111111-2222-3333-4444-555555555555"
        store.tasks[0].seconds = 5432
        store.save()

        let reloaded = TaskStore(fileURL: store.fileURL)
        reloaded.load()
        XCTAssertEqual(reloaded.tasks.map(\.name), ["a", "b", "c"])
        XCTAssertEqual(reloaded.tasks.map(\.completed), [false, true, false])
        XCTAssertEqual(reloaded.tasks[0].seconds, 5432)
        XCTAssertEqual(reloaded.currentIndex, 2)
        XCTAssertEqual(reloaded.sessionMinutes, 25)
        XCTAssertEqual(reloaded.workflowyApiKey, "key")
        XCTAssertEqual(reloaded.workflowyParentInput, "https://workflowy.com/#/abc123def456")
        XCTAssertEqual(reloaded.workflowyParentId, "11111111-2222-3333-4444-555555555555")
    }

    func testLoadWithMissingFileKeepsDefaults() {
        let store = makeStore()
        store.load()
        XCTAssertTrue(store.tasks.isEmpty)
        XCTAssertEqual(store.sessionMinutes, 20)
        XCTAssertEqual(store.currentIndex, 0)
    }

    func testLoadClampsOutOfRangeCurrentIndex() throws {
        let store = makeStore(names: ["a", "b"])
        store.currentIndex = 1
        store.save()
        // Simulate the state shrinking to one task behind our back.
        var json = try JSONSerialization.jsonObject(
            with: Data(contentsOf: store.fileURL)) as! [String: Any]
        var tasks = json["tasks"] as! [[String: Any]]
        tasks.removeLast()
        json["tasks"] = tasks
        json["currentIndex"] = 5
        try JSONSerialization.data(withJSONObject: json).write(to: store.fileURL)

        let reloaded = TaskStore(fileURL: store.fileURL)
        reloaded.load()
        XCTAssertEqual(reloaded.currentIndex, 0)
    }

    func testAdvanceWrapsAround() {
        let store = makeStore(names: ["a", "b", "c"])
        store.currentIndex = 2
        store.advance()
        XCTAssertEqual(store.currentIndex, 0)
    }

    func testAdvanceSkipsCompletedTasks() {
        let store = makeStore(names: ["a", "b", "c", "d"], completed: [1, 2])
        store.currentIndex = 0
        store.advance()
        XCTAssertEqual(store.currentIndex, 3)
    }

    func testAdvanceSkipsCompletedAcrossTheWrap() {
        let store = makeStore(names: ["a", "b", "c"], completed: [2, 0])
        store.currentIndex = 1
        store.advance()
        XCTAssertEqual(store.currentIndex, 1, "only uncompleted task is the current one")
    }

    func testAdvanceStaysPutWhenAllCompleted() {
        let store = makeStore(names: ["a", "b"], completed: [0, 1])
        store.currentIndex = 1
        store.advance()
        XCTAssertEqual(store.currentIndex, 1)
    }

    func testAdvanceOnEmptyStoreIsANoop() {
        let store = makeStore()
        store.advance()
        XCTAssertEqual(store.currentIndex, 0)
    }

    func testAddSecondToCurrentAccumulates() {
        let store = makeStore(names: ["a", "b"])
        store.currentIndex = 1
        store.addSecondToCurrent()
        store.addSecondToCurrent()
        XCTAssertEqual(store.tasks[1].seconds, 2)
        XCTAssertEqual(store.tasks[0].seconds, 0)
    }

    func testCurrentTaskNilWhenEmpty() {
        XCTAssertNil(makeStore().currentTask)
    }

    func testColorBreakdownGroupsAndSorts() {
        let store = makeStore(names: ["a", "b", "c", "d"])
        store.tasks[0].color = "#facc15"; store.tasks[0].seconds = 3600
        store.tasks[1].color = "#60a5fa"; store.tasks[1].seconds = 900
        store.tasks[2].color = "#facc15"; store.tasks[2].seconds = 1800
        store.tasks[3].seconds = 0 // never worked on: excluded
        let breakdown = store.colorBreakdown()
        XCTAssertEqual(breakdown.map(\.hex), ["#facc15", "#60a5fa"])
        XCTAssertEqual(breakdown.map(\.seconds), [5400, 900])
        XCTAssertEqual(breakdown[0].fraction, 5400.0 / 6300.0, accuracy: 0.0001)
        XCTAssertEqual(breakdown.map(\.fraction).reduce(0, +), 1.0, accuracy: 0.0001)
    }

    func testColorBreakdownCountsColorlessAsGray() {
        let store = makeStore(names: ["a"])
        store.tasks[0].seconds = 60
        let breakdown = store.colorBreakdown()
        XCTAssertEqual(breakdown.map(\.hex), ["#9ca3af"])
        XCTAssertEqual(breakdown[0].fraction, 1.0, accuracy: 0.0001)
    }

    func testColorBreakdownEmptyWhenNoTimeRecorded() {
        let store = makeStore(names: ["a", "b"])
        XCTAssertTrue(store.colorBreakdown().isEmpty)
    }
}

// MARK: - Desktop numbering (SpacesLogic)

final class SpacesLogicTests: XCTestCase {
    private let laptopUUID = "37D8832A-2D66-02CA-B9F7-8F30A301B230"
    private let externalUUID = "1DA270A4-4F4A-4AA8-BE92-022B16FBE68D"

    private func desktop(_ id: Int64) -> [String: Any] { ["id64": id, "type": 0] }
    private func fullscreen(_ id: Int64) -> [String: Any] { ["id64": id, "type": 4] }

    /// Mirrors Fletcher's docked machine: built-in display first with one
    /// desktop, external second with seven. Mission Control numbers them
    /// globally, so the external's desktops are 2-8.
    private func dockedDisplays(currentExternal: Int64, currentLaptop: Int64 = 3) -> [[String: Any]] {
        [
            ["Display Identifier": laptopUUID,
             "Current Space": ["id64": currentLaptop],
             "Spaces": [desktop(3)]],
            ["Display Identifier": externalUUID,
             "Current Space": ["id64": currentExternal],
             "Spaces": [desktop(4927), desktop(4871), desktop(3080), desktop(4184),
                        desktop(4420), desktop(4817), desktop(4854)]],
        ]
    }

    // Regression: within-display numbering said desktop 2 when Ctrl+3 was truth.
    func testDockedExternalDesktopUsesGlobalNumbering() {
        let info = desktopNumber(displays: dockedDisplays(currentExternal: 4871),
                                 targetDisplayUUID: externalUUID)
        XCTAssertEqual(info?.current, 3)
        XCTAssertEqual(info?.total, 8)
    }

    func testDockedFirstExternalDesktopIsNumberTwo() {
        let info = desktopNumber(displays: dockedDisplays(currentExternal: 4927),
                                 targetDisplayUUID: externalUUID)
        XCTAssertEqual(info?.current, 2)
    }

    func testDockedLaptopDesktopIsNumberOne() {
        let info = desktopNumber(displays: dockedDisplays(currentExternal: 4871),
                                 targetDisplayUUID: laptopUUID)
        XCTAssertEqual(info?.current, 1)
        XCTAssertEqual(info?.total, 8)
    }

    func testNilTargetFallsBackToDisplayWithMostDesktops() {
        let info = desktopNumber(displays: dockedDisplays(currentExternal: 4854),
                                 targetDisplayUUID: nil)
        XCTAssertEqual(info?.current, 8)
    }

    func testUnknownTargetFallsBackToDisplayWithMostDesktops() {
        let info = desktopNumber(displays: dockedDisplays(currentExternal: 4927),
                                 targetDisplayUUID: "NOT-A-DISPLAY")
        XCTAssertEqual(info?.current, 2)
    }

    func testSingleDisplayOutAndAbout() {
        let displays: [[String: Any]] = [
            ["Display Identifier": laptopUUID,
             "Current Space": ["id64": Int64(30)],
             "Spaces": [desktop(10), desktop(20), desktop(30), desktop(40)]],
        ]
        let info = desktopNumber(displays: displays, targetDisplayUUID: laptopUUID)
        XCTAssertEqual(info?.current, 3)
        XCTAssertEqual(info?.total, 4)
    }

    func testFullscreenSpacesAreExcludedFromNumbering() {
        let displays: [[String: Any]] = [
            ["Display Identifier": laptopUUID,
             "Current Space": ["id64": Int64(30)],
             "Spaces": [desktop(10), fullscreen(99), desktop(30)]],
        ]
        let info = desktopNumber(displays: displays, targetDisplayUUID: laptopUUID)
        XCTAssertEqual(info?.current, 2)
        XCTAssertEqual(info?.total, 2)
    }

    func testCurrentFullscreenSpaceReturnsNil() {
        let displays: [[String: Any]] = [
            ["Display Identifier": laptopUUID,
             "Current Space": ["id64": Int64(99)],
             "Spaces": [desktop(10), fullscreen(99)]],
        ]
        XCTAssertNil(desktopNumber(displays: displays, targetDisplayUUID: laptopUUID))
    }

    func testEmptyDisplayListReturnsNil() {
        XCTAssertNil(desktopNumber(displays: [], targetDisplayUUID: nil))
    }
}

// MARK: - Recorded-time text (TimeText)

final class TimeTextTests: XCTestCase {
    func testFormatUnderAnHourIsMinutesOnly() {
        XCTAssertEqual(formatRecordedTime(seconds: 34 * 60), "34m")
        XCTAssertEqual(formatRecordedTime(seconds: 0), "0m")
        XCTAssertEqual(formatRecordedTime(seconds: 59), "0m") // sub-minute truncates
    }

    func testFormatOverAnHour() {
        XCTAssertEqual(formatRecordedTime(seconds: 3600), "1h 0m")
        XCTAssertEqual(formatRecordedTime(seconds: 2 * 3600 + 5 * 60), "2h 5m")
    }

    func testParseBareIntIsMinutes() {
        XCTAssertEqual(parseRecordedTime("34"), 34 * 60)
        XCTAssertEqual(parseRecordedTime("90"), 90 * 60)
        XCTAssertEqual(parseRecordedTime("0"), 0)
    }

    func testParseMinutesOnly() {
        XCTAssertEqual(parseRecordedTime("34m"), 34 * 60)
        XCTAssertEqual(parseRecordedTime("34 m"), 34 * 60)
    }

    func testParseHoursOnly() {
        XCTAssertEqual(parseRecordedTime("2h"), 2 * 3600)
    }

    func testParseHoursAndMinutes() {
        XCTAssertEqual(parseRecordedTime("1h 23m"), 3600 + 23 * 60)
        XCTAssertEqual(parseRecordedTime("1h23m"), 3600 + 23 * 60)
        XCTAssertEqual(parseRecordedTime("1h 30"), 3600 + 30 * 60)
        XCTAssertEqual(parseRecordedTime("1H 5M"), 3600 + 5 * 60)
        XCTAssertEqual(parseRecordedTime("  2h 0m  "), 2 * 3600)
    }

    func testParseRoundTripsFormat() {
        for seconds in [0, 34 * 60, 3600, 2 * 3600 + 5 * 60] {
            XCTAssertEqual(parseRecordedTime(formatRecordedTime(seconds: seconds)), seconds)
        }
    }

    func testParseRejectsGarbage() {
        XCTAssertNil(parseRecordedTime(""))
        XCTAssertNil(parseRecordedTime("   "))
        XCTAssertNil(parseRecordedTime("abc"))
        XCTAssertNil(parseRecordedTime("-5"))
        XCTAssertNil(parseRecordedTime("1x 30y"))
        XCTAssertNil(parseRecordedTime("h m"))
    }
}

// MARK: - Workflowy parsing

final class WorkflowyParsingTests: XCTestCase {
    private func assertShort(_ input: String, _ expected: String,
                             file: StaticString = #filePath, line: UInt = #line) {
        guard case .short(let shortId)? = Workflowy.parseParentInput(input) else {
            XCTFail("expected .short for \(input)", file: file, line: line)
            return
        }
        XCTAssertEqual(shortId, expected, file: file, line: line)
    }

    func testParseFullUUID() {
        guard case .uuid(let id)? = Workflowy.parseParentInput(
            "ED17A094-F327-45FC-A460-CEF238CB12D8") else {
            return XCTFail("expected .uuid")
        }
        XCTAssertEqual(id, "ed17a094-f327-45fc-a460-cef238cb12d8")
    }

    func testParseWorkflowyLink() {
        assertShort("https://workflowy.com/#/cef238cb12d8", "cef238cb12d8")
    }

    func testParseBetaWorkflowyLink() {
        assertShort("https://beta.workflowy.com/#/cef238cb12d8", "cef238cb12d8")
    }

    func testParseBareShortId() {
        assertShort("cef238cb12d8", "cef238cb12d8")
        assertShort("  CEF238CB12D8  ", "cef238cb12d8")
    }

    func testParseRejectsGarbage() {
        XCTAssertNil(Workflowy.parseParentInput(""))
        XCTAssertNil(Workflowy.parseParentInput("   "))
        XCTAssertNil(Workflowy.parseParentInput("not a node"))
        XCTAssertNil(Workflowy.parseParentInput("cef238cb12d"))     // 11 chars
        XCTAssertNil(Workflowy.parseParentInput("cef238cb12d8f"))   // 13 chars
        XCTAssertNil(Workflowy.parseParentInput("https://example.com/#/cef238cb12d8"))
    }

    func testNodeURLUsesLast12HexOfUUID() {
        XCTAssertEqual(Workflowy.nodeURL(for: "ed17a094-f327-45fc-a460-cef238cb12d8"),
                       "https://workflowy.com/#/cef238cb12d8")
    }

    func testNodeURLRoundTripsThroughParse() {
        let url = Workflowy.nodeURL(for: "ED17A094-F327-45FC-A460-CEF238CB12D8")
        assertShort(url, "cef238cb12d8")
    }

    func testStripTags() {
        XCTAssertEqual(Workflowy.stripTags("<b>CALENDAR</b>"), "CALENDAR")
        XCTAssertEqual(Workflowy.stripTags("plain"), "plain")
        XCTAssertEqual(Workflowy.stripTags("  spaced  "), "spaced")
        XCTAssertEqual(Workflowy.stripTags("a <span class=\"x\">b</span> c"), "a b c")
    }
}
