import SwiftUI

@main
struct FantasyTeamHubApp: App {
    @State private var auth = AuthStore()

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
        switch auth.state {
        case .loading:
            ZStack {
                Theme.background.ignoresSafeArea()
                LogoMark(size: 72)
            }
        case .signedOut:
            LoginView()
        case .signedIn:
            MainTabs(api: auth.api)
        }
    }
}

struct MainTabs: View {
    @State private var watch: WatchStore
    @State private var tab = Tab.squad

    enum Tab: Hashable { case matches, squad, players, watchlist }

    init(api: any FTHAPI) {
        _watch = State(initialValue: WatchStore(api: api))
        // Demo builds can open on a tab (`-demo -tab players`), so each screen can be captured
        // from the command line, which cannot tap.
        if Config.isDemo, let i = CommandLine.arguments.firstIndex(of: "-tab"),
           i + 1 < CommandLine.arguments.count {
            let name = CommandLine.arguments[i + 1]
            _tab = State(initialValue: [
                "matches": .matches, "squad": .squad, "players": .players, "watchlist": .watchlist,
            ][name] ?? .squad)
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
        .task { await watch.load() }
        .alert("Couldn't update the watchlist", isPresented: Binding(
            get: { watch.error != nil }, set: { if !$0 { watch.error = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(watch.error ?? "")
        }
    }
}
