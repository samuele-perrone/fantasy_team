import Auth
import AuthenticationServices
import CryptoKit
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
    /// The sign-in sheet. The app opens on its tabs signed out (App Store guideline 5.1.1);
    /// saving teams, stars and the watchlist ask for an account when they are used.
    var signingIn = false

    var isSignedIn: Bool {
        if case .signedIn = state { true } else { false }
    }

    /// True when signed in; otherwise opens the sign-in sheet and returns false, so a feature
    /// that needs an account can ask in one line.
    func requireSignIn() -> Bool {
        if isSignedIn { return true }
        signingIn = true
        return false
    }

    /// The team a signed-out visitor is looking at, kept on the phone only. Signing in saves it
    /// to the account (see SquadScreen).
    var guestEntryId: Int? = UserDefaults.standard.object(forKey: "guestEntryId") as? Int {
        didSet { UserDefaults.standard.set(guestEntryId, forKey: "guestEntryId") }
    }

    let api: any FTHAPI
    private let auth: AuthClient?
    /// The raw nonce for the Sign in with Apple request in flight; Apple returns its hash.
    private var appleNonce: String?

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
        api = LiveAPI(base: Config.apiBase) { try? await client.session.accessToken }
        Task { await watchSession() }
    }

    private func watchSession() async {
        guard let auth else { return }
        // The stored session arrives first, possibly expired; the client refreshes it and
        // every API call asks for a fresh token, so an expired one still counts as signed in.
        for await (_, session) in auth.authStateChanges {
            state = session.map { .signedIn(email: $0.user.email) } ?? .signedOut
            if session != nil { signingIn = false }
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

    /// Prepares the Sign in with Apple request with a fresh nonce, which Supabase checks.
    func prepareAppleRequest(_ request: ASAuthorizationAppleIDRequest) {
        let nonce = Self.randomNonce()
        appleNonce = nonce
        request.requestedScopes = [.email]
        request.nonce = SHA256.hash(data: Data(nonce.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    func completeApple(_ result: Result<ASAuthorization, any Error>) async {
        guard let auth else { return }
        error = nil
        switch result {
        case .success(let authorization):
            guard
                let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                let tokenData = credential.identityToken,
                let idToken = String(data: tokenData, encoding: .utf8),
                let nonce = appleNonce
            else {
                error = "Apple didn't return a sign-in token. Try again."
                return
            }
            do {
                try await auth.signInWithIdToken(
                    credentials: .init(provider: .apple, idToken: idToken, nonce: nonce)
                )
            } catch {
                self.error = "Apple sign-in didn't finish. \(error.localizedDescription)"
            }
        case .failure(let e as ASAuthorizationError) where e.code == .canceled:
            break
        case .failure(let e):
            error = "Apple sign-in didn't finish. \(e.localizedDescription)"
        }
    }

    /// Deletes the account on the server, then signs out here. Throws if the server did not
    /// confirm, so nobody is told their account is gone when it is not.
    func deleteAccount() async throws {
        try await api.deleteAccount()
        await signOut()
    }

    func signOut() async {
        try? await auth?.signOut()
        if Config.isDemo { state = .signedOut }
    }

    /// The app is opened on fantasyteamhub://auth-callback when Google sign-in returns.
    func handle(url: URL) {
        auth?.handle(url)
    }

    private static func randomNonce(length: Int = 32) -> String {
        let chars = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var generator = SystemRandomNumberGenerator()
        return String((0..<length).map { _ in chars.randomElement(using: &generator)! })
    }
}
