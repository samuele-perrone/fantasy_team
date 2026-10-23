import SwiftUI

/// Suggested buys for this week, and the players you are watching, each set against the squad
/// player they would replace.
struct WatchlistScreen: View {
    @Environment(AuthStore.self) private var auth
    @Environment(WatchStore.self) private var watch
    @State private var suggestions: [Suggestion]?
    @State private var watched: [WatchedPlayer] = []
    @State private var error: String?
    @State private var shown: Player?
    @State private var loadedAt: Date?
    @State private var loadedVersion = -1

    var body: some View {
        NavigationStack {
            if auth.isSignedIn {
                list
            } else {
                // The one tab that is all about the account.
                StateView(systemImage: "star", title: "Keep a watchlist",
                          message: "Sign in to star players and see who is worth buying for your squad, in the app and on the website.",
                          action: ("Sign in", { auth.signingIn = true }))
                    .background(Theme.background)
                    .navigationTitle("Watchlist")
            }
        }
    }

    private var list: some View {
        List {
            Section {
                if let suggestions {
                    if suggestions.isEmpty {
                        Text("Nobody you can afford is clearly better than what you have.")
                            .font(.footnote).foregroundStyle(Theme.secondary)
                    }
                    ForEach(suggestions) { s in
                        row(s.player, detail: "For \(s.replaces.name), about \(Int(s.gain.rounded())) more points over five gameweeks")
                    }
                } else {
                    Text("Load your squad on My Squad to see who is worth buying for it.")
                        .font(.footnote).foregroundStyle(Theme.secondary)
                }
            } header: {
                Text("Suggested this week")
            } footer: {
                Text("The best buys you can afford, whether or not anyone is marked Sell.")
            }
            .listRowBackground(Theme.surface)

            Section("Watching") {
                if watched.isEmpty {
                    Text("Nobody yet. Tap ☆ on a suggestion, a replacement or any player on the Players tab.")
                        .font(.footnote).foregroundStyle(Theme.secondary)
                }
                ForEach(watched) { w in
                    row(w.player, detail: comparison(w))
                }
            }
            .listRowBackground(Theme.surface)

            if let error {
                Text(error).font(.footnote).foregroundStyle(Theme.sell).listRowBackground(Color.clear)
            }
        }
        .scrollContentBackground(.hidden)
        .readableWidth()
        .background(Theme.background)
        .navigationTitle("Watchlist")
        .refreshable { await load() }
        .task(id: watch.version) {
            if watch.version != loadedVersion || isStale(loadedAt) { await load() }
        }
        .sheet(item: $shown) { PlayerDetailView(player: $0) }
    }

    private func row(_ p: Player, detail: String) -> some View {
        HStack(spacing: 10) {
            PlayerPhoto(code: p.code)
            VStack(alignment: .leading, spacing: 2) {
                PlayerLine(player: p)
                Text(detail).font(.footnote).foregroundStyle(Theme.secondary).lineLimit(2)
            }
            Spacer(minLength: 0)
            WatchButton(watched: watch.contains(p.id)) { watch.toggle(p.id) }
        }
        .contentShape(Rectangle())
        .onTapGesture { shown = p }
    }

    private func comparison(_ w: WatchedPlayer) -> String {
        guard let swap = w.swap else { return "Not affordable for anyone in your squad, or already yours" }
        if swap.gain >= 2 {
            return "Would replace \(swap.replaces.name), about \(Int(swap.gain.rounded())) more points over five gameweeks"
        }
        return swap.gain > 0 ? "Only slightly better than \(swap.replaces.name) for now"
            : "Not better than \(swap.replaces.name) yet"
    }

    private func load() async {
        async let list = auth.api.watchlist()
        async let squad = try? auth.api.squad(entryId: nil)
        do {
            watched = try await list.players
            suggestions = await squad?.suggestions
            loadedAt = .now
            loadedVersion = watch.version
            error = nil
        } catch is CancellationError {
        } catch {
            if loadedAt == nil { self.error = error.localizedDescription }
        }
    }
}
