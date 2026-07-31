import Foundation

// Pure logic behind current-space detection, split from the CGS glue in
// Spaces.swift so it can be unit-tested with fixture data.

/// Given the CGSCopyManagedDisplaySpaces result (one dict per display, each
/// with its own current space), returns (currentDesktopNumber, totalDesktops).
///
/// Mission Control numbers desktops globally across displays in the order
/// CGS reports them — docked with "Displays have separate Spaces", the
/// built-in display's lone desktop is 1 and the external's start at 2.
/// `targetDisplayUUID` picks which display's current space counts as "where
/// I am"; nil (or no match) falls back to the display with the most desktops.
func desktopNumber(displays: [[String: Any]], targetDisplayUUID: String?) -> (current: Int, total: Int)? {
    let chosen = displays.first { ($0["Display Identifier"] as? String) == targetDisplayUUID }
        ?? displays.max { a, b in
            ((a["Spaces"] as? [Any])?.count ?? 0) < ((b["Spaces"] as? [Any])?.count ?? 0)
        }
    guard let chosen,
          let currentID = (chosen["Current Space"] as? [String: Any])?["id64"] as? Int64
    else { return nil }

    // Flatten desktops across all displays for the global numbering.
    // type 0 = a normal desktop; other types are fullscreen-app spaces.
    var ids: [Int64] = []
    for display in displays {
        let desktops = (display["Spaces"] as? [[String: Any]] ?? [])
            .filter { ($0["type"] as? Int) == 0 }
        ids.append(contentsOf: desktops.compactMap { $0["id64"] as? Int64 })
    }
    guard let index = ids.firstIndex(of: currentID) else { return nil }
    return (index + 1, ids.count)
}
