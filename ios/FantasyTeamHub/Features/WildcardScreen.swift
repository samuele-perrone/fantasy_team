import SwiftUI

/// The best squad a wildcard could buy with the manager's money, pushed from My Squad. The same
/// conclusions as the website's /squad?view=wildcard.
struct WildcardScreen: View {
    @Environment(AuthStore.self) private var auth
    @State private var phase = Phase.loading
    @State private var shown: Player?
    /// Build around the watchlist; remembered between visits.
    @AppStorage("wildcardUsesWatchlist") private var useWatchlist = false

    enum Phase {
        case loading
        case loaded(WildcardView)
        case failed(String)
    }

    var body: some View {
        content
            .background(Theme.background)
            .navigationTitle("Wildcard")
            .navigationBarTitleDisplayMode(.inline)
            .refreshable { await load() }
            .task { if case .loading = phase { await load() } }
            .onChange(of: useWatchlist) { Task { await load() } }
            .sheet(item: $shown) { PlayerDetailView(player: $0) }
    }

    @ViewBuilder private var content: some View {
        switch phase {
        case .loading:
            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
        case .failed(let message):
            StateView(systemImage: "wifi.exclamationmark", title: "Couldn't build a wildcard squad", message: message,
                      action: ("Try again", { Task { await load() } }))
        case .loaded(let view):
            list(view)
        }
    }

    private func list(_ view: WildcardView) -> some View {
        let kept = Set(view.keptIds)
        let watched = Set(view.watchIds ?? [])
        let gain = Int(view.gain.rounded())
        return List {
            Section {
            } header: {
                VStack(alignment: .leading, spacing: 4) {
                    Text("GAMEWEEK \(view.nextEvent)")
                        .font(.system(size: 11, weight: .bold)).tracking(1.4).foregroundStyle(Theme.brand)
                    Text("Best squad for \(view.budget.money)")
                        .font(.title2.bold()).foregroundStyle(Theme.text)
                    Text("\(view.starters.count + view.bench.count - kept.count) new, \(kept.count) kept · costs \(view.cost.money) · \(view.formation)")
                        .font(.footnote).foregroundStyle(Theme.secondary)
                    Group {
                        if view.saveIt {
                            Text("Save your wildcard. ").bold()
                                + Text(gain > 0
                                    ? "This squad would score about \(gain) more points over the next five gameweeks than yours, which is within what our estimates can get wrong."
                                    : "Your squad is already about the best your money buys.")
                        } else {
                            Text("About \(gain) more points").bold()
                                + Text(" over the next five gameweeks than your current squad.")
                        }
                    }
                    .font(.subheadline)
                    .foregroundStyle(view.saveIt ? Theme.watch : Theme.brand)
                    .padding(.top, 6)
                }
                .textCase(nil)
                .padding(.leading, -12)
            }
            if auth.isSignedIn {
                Section {
                    Toggle(isOn: $useWatchlist) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Build around my watchlist").font(.subheadline.weight(.semibold))
                            Text("Keeps your starred players where the budget and squad rules allow.")
                                .font(.caption).foregroundStyle(Theme.secondary)
                        }
                    }
                    .tint(Theme.brandFill)
                    if useWatchlist, let skipped = view.watchSkipped, !skipped.isEmpty {
                        Text("Could not fit \(skipped.map(\.name).joined(separator: ", ")): unavailable, or no squad within budget and the squad rules could hold them.")
                            .font(.caption).foregroundStyle(Theme.faint)
                    } else if useWatchlist, watched.isEmpty {
                        Text("Your watchlist is empty. Star players on Players or My Squad to build around them.")
                            .font(.caption).foregroundStyle(Theme.faint)
                    }
                }
                .listRowBackground(Theme.surface)
            }
            Section("Starting XI") {
                ForEach(view.starters.sorted { $0.posId < $1.posId }) { p in row(p, view: view, kept: kept, watched: watched) }
            }
            Section {
                ForEach(view.bench) { p in row(p, view: view, kept: kept, watched: watched) }
            } header: {
                Text("Bench")
            } footer: {
                Text("Picked for the most points over the next five gameweeks, within FPL's squad rules. The budget is your bank plus what we estimate your players sell for. FPL keeps half of any price rise and does not publish what you paid, so we assume the least you would get. Our points estimates are typically off by about 1.6 points per player per week.")
                    .font(.caption).foregroundStyle(Theme.faint).padding(.top, 8)
            }
        }
        .scrollContentBackground(.hidden)
        .readableWidth()
    }

    private func row(_ p: Player, view: WildcardView, kept: Set<Int>, watched: Set<Int>) -> some View {
        Button { shown = p } label: {
            HStack(spacing: 10) {
                Text(kept.contains(p.id) ? "KEEP" : "NEW")
                    .font(.system(size: 10.5, weight: .black)).tracking(0.6)
                    .foregroundStyle(kept.contains(p.id) ? Theme.secondary : Theme.brand)
                    .frame(width: 52, height: 24)
                    .background((kept.contains(p.id) ? Theme.surfaceRaised : Theme.brand.opacity(0.15)),
                                in: RoundedRectangle(cornerRadius: 6))
                PlayerPhoto(code: p.code)
                    .overlay(alignment: .bottomTrailing) {
                        if p.id == view.captainId {
                            ArmBand(letter: "C").scaleEffect(0.8).offset(x: 4, y: 4)
                        } else if p.id == view.viceId {
                            ArmBand(letter: "V").scaleEffect(0.8).offset(x: 4, y: 4)
                        }
                    }
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        PlayerLine(player: p)
                        if watched.contains(p.id) {
                            Image(systemName: "star.fill").font(.caption2).foregroundStyle(Theme.watch)
                                .accessibilityLabel("From your watchlist")
                        }
                    }
                    (Text("\(p.xPtsNext, format: .number.precision(.fractionLength(1))) points next week")
                        + Text(" · \(p.xPts, format: .number.precision(.fractionLength(1))) over five").foregroundStyle(Theme.faint))
                        .font(.footnote).foregroundStyle(Theme.secondary)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(Theme.faint)
            }
            .padding(.vertical, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowBackground(Theme.surface)
    }

    private func load() async {
        do {
            // Signed out, the team is the one kept on the phone.
            phase = .loaded(try await auth.api.wildcard(
                entryId: auth.isSignedIn ? nil : auth.guestEntryId,
                watch: auth.isSignedIn && useWatchlist
            ))
        } catch is CancellationError {
        } catch {
            if case .loaded = phase { return }
            phase = .failed(error.localizedDescription)
        }
    }
}
