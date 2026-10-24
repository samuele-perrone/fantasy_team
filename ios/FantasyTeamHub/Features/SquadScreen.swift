import SwiftUI

/// My Squad: every player with a verdict and the reason in one line; tap for the numbers.
struct SquadScreen: View {
    @Environment(AuthStore.self) private var auth
    @State private var phase = Phase.loading
    @State private var shown: PlayerVerdict?
    @State private var enteringTeam = false
    @State private var loadedAt: Date?
    @State private var saved: TeamsView?
    @State private var switching = false
    @State private var teamError: String?
    @State private var confirmingDelete = false
    // Demo builds can open it directly (`-demo -notifications`) for checking.
    @State private var showingNotifications = Config.isDemo && CommandLine.arguments.contains("-notifications")
    @State private var deleteError: String?
    // Demo builds can open straight onto it (`-demo -wildcard`) for checking.
    @State private var showingWildcard = Config.isDemo && CommandLine.arguments.contains("-wildcard")

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
                .task { if isStale(loadedAt) { await load() } }
                // Signing in or out changes whose team this is.
                .onChange(of: auth.isSignedIn) { Task { await reload() } }
                .sheet(item: $shown) { v in
                    PlayerDetailView(
                        player: v.player,
                        reason: v.reason,
                        replacements: v.verdict == .keep ? [] : v.replacements,
                        needsHit: v.needsHit
                    )
                }
                .sheet(isPresented: $enteringTeam) {
                    TeamIDForm { enteringTeam = false; Task { await reload() } }
                        .presentationDetents([.medium])
                }
                .navigationDestination(isPresented: $showingWildcard) { WildcardScreen() }
                .sheet(isPresented: $showingNotifications) { NotificationsScreen() }
                .confirmationDialog(
                    "Delete your account?", isPresented: $confirmingDelete, titleVisibility: .visible
                ) {
                    Button("Delete account and everything saved", role: .destructive) {
                        Task {
                            do { try await auth.deleteAccount() } catch { deleteError = error.localizedDescription }
                        }
                    }
                } message: {
                    Text("Removes your account, your saved FPL teams and your watchlist, in the app and on the website. This cannot be undone. Your FPL team itself is not affected.")
                }
                .alert("Couldn't delete your account", isPresented: Binding(
                    get: { deleteError != nil }, set: { if !$0 { deleteError = nil } }
                )) {
                    Button("OK", role: .cancel) {}
                } message: {
                    Text("Nothing was deleted. \(deleteError ?? "")")
                }
                .alert("Couldn't change team", isPresented: Binding(
                    get: { teamError != nil }, set: { if !$0 { teamError = nil } }
                )) {
                    Button("OK", role: .cancel) {}
                } message: {
                    Text(teamError ?? "")
                }
        }
    }

    @ViewBuilder private var content: some View {
        switch phase {
        case .loading:
            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
        case .needsTeam:
            TeamIDForm { Task { await reload() } }
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
            // The summary is the section's header, not a row: a row is clipped to the section's
            // rounded corner, which cut the top off the G of "GAMEWEEK".
            Section {
            } header: {
                VStack(alignment: .leading, spacing: 4) {
                    Text("GAMEWEEK \(view.team.nextEvent)")
                        .font(.system(size: 11, weight: .bold)).tracking(1.4).foregroundStyle(Theme.brand)
                    teamMenu(current: view.team)
                    Text("\(view.team.bank.money) in the bank · \(view.team.freeTransfers) free transfer\(view.team.freeTransfers == 1 ? "" : "s")")
                        .font(.footnote).foregroundStyle(Theme.secondary)
                    Text(sells > 0 ? "\(sells) to sell, \(watches) to watch."
                         : watches > 0 ? "Nothing to sell. \(watches) to watch." : "Nothing to change this week.")
                        .font(.subheadline).foregroundStyle(Theme.text).padding(.top, 6)
                }
                // Headers are upper-cased by default, which would shout the team name.
                .textCase(nil)
                // Headers sit further in than rows; this keeps it where the row had it.
                .padding(.leading, -12)
            }
            if let pick = view.captain,
               let captain = view.verdicts.first(where: { $0.player.id == pick.playerId }) {
                Section {
                    Button { shown = captain } label: {
                        CaptainRow(pick: pick, captain: captain.player,
                                   vice: view.verdicts.first { $0.player.id == pick.viceId }?.player)
                    }
                    .buttonStyle(.plain)
                    .listRowBackground(Theme.surface)
                }
            }
            Section {
                Button { showingWildcard = true } label: {
                    HStack {
                        (Text("Thinking of a wildcard? ").bold().foregroundStyle(Theme.text)
                            + Text("See the best squad your money buys.").foregroundStyle(Theme.secondary))
                            .font(.subheadline)
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(Theme.faint)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .listRowBackground(Theme.surface)
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
        .readableWidth()
    }

    private var accountMenu: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                Button("Notifications…", systemImage: "bell") { showingNotifications = true }
                if auth.isSignedIn {
                    Button("Add a team", systemImage: "plus") { enteringTeam = true }
                    Button("Sign out", systemImage: "rectangle.portrait.and.arrow.right") {
                        Task { await auth.signOut() }
                    }
                    Button("Delete account…", systemImage: "trash", role: .destructive) {
                        confirmingDelete = true
                    }
                } else {
                    Button("Sign in", systemImage: "person.crop.circle") { auth.signingIn = true }
                    if auth.guestEntryId != nil {
                        Button("Use another team ID", systemImage: "number") { enteringTeam = true }
                    }
                }
            } label: {
                Image(systemName: "person.crop.circle").accessibilityLabel("Account")
            }
        }
    }

    /// The team's name, opening to the manager's saved teams to switch between them.
    private func teamMenu(current: SquadSummary) -> some View {
        Menu {
            if !auth.isSignedIn {
                Button("Use another team ID", systemImage: "number") { enteringTeam = true }
                Button("Sign in to save your teams", systemImage: "person.crop.circle") { auth.signingIn = true }
            } else {
                Section("Your teams") {
                    ForEach(saved?.teams ?? []) { t in
                        Button {
                            Task { await change { try await auth.api.switchTeam(entryId: t.entryId) } }
                        } label: {
                            if t.entryId == current.entryId {
                                Label(t.name, systemImage: "checkmark")
                            } else {
                                Text(t.name)
                            }
                        }
                        .disabled(t.entryId == current.entryId)
                    }
                }
                Button("Add another team", systemImage: "plus") { enteringTeam = true }
                if (saved?.teams.count ?? 0) > 0 {
                    Button("Remove \(current.name)", systemImage: "trash", role: .destructive) {
                        Task { await change { try await auth.api.removeTeam(entryId: current.entryId) } }
                    }
                }
            }
        } label: {
            HStack(spacing: 6) {
                Text(current.name).font(.title2.bold()).foregroundStyle(Theme.text).lineLimit(1)
                if switching {
                    ProgressView().controlSize(.small)
                } else {
                    Image(systemName: "chevron.down").font(.subheadline.bold()).foregroundStyle(Theme.secondary)
                }
            }
        }
        .accessibilityLabel("\(current.name). Switch team")
    }

    /// Switches or removes a team, then shows whichever team is now active.
    private func change(_ action: () async throws -> TeamsView) async {
        switching = true
        defer { switching = false }
        do {
            saved = try await action()
            await reload()
        } catch is CancellationError {
        } catch {
            teamError = error.localizedDescription
        }
    }

    /// Loads afresh, as after the team changes.
    private func reload() async {
        loadedAt = nil
        await load()
    }

    private func load() async {
        // Signed out, the team ID lives on the phone and the squad is fetched by it.
        guard auth.isSignedIn else {
            saved = nil
            guard let guest = auth.guestEntryId else { phase = .needsTeam; return }
            await show { try await auth.api.squad(entryId: guest) }
            return
        }
        // Just signed in after looking at a team as a guest: keep it, saved to the account.
        if let guest = auth.guestEntryId {
            _ = try? await auth.api.addTeam(entryId: guest)
            auth.guestEntryId = nil
        }
        async let teams = try? auth.api.teams()
        await show { try await auth.api.squad(entryId: nil) }
        saved = await teams
    }

    private func show(_ fetch: () async throws -> SquadView) async {
        do {
            // The squad endpoint uses the saved team ID, and says so with a 400 when there is
            // none, so one request does what a profile check and a squad load did.
            let view = try await fetch()
            loadedAt = .now
            phase = .loaded(view)
            // Demo builds can open the first player's sheet (`-demo -detail`) for checking.
            if Config.isDemo, CommandLine.arguments.contains("-detail") { shown = view.verdicts.first }
        } catch APIError.server(status: 400, _) {
            phase = .needsTeam
        } catch is CancellationError {
        } catch {
            // A failed refresh keeps the squad already on screen.
            if case .loaded = phase { return }
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
                // A flagged player's reason is FPL's news, so say how fresh it is.
                if let added = verdict.player.flaggedNewsAdded {
                    (Text(verdict.reason)
                        + Text(" · updated \(added, format: .relative(presentation: .named))").foregroundStyle(Theme.faint))
                        .font(.footnote).foregroundStyle(Theme.secondary).lineLimit(3)
                } else {
                    Text(verdict.reason).font(.footnote).foregroundStyle(Theme.secondary).lineLimit(3)
                }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(Theme.faint)
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }
}

/// Who to captain next gameweek, with the vice-captain underneath.
struct CaptainRow: View {
    let pick: CaptainPick
    let captain: Player
    let vice: Player?

    var body: some View {
        HStack(spacing: 10) {
            PlayerPhoto(code: captain.code, size: 44)
                .overlay(alignment: .bottomTrailing) { ArmBand(letter: "C").offset(x: 4, y: 4) }
            VStack(alignment: .leading, spacing: 2) {
                Eyebrow("Captain")
                PlayerLine(player: captain)
                (Text(pick.reason)
                    + Text(" · about \(pick.points, format: .number.precision(.fractionLength(1))) points, doubled as captain")
                        .foregroundStyle(Theme.faint))
                    .font(.footnote).foregroundStyle(Theme.secondary)
                if let vice, let points = pick.vicePoints {
                    (Text("Vice-captain: ") + Text(vice.name).bold().foregroundStyle(Theme.text)
                        + Text(", about \(points, format: .number.precision(.fractionLength(1))) points"))
                        .font(.caption).foregroundStyle(Theme.faint)
                }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(Theme.faint)
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

struct ArmBand: View {
    let letter: String

    var body: some View {
        Text(letter)
            .font(.system(size: 11, weight: .black))
            .foregroundStyle(Theme.ink)
            .frame(width: 22, height: 22)
            .background(Theme.brandFill, in: Circle())
            .accessibilityHidden(true)
    }
}

/// Asks for the FPL team ID once; the server checks it with FPL before saving it.
struct TeamIDForm: View {
    @Environment(AuthStore.self) private var auth
    @State private var text = ""
    @State private var saving = false
    @State private var error: String?
    @State private var showingHelp = false
    let saved: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Add an FPL team").font(.title3.bold()).foregroundStyle(Theme.text)
                Spacer()
                Button { showingHelp = true } label: {
                    Image(systemName: "info.circle").font(.title3)
                }
                .accessibilityLabel("Where do I find my team ID?")
            }
            Text(auth.isSignedIn
                 ? "Enter the team's FPL ID once. It's saved under its name, so after this you switch teams from My Squad."
                 : "Enter the team's FPL ID. It's kept on this phone; sign in to save teams to your account and switch between them.")
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
        .sheet(isPresented: $showingHelp) {
            FindYourID().presentationDetents([.medium, .large])
        }
    }

    private func save() async {
        guard let id = Int(text.trimmingCharacters(in: .whitespaces)), id > 0 else {
            error = "That doesn't look like a team ID. It should be digits only."
            return
        }
        saving = true
        defer { saving = false }
        do {
            if auth.isSignedIn {
                _ = try await auth.api.addTeam(entryId: id)
            } else {
                // Checked by loading it: FPL answers 404 for a team that does not exist.
                _ = try await auth.api.squad(entryId: id)
                auth.guestEntryId = id
            }
            error = nil
            saved()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

/// How to find an FPL team ID: the same steps as the website's (i).
struct FindYourID: View {
    @Environment(\.dismiss) private var dismiss
    private static let steps = [
        "Log in to the official Fantasy Premier League website.",
        "Open the **Pick Team** tab.",
        "Open your **Gameweek History** or **Transfer History**.",
        "Look at the address bar. Your ID is the number right after **/entry/**.",
    ]

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                ForEach(Array(Self.steps.enumerated()), id: \.offset) { i, step in
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        Text("\(i + 1)")
                            .font(.caption.bold())
                            .frame(width: 22, height: 22)
                            .background(Theme.surfaceRaised, in: Circle())
                        Text(.init(step)).font(.callout).foregroundStyle(Theme.text)
                    }
                }
                (Text("fantasy.premierleague.com/entry/").foregroundStyle(Theme.faint)
                    + Text("1234567").foregroundStyle(Theme.brand).bold()
                    + Text("/history").foregroundStyle(Theme.faint))
                    .font(.system(.footnote, design: .monospaced))
                    .padding(.top, 4)
                Text("The FPL app doesn't show the ID, so use a browser. You only need it once per team.")
                    .font(.footnote).foregroundStyle(Theme.secondary)
                Link(destination: URL(string: "https://fantasy.premierleague.com/")!) {
                    Text("Open the FPL website")
                        .font(.headline)
                        .foregroundStyle(Theme.ink)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .background(Theme.brandFill, in: RoundedRectangle(cornerRadius: 12))
                }
                Spacer()
            }
            .padding(20)
            .background(Theme.background)
            .navigationTitle("Find your team ID")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("Done") { dismiss() } }
        }
    }
}
