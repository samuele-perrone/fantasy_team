# FantasyTeamHub for iOS

A native SwiftUI app with the website's four tabs (Matches, My Squad, Players, Watchlist). It
holds no logic of its own: every screen reads the website's `/api/v1`, so the app and the site
always agree. iPhone only, iOS 18 and later.

## Build and run

```bash
cd ios
xcodegen generate           # writes FantasyTeamHub.xcodeproj from project.yml (not committed)
open FantasyTeamHub.xcodeproj
```

Pick an iPhone simulator or your phone and press Run. From the command line:

```bash
xcodebuild -project FantasyTeamHub.xcodeproj -scheme FantasyTeamHub \
  -destination 'platform=iOS Simulator,name=iPhone 17' test
```

**Demo mode.** Debug builds launched with `-demo` skip sign-in and show bundled sample data,
so every screen can be checked without an account. Add it in Xcode under Product → Scheme →
Edit Scheme → Run → Arguments. `-tab matches|squad|players|watchlist` opens a tab and
`-detail` opens the first player's sheet, which is how screenshots are taken from the
command line, since it cannot tap. Release builds ignore all three.

## The API contract

`FantasyTeamHub/Resources/Fixtures/*.json` are real `/api/v1` responses, written by
`scripts/ios-fixtures.mts` using the server's own projection, verdict and match code. The
unit tests decode them. **Whenever an `/api/v1` response changes shape, regenerate them and
run the iOS tests**:

```bash
npx tsx scripts/ios-fixtures.mts     # from the repository root
```

A field renamed on the server then fails a test here instead of silently blanking a screen on
someone's phone. The fixtures name no real manager, because the repository is public.

## Signing in

The app opens on its tabs signed out: Matches and Players need no account, and My Squad works
from a team ID kept on the phone (`AuthStore.guestEntryId`), saved to the account on first
sign-in. Anything that needs an account calls `auth.requireSignIn()`, which opens the sign-in
sheet. Sign-in itself is Sign in with Apple (native, an ID token checked by Supabase) and Google (through Supabase, in
a browser sheet). App Store guideline 4.8 requires Apple sign-in of any app that offers Google.
The session is kept in the Keychain and refreshed by the Supabase Auth library; every request
sends its access token as a bearer token, which `getRequestAuth` on the server checks against
`ALLOWED_EMAILS` like a web session.

One-time setup, outside the code:

1. **Supabase → Authentication → URL Configuration → Redirect URLs:** add
   `fantasyteamhub://auth-callback`. Without it, Google sign-in ends on the website instead of
   returning to the app.
2. **Supabase → Authentication → Sign In / Providers → Apple:** enabled, with
   `com.fantasyteamhub.app` in **Client IDs**. Native Sign in with Apple needs no secret key;
   the website's Apple button does — see the RUNBOOK.
3. **Allow-list:** someone who signs in with Apple and chooses *Hide My Email* gets a relay
   address, which is not on `ALLOWED_EMAILS`, and is refused. Invited people should share their
   real email, or the relay address can be added to the list.

## Shipping to TestFlight

The app exists in App Store Connect as **FantasyTeamHub** (Apple ID 6825842076, SKU
`fantasyteamhub-ios`). Its internal group **Team** has automatic distribution on, so every
uploaded build reaches its testers through the TestFlight app once Apple has processed it,
usually within fifteen minutes.

To ship a new build, first raise `CURRENT_PROJECT_VERSION` in `project.yml`: App Store Connect
refuses a build number it has seen ("Redundant Binary Upload"). Then:

```bash
cd ios && xcodegen generate
xcodebuild -project FantasyTeamHub.xcodeproj -scheme FantasyTeamHub -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/FantasyTeamHub.xcarchive \
  -allowProvisioningUpdates archive
xcodebuild -exportArchive -archivePath build/FantasyTeamHub.xcarchive \
  -exportOptionsPlist ExportOptions.plist -exportPath build/export -allowProvisioningUpdates
```

The export uploads straight to App Store Connect (`destination: upload`), signing with the
Apple account Xcode is logged in to. Builds declare no non-exempt encryption
(`ITSAppUsesNonExemptEncryption`), so TestFlight does not stop to ask about export compliance.

## Layout

```
project.yml                      XcodeGen spec: targets, bundle ID, entitlements, Info.plist
FantasyTeamHub/App/              entry point, tabs, Config (API base, Supabase keys, demo flag)
FantasyTeamHub/API/              Codable models, LiveAPI (/api/v1), DemoAPI (fixtures)
FantasyTeamHub/Auth/             AuthStore (Google, Apple, Keychain session), LoginView
FantasyTeamHub/Features/         the four tabs
FantasyTeamHub/Shared/           theme, logo, photos, pills, player sheet, watchlist store
FantasyTeamHub/Resources/        asset catalog (app icon, launch colour), fixtures
FantasyTeamHubTests/             contract, request and date tests (Swift Testing)
scripts/make-app-icon.swift      renders the app icons from the logo's geometry
```

## iPhone Duo and wide windows

The app runs on iPhone Duo's outer and inner screens, in landscape, and side by side with
another app. What that relies on, and should stay true:

- built with the iOS 27.1 SDK or later (Xcode 27.1), so the app resizes rather than being
  letterboxed; no `UIRequiresFullScreen`
- every orientation allowed in `project.yml`; nothing reads the device orientation, idiom or
  `UIScreen.main`, only the window's own size
- list screens use `.readableWidth()` (`Shared/Components.swift`), which centres the rows at
  720pt at most when the window is wider; on a phone in portrait it changes nothing

To check: Xcode 27.1's **iPhone Duo** simulator needs the iOS 27.1 runtime
(`xcodebuild -downloadPlatform iOS -buildVersion 27.1`, ~8 GB), and opens and closes from the
controls under the device in Device Hub. A build with `TARGETED_DEVICE_FAMILY=1,2` on an iPad
simulator shows the wide layout without unfolding; do not commit that setting.

## Live match notifications

`Push/PushStore.swift` holds the settings and Apple's device token and keeps the server's copy
current (`PUT /api/v1/push`) whenever the token, a setting, the sign-in or the guest team
changes. `Push/NotificationsScreen.swift` is opened from the account menu on My Squad (and
`-demo -notifications`). Tapping a notification opens Matches. The entitlement is
`aps-environment: development` in `project.yml`; Xcode signs App Store and TestFlight builds
as production, and the app tells the server which environment its token belongs to.
