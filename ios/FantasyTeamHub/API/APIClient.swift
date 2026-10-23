import Foundation

enum APIError: LocalizedError, Equatable {
    /// No session, or the account is not on the site's allow-list.
    case unauthorized
    /// The server explained what was wrong, e.g. "No FPL team found for ID 1".
    case server(status: Int, message: String)
    case offline

    var errorDescription: String? {
        switch self {
        case .unauthorized:
            "This account can't use FantasyTeamHub yet. Sign in with an invited email address."
        case .server(_, let message):
            message
        case .offline:
            "Can't reach FantasyTeamHub. Check your connection and try again."
        }
    }
}

/// Everything the screens need from the server, so they can be shown with sample data.
protocol FTHAPI: Sendable {
    func squad() async throws -> SquadView
    func wildcard() async throws -> WildcardView
    func matches(gameweek: Int?) async throws -> MatchdayView
    func players(_ query: BrowseQuery) async throws -> PlayersView
    func watchlist() async throws -> WatchlistResponse
    func setWatched(_ playerId: Int, _ watched: Bool) async throws
    func profile() async throws -> Profile
    func saveProfile(entryId: Int) async throws -> Profile
    func teams() async throws -> TeamsView
    /// Adds a team, checked with FPL, and shows it on My Squad.
    func addTeam(entryId: Int) async throws -> TeamsView
    func switchTeam(entryId: Int) async throws -> TeamsView
    func removeTeam(entryId: Int) async throws -> TeamsView
}

/// Talks to the website's `/api/v1`, sending the Supabase access token as a bearer token.
struct LiveAPI: FTHAPI {
    let base: URL
    /// A fresh access token for every request; the auth client refreshes it when it expires.
    let token: @Sendable () async throws -> String
    var session: URLSession = .shared

    func squad() async throws -> SquadView {
        try await get("squad")
    }

    func wildcard() async throws -> WildcardView {
        try await get("wildcard")
    }

    func matches(gameweek: Int?) async throws -> MatchdayView {
        try await get("matches", query: gameweek.map { [URLQueryItem(name: "gw", value: String($0))] } ?? [])
    }

    func players(_ query: BrowseQuery) async throws -> PlayersView {
        try await get("players", query: Self.queryItems(for: query))
    }

    func watchlist() async throws -> WatchlistResponse {
        try await get("watchlist")
    }

    func setWatched(_ playerId: Int, _ watched: Bool) async throws {
        if watched {
            let _: [String: Bool] = try await send("watchlist", method: "POST", body: ["playerId": playerId])
        } else {
            let _: [String: Bool] = try await send(
                "watchlist", method: "DELETE",
                query: [URLQueryItem(name: "playerId", value: String(playerId))],
                body: nil as [String: Int]?
            )
        }
    }

    func profile() async throws -> Profile {
        try await get("profile")
    }

    func saveProfile(entryId: Int) async throws -> Profile {
        try await send("profile", method: "PUT", body: ["entryId": entryId])
    }

    func teams() async throws -> TeamsView {
        try await get("teams")
    }

    func addTeam(entryId: Int) async throws -> TeamsView {
        try await send("teams", method: "POST", body: ["entryId": entryId])
    }

    func switchTeam(entryId: Int) async throws -> TeamsView {
        try await send("teams", method: "PUT", body: ["entryId": entryId])
    }

    func removeTeam(entryId: Int) async throws -> TeamsView {
        try await send(
            "teams", method: "DELETE",
            query: [URLQueryItem(name: "entryId", value: String(entryId))],
            body: nil as [String: Int]?
        )
    }

    /// The Players filters as the server reads them (`parseBrowseQuery`), defaults left out.
    static func queryItems(for q: BrowseQuery) -> [URLQueryItem] {
        var items: [URLQueryItem] = []
        if !q.q.isEmpty { items.append(.init(name: "q", value: q.q)) }
        if let pos = q.pos { items.append(.init(name: "pos", value: ["", "GKP", "DEF", "MID", "FWD"][pos])) }
        if let team = q.team { items.append(.init(name: "team", value: String(team))) }
        if let max = q.maxPrice { items.append(.init(name: "max", value: String(max))) }
        if q.sort != .points5 { items.append(.init(name: "sort", value: q.sort.rawValue)) }
        if q.limit != 30 { items.append(.init(name: "n", value: String(q.limit))) }
        return items
    }

    func url(_ path: String, query: [URLQueryItem] = []) -> URL {
        var components = URLComponents(url: base.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        components.queryItems = query.isEmpty ? nil : query
        return components.url!
    }

    private func get<T: Decodable>(_ path: String, query: [URLQueryItem] = []) async throws -> T {
        try await send(path, method: "GET", query: query, body: nil as [String: Int]?)
    }

    private func send<T: Decodable, B: Encodable>(
        _ path: String, method: String, query: [URLQueryItem] = [], body: B? = nil
    ) async throws -> T {
        var request = URLRequest(url: url(path, query: query))
        request.httpMethod = method
        request.setValue("Bearer \(try await token())", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.httpBody = try JSONEncoder().encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError where error.code == .cancelled {
            // Leaving a tab cancels its request. That is not a failure to show anyone.
            throw CancellationError()
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            throw APIError.offline
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401 { throw APIError.unauthorized }
        guard (200..<300).contains(status) else {
            let message = (try? JSONDecoder().decode(APIErrorBody.self, from: data))?.error
            throw APIError.server(status: status, message: message ?? "Something went wrong (\(status)).")
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
