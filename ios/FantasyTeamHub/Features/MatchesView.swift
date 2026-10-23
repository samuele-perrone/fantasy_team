import SwiftUI

/// Every Premier League match in a gameweek, with your players picked out.
struct MatchesView: View {
    @Environment(AuthStore.self) private var auth
    @State private var view: MatchdayView?
    @State private var gameweek: Int?
    @State private var error: String?
    @State private var expanded: Set<Int> = []
    @State private var loading = false
    @State private var loadedAt: Date?

    /// FPL seasons have 38 gameweeks.
    private static let gameweeks = 1...38
    /// The gameweek being shown or being loaded, so repeated taps keep stepping.
    private var current: Int? { gameweek ?? view?.event }

    var body: some View {
        NavigationStack {
            Group {
                if let view {
                    list(view)
                } else if let error {
                    StateView(systemImage: "wifi.exclamationmark", title: "Couldn't load matches", message: error,
                              action: ("Try again", { Task { await load() } }))
                } else {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .background(Theme.background)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { step(-1) } label: { Image(systemName: "chevron.left") }
                        .disabled(current.map { $0 <= Self.gameweeks.lowerBound } ?? true)
                        .accessibilityLabel("Previous gameweek")
                }
                ToolbarItem(placement: .principal) {
                    HStack(spacing: 8) {
                        Text(current.map { "Gameweek \($0)" } ?? "Matches").font(.headline)
                        if loading { ProgressView().controlSize(.small) }
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { step(1) } label: { Image(systemName: "chevron.right") }
                        .disabled(current.map { $0 >= Self.gameweeks.upperBound } ?? true)
                        .accessibilityLabel("Next gameweek")
                }
            }
            .refreshable { await load() }
            .task(id: gameweek) {
                if gameweek != view?.event || isStale(loadedAt) { await load() }
            }
            // While a match is live, refresh every minute; the server caches FPL for 60 seconds.
            .task(id: view?.live) {
                guard view?.live == true else { return }
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(60))
                    await load()
                }
            }
        }
    }

    private func list(_ view: MatchdayView) -> some View {
        List {
            if view.live {
                Label("Live · updates every minute", systemImage: "dot.radiowaves.left.and.right")
                    .font(.footnote.bold()).foregroundStyle(Theme.sell)
                    .listRowBackground(Color.clear)
            }
            ForEach(view.days, id: \.day) { day in
                Section(day.day) {
                    ForEach(day.matches) { m in
                        MatchRow(match: m, expanded: expanded.contains(m.id) || m.status == .live) {
                            if expanded.contains(m.id) { expanded.remove(m.id) } else { expanded.insert(m.id) }
                        }
                        .listRowBackground(Theme.surface)
                    }
                }
            }
            Section {
            } footer: {
                Text("Scores and points come from FPL and can run a minute or two behind the match. Bonus is shown as it would be if the match ended now, until FPL confirms it after full time.")
                    .font(.caption).foregroundStyle(Theme.faint)
            }
        }
        .scrollContentBackground(.hidden)
        .readableWidth()
    }

    private func step(_ delta: Int) {
        guard let current else { return }
        let target = current + delta
        guard Self.gameweeks.contains(target) else { return }
        expanded = []
        gameweek = target
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            let fresh = try await auth.api.matches(gameweek: gameweek)
            // A slower, older request must not overwrite the gameweek asked for since.
            guard gameweek == nil || fresh.event == gameweek else { return }
            view = fresh
            loadedAt = .now
            error = nil
        } catch is CancellationError {
        } catch {
            if view == nil { self.error = error.localizedDescription }
        }
    }
}

struct MatchRow: View {
    let match: Match
    let expanded: Bool
    let toggle: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            Button(action: toggle) {
                HStack(spacing: 8) {
                    side(match.home, alignment: .trailing)
                    centre.frame(minWidth: 64)
                    side(match.away, alignment: .leading)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint(expanded ? "Hides the match report" : "Shows the match report")

            if !match.players.isEmpty {
                FlowChips(players: match.players)
            }
            if expanded {
                MatchReport(match: match)
            }
        }
        .padding(.vertical, 6)
    }

