import SwiftUI

/// Every player, filtered by position, club, price and name, sorted by the chosen number.
struct PlayersScreen: View {
    @Environment(AuthStore.self) private var auth
    @Environment(WatchStore.self) private var watch
    @State private var query = BrowseQuery()
    @State private var search = ""
    @State private var result: PlayersView?
    @State private var error: String?
    @State private var shown: Player?
    @State private var loadedAt: Date?

    private static let prices: [Double] = [4.5, 5, 5.5, 6, 6.5, 7, 8, 9, 10, 12]

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Picker("Position", selection: $query.pos) {
                        Text("All").tag(Int?.none)
                        ForEach(1...4, id: \.self) { Text(["", "GKP", "DEF", "MID", "FWD"][$0]).tag(Int?.some($0)) }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }
                if let result {
                    Section {
                        ForEach(result.players) { p in
                            row(p)
                                .listRowBackground(Theme.surface)
                                .onAppear {
                                    // Load the next page as the last row comes into view.
                                    if p.id == result.players.last?.id, result.players.count < result.total {
                                        query.limit += 30
                                    }
                                }
                        }
                    } header: {
                        Text(result.total == 0 ? "No players match" : "\(result.total) players, by \(query.sort.label.lowercased())")
                    }
                } else if let error {
                    StateView(systemImage: "wifi.exclamationmark", title: "Couldn't load players", message: error,
                              action: ("Try again", { Task { await load() } }))
                        .listRowBackground(Color.clear)
                }
            }
            .scrollContentBackground(.hidden)
            .readableWidth()
            .background(Theme.background)
            .navigationTitle("Players")
            .searchable(text: $search, prompt: "Search by name")
            .onSubmit(of: .search) { query.q = search; query.limit = 30 }
            .onChange(of: search) { _, new in if new.isEmpty, !query.q.isEmpty { query.q = ""; query.limit = 30 } }
            .toolbar { filters }
            .task(id: query) {
                if result?.query != query || isStale(loadedAt) { await load() }
            }
            .sheet(item: $shown) { PlayerDetailView(player: $0) }
        }
    }

    private func row(_ p: Player) -> some View {
        HStack(spacing: 10) {
            PlayerPhoto(code: p.code)
            VStack(alignment: .leading, spacing: 2) {
                PlayerLine(player: p)
                Text(metric(p)).font(.footnote).foregroundStyle(Theme.secondary)
            }
            Spacer(minLength: 0)
            WatchButton(watched: watch.contains(p.id)) { watch.toggle(p.id) }
        }
        .contentShape(Rectangle())
        .onTapGesture { shown = p }
    }

    private func metric(_ p: Player) -> String {
        let next5 = "\(p.xPts.oneDP) pts next 5"
        switch query.sort {
        case .points5: return next5
        case .next: return "\(p.xPtsNext.oneDP) pts next game · \(next5)"
        case .form: return "Form \(p.form.oneDP) · \(next5)"
        case .season: return "\(p.totalPoints) pts this season · \(next5)"
        case .price: return "\(p.cost.money) · \(next5)"
        case .picked: return "\(p.selectedBy.oneDP)% picked · \(next5)"
        }
    }

    private var filters: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                Picker("Sort by", selection: $query.sort) {
                    ForEach(PlayerSort.allCases) { Text($0.label).tag($0) }
                }
                Picker("Club", selection: $query.team) {
                    Text("All clubs").tag(Int?.none)
                    ForEach(result?.teams ?? []) { Text($0.name).tag(Int?.some($0.id)) }
                }
                Picker("Maximum price", selection: $query.maxPrice) {
                    Text("Any price").tag(Double?.none)
                    ForEach(Self.prices, id: \.self) { Text("Up to \($0.money)").tag(Double?.some($0)) }
                }
            } label: {
                Image(systemName: "line.3.horizontal.decrease.circle")
                    .symbolVariant(query.team != nil || query.maxPrice != nil ? .fill : .none)
                    .accessibilityLabel("Sort and filter")
            }
        }
    }

    private func load() async {
        do {
            result = try await auth.api.players(query)
            loadedAt = .now
            error = nil
        } catch is CancellationError {
        } catch {
            self.error = error.localizedDescription
        }
    }
}
