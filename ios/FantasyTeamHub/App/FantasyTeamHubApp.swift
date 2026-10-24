import SwiftUI

@main
struct FantasyTeamHubApp: App {
    @State private var auth = AuthStore()
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    init() {
        // AsyncImage loads through URLSession.shared, whose default cache (512 kB in memory)
        // holds a few photos at most, so scrolling back up downloaded them again.
        URLCache.shared = URLCache(memoryCapacity: 32 * 1024 * 1024, diskCapacity: 200 * 1024 * 1024)
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(auth)
                .onOpenURL { auth.handle(url: $0) }
                .tint(Theme.brand)
        }
    }
}

struct RootView: View {
    @Environment(AuthStore.self) private var auth

    var body: some View {
        @Bindable var auth = auth
        switch auth.state {
        case .loading:
            ZStack {
                Theme.background.ignoresSafeArea()
                LogoMark(size: 72)
            }
        case .signedOut, .signedIn:
            // The tabs work signed out (App Store guideline 5.1.1); sign-in is a sheet that
            // whatever needs an account opens through AuthStore.requireSignIn.
            MainTabs(auth: auth)
                .sheet(isPresented: $auth.signingIn) { LoginView() }
        }
    }
}

struct MainTabs: View {
    @State private var watch: WatchStore
    @State private var push = PushStore.shared
    // Matches first: on a match day, the scores are what people open the app for.
    @State private var tab = Tab.matches

    enum Tab: Hashable { case matches, squad, players, watchlist }

    private let auth: AuthStore

    init(auth: AuthStore) {
        self.auth = auth
        _watch = State(initialValue: WatchStore(api: auth.api, requireSignIn: { auth.requireSignIn() }))
        // Demo builds can open on a tab (`-demo -tab players`), so each screen can be captured
        // from the command line, which cannot tap.
        if Config.isDemo, let i = CommandLine.arguments.firstIndex(of: "-tab"),
           i + 1 < CommandLine.arguments.count {
            let name = CommandLine.arguments[i + 1]
            _tab = State(initialValue: [
                "matches": .matches, "squad": .squad, "players": .players, "watchlist": .watchlist,
            ][name] ?? .matches)
        }
    }

    var body: some View {
        TabView(selection: $tab) {
            MatchesView()
                .tabItem { Label("Matches", systemImage: "soccerball") }
                .tag(Tab.matches)
            SquadScreen()
                .tabItem { Label("My Squad", systemImage: "tshirt") }
                .tag(Tab.squad)
            PlayersScreen()
                .tabItem { Label("Players", systemImage: "person.2") }
                .tag(Tab.players)
            WatchlistScreen()
                .tabItem { Label("Watchlist", systemImage: "star") }
                .tag(Tab.watchlist)
        }
        .environment(watch)
        .environment(push)
        // A tapped notification is about a match.
        .onChange(of: push.openMatches) { tab = .matches }
        .task { await push.start() }
        // Keep the server's copy of this phone's settings current: the token arriving, a
        // setting changing, signing in or out, or a signed-out visitor changing team.
        .task(id: PushSync(
            token: push.token, enabled: push.enabled, scope: push.scope, goals: push.goals,
            redCards: push.redCards, fullTime: push.fullTime, signedIn: auth.isSignedIn,
            guestEntryId: auth.guestEntryId
        )) {
            await push.sync(api: auth.api, entryId: auth.isSignedIn ? nil : auth.guestEntryId)
        }
        // Stars belong to the account: load them on sign-in, drop them on sign-out.
        .task(id: auth.isSignedIn) {
            if auth.isSignedIn { await watch.load() } else { watch.clear() }
        }
        .alert("Couldn't update the watchlist", isPresented: Binding(
            get: { watch.error != nil }, set: { if !$0 { watch.error = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(watch.error ?? "")
        }
    }
}

/// Everything the server's copy of the notification settings depends on.
private struct PushSync: Equatable {
    let token: String?
    let enabled: Bool
    let scope: PushStore.Scope
    let goals: Bool
    let redCards: Bool
    let fullTime: Bool
    let signedIn: Bool
    let guestEntryId: Int?
}
