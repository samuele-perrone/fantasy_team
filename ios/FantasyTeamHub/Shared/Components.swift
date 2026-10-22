import SwiftUI

/// The logo: three bars in the verdict colours (keep, watch, sell), which also read as an F.
struct LogoMark: View {
    var size: CGFloat = 32

    var body: some View {
        let u = size / 100
        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: 22 * u, style: .continuous)
                .fill(Theme.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: 22 * u, style: .continuous)
                        .stroke(Theme.border, lineWidth: max(1, 2 * u))
                )
            bar(width: 56, y: 25, color: Theme.keep, u: u)
            bar(width: 40, y: 44, color: Theme.watch, u: u)
            bar(width: 24, y: 63, color: Theme.sell, u: u)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }

    private func bar(width: CGFloat, y: CGFloat, color: Color, u: CGFloat) -> some View {
        Capsule().fill(color)
            .frame(width: width * u, height: 13 * u)
            .offset(x: 22 * u, y: y * u)
    }
}

/// A player's headshot over a placeholder silhouette, for players FPL has no photo of.
struct PlayerPhoto: View {
    let code: Int
    var size: CGFloat = 40

    var body: some View {
        AsyncImage(url: Config.photoURL(code: code)) { phase in
            if let image = phase.image {
                image.resizable().scaledToFill()
            } else {
                Image(systemName: "person.fill")
                    .resizable()
                    .scaledToFit()
                    .foregroundStyle(Theme.faint)
                    .padding(size * 0.2)
                    .offset(y: size * 0.08)
            }
        }
        .frame(width: size, height: size, alignment: .top)
        .background(Theme.surfaceRaised)
        .clipShape(Circle())
        .overlay(Circle().stroke(Theme.border, lineWidth: 1))
        .accessibilityHidden(true)
    }
}

struct ClubBadge: View {
    let code: Int
    var size: CGFloat = 22

    var body: some View {
        AsyncImage(url: Config.badgeURL(teamCode: code)) { image in
            image.resizable().scaledToFit()
        } placeholder: {
            Circle().fill(Theme.surfaceRaised)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

struct VerdictPill: View {
    let verdict: Verdict

    var body: some View {
        Text(verdict.rawValue.uppercased())
            .font(.system(size: 10.5, weight: .black))
            .tracking(0.6)
            .foregroundStyle(Theme.verdict(verdict))
            .frame(width: 52, height: 24)
            .background(Theme.verdict(verdict).opacity(0.15), in: RoundedRectangle(cornerRadius: 6))
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.verdict(verdict).opacity(0.4)))
    }
}

/// FPL's availability flag beside a name, coloured by the chance of playing.
struct AvailabilityFlag: View {
    let player: Player

    var body: some View {
        if let color {
            Image(systemName: "flag.fill")
                .font(.system(size: 10))
                .foregroundStyle(color)
                .accessibilityLabel(player.news.isEmpty ? "Flagged" : player.news)
        }
    }

    private var color: Color? {
        if player.status == "a" && player.availability == nil { return nil }
        switch player.availability ?? 0 {
        case 75...: return Theme.watch
        case 50..<75: return Color(hex: 0xF59E0B)
        case 1..<50: return Color(hex: 0xF97316)
        default: return Theme.sell
        }
    }
}

/// Name, flag and "ARS · MID · £9.6m". The name keeps its width; the details give way first.
struct PlayerLine: View {
    let player: Player

    var body: some View {
        HStack(spacing: 6) {
            Text(player.name)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Theme.text)
                .layoutPriority(1)
            AvailabilityFlag(player: player)
            Text("\(player.team) · \(player.pos) · \(player.cost.money)")
                .font(.system(size: 12))
                .foregroundStyle(Theme.faint)
        }
        .lineLimit(1)
    }
}

/// Star toggle for the watchlist.
struct WatchButton: View {
    let watched: Bool
    let toggle: () -> Void

    var body: some View {
        Button(action: toggle) {
            Image(systemName: watched ? "star.fill" : "star")
                .font(.system(size: 18))
                .foregroundStyle(watched ? Theme.watch : Theme.faint)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(watched ? "Stop watching" : "Watch this player")
        .sensoryFeedback(.selection, trigger: watched)
    }
}

/// The next fixtures as difficulty-coloured chips, with a dot on congested ones.
struct FixtureRun: View {
    let fixtures: [FixtureChip]
    var max = 5

    var body: some View {
        HStack(spacing: 3) {
            ForEach(Array(fixtures.prefix(max).enumerated()), id: \.offset) { _, f in
                let c = Theme.difficulty(f.difficulty)
                Text(f.opponent + (f.isHome ? "" : " (a)"))
                    .font(.system(size: 10.5, weight: .bold))
                    .foregroundStyle(c.text)
                    .padding(.horizontal, 5)
                    .frame(minWidth: 40, minHeight: 22)
                    .background(c.fill, in: RoundedRectangle(cornerRadius: 4))
                    .overlay(alignment: .topTrailing) {
                        if f.congested == true {
                            Circle().fill(Theme.watch).frame(width: 7, height: 7).offset(x: 2, y: -2)
                        }
                    }
            }
            if fixtures.isEmpty {
                Text("Blank").font(.caption2).foregroundStyle(Theme.faint)
            }
        }
    }
}

/// Section label in the app's small-caps style.
struct Eyebrow: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 10.5, weight: .semibold))
            .tracking(0.6)
            .foregroundStyle(Theme.faint)
    }
}

/// A rounded panel matching the website's cards.
struct Panel<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        content
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Theme.border))
    }
}

/// Loading, error and empty states shared by every tab.
struct StateView: View {
    let systemImage: String
    let title: String
    let message: String?
    var action: (label: String, run: () -> Void)?

    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: systemImage)
        } description: {
            if let message { Text(message) }
        } actions: {
            if let action {
                Button(action.label, action: action.run).buttonStyle(.borderedProminent).tint(Theme.brandFill)
            }
        }
    }
}
