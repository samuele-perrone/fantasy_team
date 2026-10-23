import Auth
import AuthenticationServices
import Foundation
import Observation

/// The signed-in state, and the API the screens use. Sessions live in the Keychain, so the app
/// stays signed in across launches, and tokens refresh themselves.
@MainActor
@Observable
final class AuthStore {
    enum State: Equatable {
        case loading
        case signedOut
        case signedIn(email: String?)
    }

    private(set) var state: State = .loading
    var error: String?

    let api: any FTHAPI
    private let auth: AuthClient?

    init() {
        if Config.isDemo {
            auth = nil
            api = DemoAPI()
            state = .signedIn(email: "demo@fantasyteamhub.com")
            return
        }
        let client = AuthClient(
            configuration: .init(
                url: Config.supabaseURL.appendingPathComponent("auth/v1"),
                headers: ["apikey": Config.supabasePublishableKey],
                flowType: .pkce,
                redirectToURL: Config.authCallback,
                localStorage: KeychainLocalStorage()
            )
        )
        auth = client
        api = LiveAPI(base: Config.apiBase) { try await client.session.accessToken }
        Task { await watchSession() }
    }

    private func watchSession() async {
        guard let auth else { return }
        // The stored session arrives first, possibly expired; the client refreshes it and
        // every API call asks for a fresh token, so an expired one still counts as signed in.
        for await (_, session) in auth.authStateChanges {
            state = session.map { .signedIn(email: $0.user.email) } ?? .signedOut
        }
    }

    func signInWithGoogle() async {
        guard let auth else { return }
        error = nil
        do {
            try await auth.signInWithOAuth(provider: .google, redirectTo: Config.authCallback)
        } catch let e as ASWebAuthenticationSessionError where e.code == .canceledLogin {
            // The manager closed the sheet; nothing to report.
        } catch {
            self.error = "Google sign-in didn't finish. \(error.localizedDescription)"
        }
    }

    func signOut() async {
        try? await auth?.signOut()
        if Config.isDemo { state = .signedOut }
    }

    /// The app is opened on fantasyteamhub://auth-callback when Google sign-in returns.
    func handle(url: URL) {
        auth?.handle(url)
    }
}
