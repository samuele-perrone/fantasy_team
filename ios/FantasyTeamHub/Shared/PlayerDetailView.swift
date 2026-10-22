import SwiftUI

/// The numbers behind a row — the web's (i) panel — as a sheet.
struct PlayerDetailView: View {
    let player: Player
    var reason: String?
    var replacements: [Replacement] = []
    var needsHit = false

    @Environment(WatchStore.self) private var watch
    @Environment(\.dismiss) private var dismiss
    @State private var shown: Player?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    header
                    if let reason {
                        Text(reason).font(.callout).foregroundStyle(Theme.text)
                    }
                    numbers
                    fixtures
                    if let others = player.otherGames, !others.isEmpty {
                        alsoPlaying(others)
                    }
                    news
                    if needsHit {
                        Text("You have no free transfer left for this, so it costs 4 points. It is only marked Sell because the gain is expected to clear that by at least another 4.")
                            .font(.footnote)
                            .padding(12)
                            .background(Theme.watch.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
                    }
                    if !replacements.isEmpty {
                        replacementList
                    }
                }
                .padding(20)
            }
            .background(Theme.background)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    WatchButton(watched: watch.contains(player.id)) { watch.toggle(player.id) }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .sheet(item: $shown) { PlayerDetailView(player: $0) }
        }
    }

    private var header: some View {
        HStack(spacing: 14) {
            PlayerPhoto(code: player.code, size: 64)
            VStack(alignment: .leading, spacing: 3) {
                Text(player.fullName).font(.title3.bold()).foregroundStyle(Theme.text)
                Text("\(player.teamName) · \(player.pos) · \(player.cost.money)")
                    .font(.subheadline).foregroundStyle(Theme.secondary)
            }
        }
    }

    private var numbers: some View {
        let stats: [(String, String)] = [
            ("Points next game", player.xPtsNext.oneDP),
            ("Points next 5", player.xPts.oneDP),
            ("Minutes", "\(player.xMins)"),
            ("Chance of starting", "\(Int((player.startProb * 100).rounded()))%"),
            ("Form", player.form.oneDP),
            ("Season points", "\(player.totalPoints)"),
        ]
        return LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
            ForEach(stats, id: \.0) { label, value in
                VStack(alignment: .leading, spacing: 3) {
                    Text(label.uppercased())
                        .font(.system(size: 9.5, weight: .semibold))
                        .foregroundStyle(Theme.faint)
                        .lineLimit(2, reservesSpace: true)
                    Text(value).font(.system(size: 17, weight: .bold, design: .monospaced)).foregroundStyle(Theme.text)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(10)
                .background(Theme.surfaceRaised.opacity(0.6), in: RoundedRectangle(cornerRadius: 10))
            }
        }
    }

    private var fixtures: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow("Next games")
            FixtureRun(fixtures: player.fixtures)
            if let busy = player.fixtures.first(where: { $0.congested == true }) {
                Label("Three games in seven days around gameweek \(busy.event), counting the cups and Europe.",
                      systemImage: "circle.fill")
                    .labelStyle(DotLabelStyle())
                    .font(.footnote)
                    .foregroundStyle(Theme.watch)
            }
        }
    }

    private func alsoPlaying(_ games: [OtherGame]) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Eyebrow("Also playing")
            ForEach(games, id: \.self) { g in
                (Text(FPLDate.format(g.kickoff, "EEE d MMM") + " · ").foregroundStyle(Theme.faint)
                    + Text("\(g.competition) v \(g.opponent)").foregroundStyle(Theme.text)
                    + Text(g.isHome ? " (H)" : " (A)").foregroundStyle(Theme.faint))
                    .font(.footnote)
            }
        }
    }

    private var news: some View {
        VStack(alignment: .leading, spacing: 4) {
            Eyebrow("News")
            Text(player.news.isEmpty ? "No injury or team news." : player.news)
                .font(.footnote)
                .foregroundStyle(player.news.isEmpty ? Theme.faint : Theme.text)
            if let added = FPLDate.parse(player.newsAdded), !player.news.isEmpty {
                Text("Updated \(added, format: .relative(presentation: .named))")
                    .font(.caption).foregroundStyle(Theme.faint)
            }
        }
    }

    private var replacementList: some View {
        VStack(alignment: .leading, spacing: 8) {
            Eyebrow("Replace with")
            ForEach(replacements, id: \.player.id) { r in
                HStack(spacing: 10) {
                    PlayerPhoto(code: r.player.code, size: 34)
                    VStack(alignment: .leading, spacing: 2) {
                        PlayerLine(player: r.player)
                        Text("\(r.reason) · about \(Int(r.gain.rounded())) more points over five gameweeks")
                            .font(.caption).foregroundStyle(Theme.secondary)
                    }
                    Spacer(minLength: 0)
                    WatchButton(watched: watch.contains(r.player.id)) { watch.toggle(r.player.id) }
                }
                .contentShape(Rectangle())
                .onTapGesture { shown = r.player }
            }
        }
    }
}

/// A small coloured dot in place of an icon.
struct DotLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Circle().frame(width: 7, height: 7)
            configuration.title
        }
    }
}
