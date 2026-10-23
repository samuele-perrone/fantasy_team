import Foundation
import Testing
@testable import FantasyTeamHub

/// The fixtures are written by scripts/ios-fixtures.mts using the server's own code, so
/// decoding them checks the Swift models against what /api/v1 really sends.
@Suite("API contract")
struct ContractTests {
    @Test func decodesMySquad() throws {
        let view: SquadView = try Fixtures.load("squad")
        #expect(view.verdicts.count == 15)
        #expect(view.team.nextEvent > 0)
        // Sells first, as the page lists them
        let order = view.verdicts.map(\.verdict)
        #expect(order == order.sorted { rank($0) < rank($1) })
        #expect(view.verdicts.allSatisfy { !$0.player.fixtures.isEmpty || $0.player.status != "a" })
        // The captain and vice are players in the squad, referred to by ID
        let pick = try #require(view.captain)
        let ids = Set(view.verdicts.map(\.player.id))
        #expect(ids.contains(pick.playerId) && pick.viceId.map(ids.contains) != false)
        #expect(pick.points >= (pick.vicePoints ?? 0))
    }

    @Test func decodesMatches() throws {
        let view: MatchdayView = try Fixtures.load("matches")
        let matches = view.days.flatMap(\.matches)
        #expect(matches.count == 10)
        #expect(matches.allSatisfy { $0.status == .finished })
        // Goals and own goals add up to the score in every match
        for m in matches {
            let goals = (m.goals + m.ownGoals).reduce(0) { $0 + $1.value }
            #expect(goals == (m.home.score ?? 0) + (m.away.score ?? 0), "\(m.home.name) v \(m.away.name)")
        }
        #expect(matches.contains { !$0.players.isEmpty })
    }

    @Test func decodesPlayersAndTheirQuery() throws {
        let view: PlayersView = try Fixtures.load("players")
        #expect(view.players.count == 30)
        #expect(view.query.sort == .points5)
        #expect(view.teams.count == 20)
        #expect(view.players == view.players.sorted { $0.xPts > $1.xPts || ($0.xPts == $1.xPts && $0.id < $1.id) })
    }

    @Test func decodesWatchlistAndProfile() throws {
        let list: WatchlistResponse = try Fixtures.load("watchlist")
        #expect(!list.players.isEmpty)
        let profile: Profile = try Fixtures.load("profile")
        #expect(profile.entryId != nil)
    }

    @Test func decodesSavedTeams() throws {
        let view: TeamsView = try Fixtures.load("teams")
        #expect(view.teams.count == 2)
        #expect(view.active == view.teams.first?.entryId)
    }

    @Test func demoTeamsSwitchAndFallBackWhenTheActiveOneIsRemoved() async throws {
        let api = DemoAPI()
        let start = try await api.teams()
        let other = try #require(start.teams.last?.entryId)
        #expect(try await api.switchTeam(entryId: other).active == other)
        let after = try await api.removeTeam(entryId: other)
        #expect(after.active == after.teams.first?.entryId)
        #expect(!after.teams.contains { $0.entryId == other })
    }

    private func rank(_ v: Verdict) -> Int {
        switch v { case .sell: 0; case .watch: 1; case .keep: 2 }
    }
}

@Suite("Requests")
struct RequestTests {
    let api = LiveAPI(base: URL(string: "https://example.com/api/v1")!) { "token" }

    @Test func leavesDefaultFiltersOutOfTheURL() {
        #expect(LiveAPI.queryItems(for: BrowseQuery()).isEmpty)
    }

    @Test func writesFiltersTheWayTheServerReadsThem() {
        var q = BrowseQuery()
        q.q = "saka"
        q.pos = 3
        q.team = 1
        q.maxPrice = 7.5
        q.sort = .form
        q.limit = 60
        let items = Dictionary(uniqueKeysWithValues: LiveAPI.queryItems(for: q).map { ($0.name, $0.value ?? "") })
        #expect(items == ["q": "saka", "pos": "MID", "team": "1", "max": "7.5", "sort": "form", "n": "60"])
    }

    @Test func loadsPhotosThroughTheImageOptimiser() throws {
        let url = try #require(URLComponents(url: Config.photoURL(code: 223094), resolvingAgainstBaseURL: false))
        #expect(url.host == "fantasyteamhub.com" && url.path == "/_next/image")
        let query = Dictionary(uniqueKeysWithValues: (url.queryItems ?? []).map { ($0.name, $0.value ?? "") })
        // The website only optimises widths in next.config's imageSizes, and only FPL's photos.
        #expect(query["w"] == "128")
        #expect(query["url"] == "https://resources.premierleague.com/premierleague/photos/players/110x140/p223094.png")
    }

    @Test func buildsPathsUnderTheAPIBase() {
        #expect(api.url("matches", query: [URLQueryItem(name: "gw", value: "7")]).absoluteString
            == "https://example.com/api/v1/matches?gw=7")
    }
}

@Suite("Dates")
struct DateTests {
    @Test func readsFPLAndESPNTimestamps() {
        #expect(FPLDate.parse("2026-10-23T17:30:00Z") != nil)
        #expect(FPLDate.parse("2026-10-19T10:00:00.123Z") != nil)
        #expect(FPLDate.parse("2026-11-04T20:00Z") != nil)
        #expect(FPLDate.parse(nil) == nil)
    }

    @Test func datesNewsOnlyWhileThePlayerIsFlagged() throws {
        let fit = try player(status: "a", news: "", availability: nil)
        let cleared = try player(status: "a", news: "Back in training", availability: 100)
        let doubt = try player(status: "d", news: "Knee injury - 75% chance of playing", availability: 75)
        let out = try player(status: "i", news: "Hamstring injury", availability: 0)
        let undated = try player(status: "i", news: "", availability: 0)
        #expect(!fit.isFlagged && !cleared.isFlagged && doubt.isFlagged && out.isFlagged)
        #expect(fit.flaggedNewsAdded == nil)
        #expect(cleared.flaggedNewsAdded == nil)
        #expect(undated.flaggedNewsAdded == nil)
        #expect(doubt.flaggedNewsAdded == FPLDate.parse("2026-10-22T09:30:00Z"))
        #expect(out.flaggedNewsAdded != nil)
    }

    /// A real player from the fixtures with the news fields replaced.
    private func player(status: String, news: String, availability: Int?) throws -> Player {
        let view: SquadView = try Fixtures.load("squad")
        var json = try JSONSerialization.jsonObject(with: JSONEncoder().encode(view.verdicts[0].player)) as! [String: Any]
        json["status"] = status
        json["news"] = news
        json["availability"] = availability ?? NSNull()
        json["newsAdded"] = "2026-10-22T09:30:00Z"
        return try JSONDecoder().decode(Player.self, from: JSONSerialization.data(withJSONObject: json))
    }

    @Test func showsKickoffsInUKTime() {
        // 19:00 UTC in late October is 19:00 GMT; in August it is 20:00 BST
        #expect(FPLDate.format("2026-10-30T19:00:00Z", "HH:mm") == "19:00")
        #expect(FPLDate.format("2026-08-21T19:00:00Z", "HH:mm") == "20:00")
    }
}
