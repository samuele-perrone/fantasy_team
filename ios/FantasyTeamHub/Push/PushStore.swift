import Foundation
import Observation
import UIKit
import UserNotifications

/// Live match notifications on this phone: the settings, Apple's device token, and keeping the
/// server's copy of both up to date (`PUT /api/v1/push`). The server's live-push function
/// sends the notifications; this only says what this phone wants.
@MainActor
@Observable
final class PushStore {
    static let shared = PushStore()

    enum Scope: String, CaseIterable, Codable, Sendable {
        case mine, all
    }

    var enabled: Bool { didSet { save() } }
    var scope: Scope { didSet { save() } }
    var goals: Bool { didSet { save() } }
    var redCards: Bool { didSet { save() } }
    var fullTime: Bool { didSet { save() } }

    /// Whether iOS lets the app show notifications at all.
    private(set) var permission: UNAuthorizationStatus = .notDetermined
    /// Apple's address for this phone, once it has registered.
    private(set) var token: String?
    var error: String?

    /// A notification was tapped; MainTabs switches to Matches.
    var openMatches = 0

    private let defaults = UserDefaults.standard

    private init() {
        enabled = defaults.bool(forKey: "push.enabled")
        scope = Scope(rawValue: defaults.string(forKey: "push.scope") ?? "") ?? .mine
        goals = defaults.object(forKey: "push.goals") as? Bool ?? true
        redCards = defaults.object(forKey: "push.redCards") as? Bool ?? true
        fullTime = defaults.object(forKey: "push.fullTime") as? Bool ?? true
    }

    private func save() {
        defaults.set(enabled, forKey: "push.enabled")
        defaults.set(scope.rawValue, forKey: "push.scope")
        defaults.set(goals, forKey: "push.goals")
        defaults.set(redCards, forKey: "push.redCards")
        defaults.set(fullTime, forKey: "push.fullTime")
    }

    func refreshPermission() async {
        permission = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }

    /// Asks iOS for permission the first time, then for Apple's device token, which arrives in
    /// the app delegate and comes back through `didRegister`.
    func turnOn() async {
        let center = UNUserNotificationCenter.current()
        let granted = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        await refreshPermission()
        enabled = granted
        if granted { UIApplication.shared.registerForRemoteNotifications() }
    }

    /// On every launch: re-register while switched on, so a changed token reaches the server.
    func start() async {
        await refreshPermission()
        if enabled, permission == .authorized { UIApplication.shared.registerForRemoteNotifications() }
    }

    func didRegister(token data: Data) {
        token = data.map { String(format: "%02x", $0) }.joined()
    }

    /// Sends this phone's settings to the server. `entryId` is the team kept on the phone when
    /// signed out; signed in, the server uses the account's active team.
    func sync(api: any FTHAPI, entryId: Int?) async {
        guard let token, !Config.isDemo else { return }
        do {
            try await api.savePush(PushSettings(
                token: token,
                environment: Self.environment,
                enabled: enabled && permission == .authorized,
                scope: scope.rawValue,
                goals: goals,
                redCards: redCards,
                fullTime: fullTime,
                entryId: entryId
            ))
            error = nil
        } catch is CancellationError {
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Debug builds get their device tokens from Apple's sandbox; TestFlight and the App Store
    /// from production. Sending to the wrong one fails, so the server is told which.
    static var environment: String {
        #if DEBUG
        "sandbox"
        #else
        "production"
        #endif
    }
}

/// Receives Apple's device token, and shows notifications that arrive while the app is open.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { @MainActor in PushStore.shared.didRegister(token: deviceToken) }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        let message = error.localizedDescription
        Task { @MainActor in PushStore.shared.error = "Couldn't register for notifications. \(message)" }
    }

    // A goal while the app is open still shows as a banner.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .list]
    }

    // Tapping a notification opens Matches.
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        await MainActor.run { PushStore.shared.openMatches += 1 }
    }
}
