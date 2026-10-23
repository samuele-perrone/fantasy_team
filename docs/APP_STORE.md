# App Store submission

Everything App Store Connect asks for, drafted to copy in. Apple ID 6825842076, bundle ID
`com.fantasyteamhub.app`. Screenshots are in `ios/AppStore/screenshots/`.

**Still open before submitting** (see the release checklist in the conversation of 23 Oct 2026):

- **Public** release (decided 23 Oct 2026): `ALLOWED_EMAILS` is `*` in production, so any
  Apple or Google account can sign in, including the reviewer's
- **Premier League photos and club badges stay** (decided 23 Oct 2026), knowing guideline 5.2
  can reject apps showing another company's images without permission. If review rejects it,
  the fallback is placeholder avatars and club initials, and retaken screenshots
- `support@fantasyteamhub.com` must forward before submitting: Squarespace → Domains →
  fantasyteamhub.com → Email forwarding → to the owner's inbox

## App information

| Field | Value |
|---|---|
| Name (30) | FantasyTeamHub |
| Subtitle (30) | Fantasy football squad advice |
| Primary category | Sports |
| Secondary category | — |
| Age rating | 4+ (no gambling: the fantasy game is free, with no real-money prizes in the app) |
| Price | Free |
| Privacy policy URL | https://fantasyteamhub.com/privacy |
| Support URL | https://fantasyteamhub.com/support |
| Marketing URL | — |
| Copyright | 2026 *(owner's name)* |

The name and subtitle avoid "Premier League" and "FPL", which are trademarks: using them in
the name is a common 5.2 rejection. The description can say what the app works with.

## Promotional text (170)

Captain picks for the next gameweek, a wildcard squad built for your budget, and keep, watch
or sell for every player in your team.

## Description (4000)

FantasyTeamHub looks at your fantasy football squad and tells you, in one line per player,
whether to keep them, watch them or sell them, and who to bring in instead.

ADD YOUR TEAM ONCE
Enter your Fantasy Premier League team ID and it is saved under its name. Add more teams and
switch between them in a tap.

KEEP, WATCH OR SELL
Every player is compared with the best replacement you can afford over the next five
gameweeks, counting fixtures, minutes, injuries and suspensions. A player is only marked Sell
when the gap is clearly bigger than what the estimates can get wrong.

CAPTAIN
The player in your squad expected to score the most next gameweek, with a vice-captain, and a
plain "close call" when it is.

WILDCARD
Thinking of a wildcard? See the best fifteen your money buys, which of your players it keeps,
and whether it is worth the chip at all.

LIVE MATCHES
Every Premier League match of the gameweek with live scores and your players picked out.

PLAYERS AND WATCHLIST
Browse and filter every player, star the ones you are watching, and see who your money would
replace.

INJURY NEWS
Flags and news from the official game, with how long ago it was updated.

Works on iPhone, including iPhone Duo open or closed, and on the web at fantasyteamhub.com
with the same account.

FantasyTeamHub is independent and not affiliated with the Premier League or Fantasy Premier
League.

## Keywords (100, comma-separated, no spaces)

fantasy,football,soccer,captain,wildcard,transfers,squad,gameweek,points,fixtures,injuries

## App Privacy ("nutrition label")

Tracking: **No** — no data is used to track people across other companies' apps or websites.

Data collected, all **linked to the user**, all for **App Functionality** only:

| Category | Type | Why |
|---|---|---|
| Contact Info | Email Address | Sign in with Apple or Google |
| Contact Info | Name | shared by Apple or Google at sign-in |
| Identifiers | User ID | the account's ID, which keys the saved data |
| User Content | Other User Content | FPL team IDs added, starred players |

Not collected by the app: location, contacts, browsing or search history, usage data,
diagnostics, financial info, health, photos. (The website's Google Analytics is not part of
the app and is covered by the privacy policy.)

## Account deletion (guideline 5.1.1(v))

In the app: My Squad → account menu (top right) → **Delete account…** → confirm. On the web:
Account → Delete account. Both remove the sign-in, saved teams and watchlist at once
(`delete_my_account()`, migration 0007).

## Sign in with Apple (guideline 4.8)

Offered beside Google on the app's sign-in screen and the website's login page.

## Export compliance

`ITSAppUsesNonExemptEncryption` is false in the build (HTTPS only), so no questions.

## App Review notes (draft)

> FantasyTeamHub gives advice on a Fantasy Premier League squad. Any Apple or Google account
> can sign in. To see My Squad, enter an FPL team ID when asked: 849650 is a real public team
> you can use. Matches, Players and Watchlist work without a team. Account deletion: My Squad →
> account menu (top right) → Delete account.

## Screenshots

`ios/AppStore/screenshots/6.9/` — 1320×2868, iPhone 17 Pro Max, from the app's demo data
(`-demo`), status bar set to 9:41:

1. My Squad — captain and verdicts
2. Wildcard — best squad for the budget
3. Matches — results with your players
4. Players — browse by points
5. A player's numbers and replacements
6. Watchlist — suggested buys

To retake: boot an iPhone 17 Pro Max simulator, `xcrun simctl status_bar <id> override --time
9:41 --batteryState charged --batteryLevel 100`, install a Debug build, and launch with
`-demo -tab <squad|matches|players|watchlist>` (add `-wildcard` or `-detail`).