    private func side(_ s: MatchSide, alignment: HorizontalAlignment) -> some View {
        HStack(spacing: 6) {
            if alignment == .leading { ClubBadge(code: s.code) }
            Text(s.name).font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.text).lineLimit(1)
                .minimumScaleFactor(0.85)
            if alignment == .trailing { ClubBadge(code: s.code) }
        }
        .frame(maxWidth: .infinity, alignment: alignment == .leading ? .leading : .trailing)
    }

    @ViewBuilder private var centre: some View {
        switch match.status {
        case .upcoming:
            Text(FPLDate.format(match.kickoff, "HH:mm"))
                .font(.system(size: 15, weight: .bold, design: .monospaced)).foregroundStyle(Theme.text)
        case .postponed:
            Text("TBC").font(.footnote.bold()).foregroundStyle(Theme.faint)
        case .live, .finished:
            VStack(spacing: 1) {
                Text("\(match.home.score ?? 0) – \(match.away.score ?? 0)")
                    .font(.system(size: 19, weight: .black, design: .monospaced)).foregroundStyle(Theme.text)
                if match.status == .live {
                    Text("● \(match.minutes)'").font(.caption2.bold()).foregroundStyle(Theme.sell)
                } else {
                    Text("FT").font(.caption2.bold()).foregroundStyle(Theme.faint)
                }
            }
        }
    }
}

/// Your squad (green) and watched (amber) players in a match, with their points.
struct FlowChips: View {
    let players: [MatchPlayer]

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 5) { chips }
            ScrollView(.horizontal, showsIndicators: false) { HStack(spacing: 5) { chips } }
        }
    }

    private var chips: some View {
        ForEach(players) { p in
            let tint = p.mine ? Theme.keep : Theme.watch
            HStack(spacing: 4) {
                PlayerPhoto(code: p.code, size: 20)
                if !p.mine { Image(systemName: "star.fill").font(.system(size: 8)) }
                Text(p.name).font(.system(size: 11.5, weight: .semibold))
                if let points = p.points { Text("\(points)").font(.system(size: 11.5, weight: .black)) }
            }
            .foregroundStyle(tint)
            .padding(.leading, 2).padding(.trailing, 8).padding(.vertical, 2)
            .background(tint.opacity(0.13), in: Capsule())
        }
    }
}

struct MatchReport: View {
    let match: Match

    var body: some View {
        VStack(spacing: 10) {
            if match.status == .upcoming || match.status == .postponed {
                Text(match.status == .postponed ? "Date to be confirmed." : "Not started yet.")
                    .font(.footnote).foregroundStyle(Theme.faint)
            } else {
                line("Goals", match.goals)
                line("Own goals", match.ownGoals)
                line("Assists", match.assists)
                line("Penalties saved", match.penaltiesSaved)
                line("Penalties missed", match.penaltiesMissed)
                line("Red cards", match.redCards)
                line("Yellow cards", match.yellowCards)
                line(match.bonusProvisional ? "Bonus, if it ended now" : "Bonus", match.bonus, points: true)
            }
            if !match.players.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Eyebrow("Your players")
                    ForEach(match.players) { p in
                        HStack(spacing: 8) {
                            PlayerPhoto(code: p.code, size: 28)
                            Text((p.mine ? "" : "★ ") + p.name)
                                .font(.footnote.bold()).foregroundStyle(p.mine ? Theme.keep : Theme.watch)
                            Spacer()
                            if let points = p.points {
                                Text("\(p.minutes.map { $0 > 0 ? "\($0)'" : "Not played" } ?? "") · \(points) pts")
                                    .font(.caption).foregroundStyle(Theme.secondary)
                            } else {
                                Text(p.mine ? "In your squad" : "Watching").font(.caption).foregroundStyle(Theme.faint)
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.top, 4)
    }

    @ViewBuilder private func line(_ label: String, _ items: [Incident], points: Bool = false) -> some View {
        if !items.isEmpty {
            VStack(spacing: 4) {
                Eyebrow(label)
                HStack(alignment: .top, spacing: 16) {
                    names(items.filter { $0.side == "h" }, points: points, alignment: .trailing)
                    names(items.filter { $0.side == "a" }, points: points, alignment: .leading)
                }
            }
        }
    }

    private func names(_ items: [Incident], points: Bool, alignment: HorizontalAlignment) -> some View {
        let highlighted = Dictionary(match.players.map { ($0.id, $0.mine) }, uniquingKeysWith: { a, _ in a })
        return VStack(alignment: alignment, spacing: 2) {
            ForEach(items, id: \.playerId) { i in
                let mine = highlighted[i.playerId]
                HStack(spacing: 3) {
                    Text(i.name)
                        .fontWeight(mine == nil ? .regular : .bold)
                        .foregroundStyle(mine == true ? Theme.keep : mine == false ? Theme.watch : Theme.text)
                    if points { Text("\(i.value)").foregroundStyle(Theme.faint).bold() }
                    else if i.value > 1 { Text("×\(i.value)").foregroundStyle(Theme.faint) }
                }
                .font(.footnote)
            }
        }
        .frame(maxWidth: .infinity, alignment: alignment == .leading ? .leading : .trailing)
    }
}
