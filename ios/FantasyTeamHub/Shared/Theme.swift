import SwiftUI
import UIKit

/// The website's palette (src/app/globals.css), dark and light, following the phone's setting.
enum Theme {
    static let background = Color(light: 0xF3F5FA, dark: 0x06070F)
    static let surface = Color(light: 0xFFFFFF, dark: 0x101426)
    static let surfaceRaised = Color(light: 0xE7EAF2, dark: 0x161B30)
    static let border = Color(light: 0xD7DCE8, dark: 0x1F2540)
    static let text = Color(light: 0x0B0D1A, dark: 0xE8ECF7)
    static let secondary = Color(light: 0x46507A, dark: 0x8B93B3)
    static let faint = Color(light: 0x59628A, dark: 0x5C6585)

    /// Green text and accents: deeper in light mode so it keeps its contrast on white.
    static let brand = Color(light: 0x037A55, dark: 0x37E3A0)
    static let brandFill = Color(hex: 0x05C988)
    static let ink = Color(hex: 0x06070F)

    // The verdict colours, which are also the logo's three bars.
    static let keep = Color(light: 0x04A672, dark: 0x05C988)
    static let watch = Color(light: 0xE09A12, dark: 0xF5B83D)
    static let sell = Color(light: 0xE03A55, dark: 0xF0566E)

    /// FPL's fixture difficulty colours, the same in both themes.
    static func difficulty(_ d: Int) -> (fill: Color, text: Color) {
        switch d {
        case 1: (Color(hex: 0x00D97E), Color(hex: 0x04231A))
        case 2: (Color(hex: 0x6EE7A8), Color(hex: 0x06301F))
        case 4: (Color(hex: 0xFB8C66), Color(hex: 0x3A1305))
        case 5: (Color(hex: 0xEF4056), Color(hex: 0x2D0209))
        default: (Color(hex: 0xCBD2E0), Color(hex: 0x1B2133))
        }
    }

    static func verdict(_ v: Verdict) -> Color {
        switch v {
        case .keep: keep
        case .watch: watch
        case .sell: sell
        }
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }

    init(light: UInt32, dark: UInt32) {
        self.init(UIColor { traits in
            UIColor(Color(hex: traits.userInterfaceStyle == .dark ? dark : light))
        })
    }
}

/// Whether data loaded at `date` is old enough to fetch again when a tab reappears. Switching
/// tabs should not refetch every time: it is slow on a phone and FPL's data changes by the
/// minute at most.
func isStale(_ date: Date?, after seconds: TimeInterval = 60) -> Bool {
    guard let date else { return true }
    return Date().timeIntervalSince(date) > seconds
}

extension Double {
    /// "£9.6m"
    var money: String { String(format: "£%.1fm", self) }
    /// One decimal place, for points.
    var oneDP: String { String(format: "%.1f", self) }
}

/// FPL timestamps are ISO 8601, with or without fractional seconds.
enum FPLDate {
    static func parse(_ iso: String?) -> Date? {
        guard let iso else { return nil }
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return withFraction.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
            // ESPN writes kickoffs without seconds: 2026-11-04T20:00Z
            ?? ISO8601DateFormatter().date(from: iso.replacingOccurrences(of: "Z", with: ":00Z"))
    }

    /// Times shown in UK time, as the Premier League lists them.
    static let london = TimeZone(identifier: "Europe/London")!

    static func format(_ iso: String?, _ format: String) -> String {
        guard let date = parse(iso) else { return "TBC" }
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_GB")
        f.timeZone = london
        f.dateFormat = format
        return f.string(from: date)
    }
}
