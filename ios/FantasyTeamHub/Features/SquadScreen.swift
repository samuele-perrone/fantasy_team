import SwiftUI

/// My Squad: every player with a verdict and the reason in one line; tap for the numbers.
struct SquadScreen: View {
    @Environment(AuthStore.self) private var auth
    @State private var phase = Phase.loading
    @State private var shown: PlayerVerdict?
    @State private var enteringTeam = false

    enum Phase {
        case loading
        case needsTeam
        case loaded(SquadView)
        case failed(String)
    }

    var body: some View {
        NavigationStack {
            content
                .background(Theme.background)
                .navigationTitle("My Squad")
                .toolbar { accountMenu }
                .refreshable { await load() }
                .task { await load() }
                .sheet(item: $shown) { v in
                    PlayerDetailView(
                        player: v.player,
                        reason: v.reason,
                        replacements: v.verdict == .keep ? [] : v.replacements,
                        needsHit: v.needsHit
                    )
                }
                .sheet(isPresented: $enteringTeam) {
                    TeamIDForm { enteringTeam = false; Task { await load() } }
                        .presentationDetents([.medium])
                }
        }
    }

    @ViewBuilder private var content: some View {
        switch phase {
        case .loading:
            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
        case .needsTeam:
            TeamIDForm { Task { await load() } }
        case .failed(let message):
            StateView(systemImage: "wifi.exclamationmark", title: "Couldn't load your squad", message: message,
                      action: ("Try again", { Task { await load() } }))
        case .loaded(let view):
            squadList(view)
        }
    }

    private func squadList(_ view: SquadView) -> some View {
        let sells = view.verdicts.filter { $0.verdict == .sell }.count
        let watches = view.verdicts.filter { $0.verdict == .watch }.count
        return List {
            Section {
                VStack(alignment: .leading, spacing: 4) {
                    Text("GAMEWEEK \(view.team.nextEvent)")
                        .font(.system(size: 11, weight: .bold)).tracking(1.4).foregroundStyle(Theme.brand)
                    Text(view.team.name).font(.title2.bold()).foregroundStyle(Theme.text)
                    Text("\(view.team.bank.money) in the bank · \(view.team.freeTransfers) free transfer\(view.team.freeTransfers == 1 ? "" : "s")")
                        .font(.footnote).foregroundStyle(Theme.secondary)
                    Text(sells > 0 ? "\(sells) to sell, \(watches) to watch."
                         : watches > 0 ? "Nothing to sell. \(watches) to watch." : "Nothing to change this week.")
                        .font(.subheadline).foregroundStyle(Theme.text).padding(.top, 6)
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 4, leading: 4, bottom: 4, trailing: 4))
            }
            Section {
                ForEach(view.verdicts) { v in
                    Button { shown = v } label: { VerdictRow(verdict: v) }
                        .buttonStyle(.plain)
                        .listRowBackground(Theme.surface)
                }
            } footer: {
                Text("Verdicts compare each player with the best replacement you can afford over the next five gameweeks. Our points estimates are typically off by about 1.6 points per player per week, so a player is only marked Sell when the gap is clearly bigger than that. FPL does not show transfers you have made since the last deadline, so this is your squad as it stood then.")
                    .font(.caption).foregroundStyle(Theme.faint).padding(.top, 8)
            }
        }
        .scrollContentBackground(.hidden)
    }

    private var accountMenu: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                Button("Change team", systemImage: "arrow.left.arrow.right") { enteringTeam = true }
                Button("Sign out", systemImage: "rectangle.portrait.and.arrow.right", role: .destructive) {
                    Task { await auth.signOut() }
                }
            } label: {
                Image(systemName: "person.crop.circle").accessibilityLabel("Account")
            }
        }
    }

    private func load() async {
        do {
            let profile = try await auth.api.profile()
            guard profile.entryId != nil else {
                phase = .needsTeam
                return
            }
            let view = try await auth.api.squad()
            phase = .loaded(view)
            // Demo builds can open the first player's sheet (`-demo -detail`) for checking.
            if Config.isDemo, CommandLine.arguments.contains("-detail") { shown = view.verdicts.first }
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }
}

struct VerdictRow: View {
    let verdict: PlayerVerdict

    var body: some View {
        HStack(spacing: 10) {
            VerdictPill(verdict: verdict.verdict)
            PlayerPhoto(code: verdict.player.code)
            VStack(alignment: .leading, spacing: 2) {
                PlayerLine(player: verdict.player)
                Text(verdict.reason).font(.footnote).foregroundStyle(Theme.secondary).lineLimit(3)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(Theme.faint)
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }
}

/// Asks for the FPL team ID once; the server checks it with FPL before saving it.
struct TeamIDForm: View {
    @Environment(AuthStore.self) private var auth
    @State private var text = ""
    @State private var saving = false
    @State private var error: String?
    let saved: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Your FPL team ID").font(.title3.bold()).foregroundStyle(Theme.text)
            Text("Find it on the FPL website under Points: it's the number in the address, after /entry/. Every player then gets a verdict: keep, watch or sell.")
                .font(.footnote).foregroundStyle(Theme.secondary)
            TextField("e.g. 1234567", text: $text)
                .keyboardType(.numberPad)
                .textFieldStyle(.roundedBorder)
                .font(.title3.monospacedDigit())
            if let error {
                Text(error).font(.footnote).foregroundStyle(Theme.sell)
            }
            Button {
                Task { await save() }
            } label: {
                Text(saving ? "Checking…" : "Load my squad")
                    .font(.headline)
                    .foregroundStyle(Theme.ink)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .background(Theme.brandFill, in: RoundedRectangle(cornerRadius: 12))
            }
            .disabled(saving || Int(text) == nil)
            Spacer()
        }
        .padding(20)
        .background(Theme.background)
    }

    private func save() async {
        guard let id = Int(text.trimmingCharacters(in: .whitespaces)), id > 0 else {
            error = "That doesn't look like a team ID. It should be digits only."
            return
        }
        saving = true
        defer { saving = false }
        do {
            _ = try await auth.api.saveProfile(entryId: id)
            error = nil
            saved()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
