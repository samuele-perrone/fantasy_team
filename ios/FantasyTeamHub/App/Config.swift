import Foundation

/// Where the app talks to. All public values: the publishable key is designed to ship in
/// clients, and row-level security in the database is what protects the data.
enum Config {
    /// The website's JSON API. The app reads the same conclusions the web pages show.
    static let apiBase = URL(string: "https://fantasyteamhub.com/api/v1")!

    static let supabaseURL = URL(string: "https://xplgtysifprqfxmvkwjy.supabase.co")!
    static let supabasePublishableKey = "sb_publishable__4VZtk8y49NMFlFa0Vw54g_AZQBcwkd"

    /// Google sign-in comes back to the app on this address. It must be on Supabase's list of
    /// redirect URLs (Authentication → URL Configuration), and its scheme in Info.plist.
    static let authCallback = URL(string: "fantasyteamhub://auth-callback")!

    /// A player's headshot through the website's image optimiser: FPL's PNG is ~96 kB with no
    /// cache header, the optimised WebP ~6 kB and cached for a month. 128px covers the largest
    /// drawn size (64pt) on a 3× screen as far as FPL's 110px original allows.
    static func photoURL(code: Int) -> URL {
        let source = "https://resources.premierleague.com/premierleague/photos/players/110x140/p\(code).png"
        var url = URLComponents(string: "https://fantasyteamhub.com/_next/image")!
        url.queryItems = [
            URLQueryItem(name: "url", value: source),
            URLQueryItem(name: "w", value: "128"),
            URLQueryItem(name: "q", value: "75"),
        ]
        return url.url!
    }

    static func badgeURL(teamCode: Int) -> URL {
        URL(string: "https://resources.premierleague.com/premierleague/badges/50/t\(teamCode).png")!
    }

    /// Debug builds launched with `-demo` show bundled sample data and skip sign-in, so every
    /// screen can be checked in the simulator. Release builds ignore it.
    static var isDemo: Bool {
        #if DEBUG
        ProcessInfo.processInfo.arguments.contains("-demo")
        #else
        false
        #endif
    }
}
