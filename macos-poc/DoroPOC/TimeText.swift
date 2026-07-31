import Foundation

// The human format the recorded-time editor speaks: "1h 23m", or just "34m"
// for tasks under an hour.

func formatRecordedTime(seconds: Int) -> String {
    let hours = seconds / 3600
    let minutes = (seconds % 3600) / 60
    return hours > 0 ? "\(hours)h \(minutes)m" : "\(minutes)m"
}

/// Parses "1h 23m", "2h", "45m", "1h30m", or a bare number (interpreted as
/// minutes). Returns total seconds, or nil if the string isn't understood.
func parseRecordedTime(_ input: String) -> Int? {
    let text = input.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    guard !text.isEmpty else { return nil }
    if let minutes = Int(text) {
        return minutes >= 0 ? minutes * 60 : nil
    }
    let pattern = "^(?:(\\d+)\\s*h)?\\s*(?:(\\d+)\\s*m?)?$"
    guard let regex = try? NSRegularExpression(pattern: pattern),
          let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text))
    else { return nil }
    func group(_ index: Int) -> Int? {
        Range(match.range(at: index), in: text).flatMap { Int(text[$0]) }
    }
    let hours = group(1)
    let minutes = group(2)
    guard hours != nil || minutes != nil else { return nil }
    return (hours ?? 0) * 3600 + (minutes ?? 0) * 60
}
