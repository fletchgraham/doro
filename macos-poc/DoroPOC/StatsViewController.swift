import AppKit

func nsColor(hex: String) -> NSColor? {
    let stripped = hex.trimmingCharacters(in: CharacterSet(charactersIn: "# "))
    var value: UInt64 = 0
    guard stripped.count == 6, Scanner(string: stripped).scanHexInt64(&value) else { return nil }
    return NSColor(red: CGFloat((value >> 16) & 0xff) / 255,
                   green: CGFloat((value >> 8) & 0xff) / 255,
                   blue: CGFloat(value & 0xff) / 255, alpha: 1)
}

/// Small filled circle, for popup items and legend rows.
func colorDot(_ hex: String, diameter: CGFloat = 12) -> NSImage {
    NSImage(size: NSSize(width: diameter, height: diameter), flipped: false) { rect in
        (nsColor(hex: hex) ?? .gray).setFill()
        NSBezierPath(ovalIn: rect).fill()
        return true
    }
}

/// Pie of the recorded-time color breakdown.
final class PieView: NSView {
    var slices: [(value: Double, color: NSColor)] = [] {
        didSet { needsDisplay = true }
    }

    override var intrinsicContentSize: NSSize { NSSize(width: 200, height: 200) }

    override func draw(_ dirtyRect: NSRect) {
        let side = min(bounds.width, bounds.height) - 4
        guard side > 0 else { return }
        let center = NSPoint(x: bounds.midX, y: bounds.midY)
        let radius = side / 2
        let total = slices.reduce(0) { $0 + $1.value }
        guard total > 0 else {
            NSColor.quaternaryLabelColor.setFill()
            NSBezierPath(ovalIn: NSRect(x: center.x - radius, y: center.y - radius,
                                        width: side, height: side)).fill()
            return
        }
        var startAngle = 90.0 // 12 o'clock, sweeping clockwise
        for slice in slices {
            let endAngle = startAngle - 360 * slice.value / total
            let path = NSBezierPath()
            path.move(to: center)
            path.appendArc(withCenter: center, radius: radius,
                           startAngle: startAngle, endAngle: endAngle, clockwise: true)
            path.close()
            slice.color.setFill()
            path.fill()
            startAngle = endAngle
        }
    }
}

/// Third page: pie graph + percentage breakdown of recorded time by color.
final class StatsViewController: NSViewController {
    private let store: TaskStore
    private let pie = PieView()
    private let legend = NSStackView()
    private let emptyLabel = NSTextField(labelWithString: "No recorded time yet")

    init(store: TaskStore) {
        self.store = store
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    override func loadView() {
        legend.orientation = .vertical
        legend.alignment = .leading
        legend.spacing = 6
        emptyLabel.textColor = .secondaryLabelColor

        let stack = NSStackView(views: [pie, emptyLabel, legend])
        stack.orientation = .vertical
        stack.alignment = .centerX
        stack.spacing = 20
        stack.edgeInsets = NSEdgeInsets(top: 30, left: 20, bottom: 20, right: 20)
        stack.translatesAutoresizingMaskIntoConstraints = false

        let root = NSView()
        root.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: root.topAnchor),
            stack.centerXAnchor.constraint(equalTo: root.centerXAnchor),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: root.bottomAnchor),
        ])
        view = root
    }

    /// Recompute from the store (called whenever the page is shown).
    func refresh() {
        let breakdown = store.colorBreakdown()
        pie.slices = breakdown.map { (Double($0.seconds), nsColor(hex: $0.hex) ?? .gray) }
        emptyLabel.isHidden = !breakdown.isEmpty
        legend.arrangedSubviews.forEach { $0.removeFromSuperview() }
        for entry in breakdown {
            let dot = NSImageView(image: colorDot(entry.hex, diameter: 10))
            let name = taskColors.first { $0.hex == entry.hex }?.name ?? entry.hex
            let percent = Int((entry.fraction * 100).rounded())
            let label = NSTextField(labelWithString:
                "\(name) — \(formatRecordedTime(seconds: entry.seconds)) (\(percent)%)")
            label.font = .monospacedDigitSystemFont(ofSize: 13, weight: .regular)
            let row = NSStackView(views: [dot, label])
            row.orientation = .horizontal
            row.spacing = 6
            legend.addArrangedSubview(row)
        }
    }
}
