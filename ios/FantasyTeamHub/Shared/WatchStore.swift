import Foundation
import Observation

/// Which players are starred, shared by every tab so a star set on one shows on all of them.
@MainActor
@Observable
final class WatchStore {
    private(set) var ids: Set<Int> = []
    /// Bumped on every change, so the Watchlist tab knows to reload its comparisons.
    private(set) var version = 0
    var error: String?

    private let api: any FTHAPI

    init(api: any FTHAPI) {
        self.api = api
    }

    func load() async {
        if let list = try? await api.watchlist() {
            ids = Set(list.players.map(\.player.id))
        }
    }

    func contains(_ id: Int) -> Bool { ids.contains(id) }

    /// Optimistic: the star changes at once and goes back if the server refuses.
    func toggle(_ id: Int) {
        let watch = !ids.contains(id)
        if watch { ids.insert(id) } else { ids.remove(id) }
        Task {
            do {
                try await api.setWatched(id, watch)
                version += 1
            } catch {
                if watch { ids.remove(id) } else { ids.insert(id) }
                self.error = error.localizedDescription
            }
        }
    }
}
