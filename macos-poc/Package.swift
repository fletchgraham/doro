// swift-tools-version:5.9
// This package exists ONLY for `swift test` — the app itself is still built
// by build.sh with plain swiftc. DoroCore covers the AppKit-free logic files.
import PackageDescription

let package = Package(
    name: "DoroPOC",
    platforms: [.macOS(.v13)],
    targets: [
        .target(
            name: "DoroCore",
            path: "DoroPOC",
            sources: ["TaskStore.swift", "Workflowy.swift", "SpacesLogic.swift", "TimeText.swift"]
        ),
        .testTarget(
            name: "DoroCoreTests",
            dependencies: ["DoroCore"],
            path: "Tests"
        ),
    ]
)
