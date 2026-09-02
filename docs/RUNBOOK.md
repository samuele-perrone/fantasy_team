# Runbook

Operational detail: what is wired to what, how to change it, and what to check when
something breaks.

## Where things live

| Thing | Where |
| --- | --- |
| Repository | `github.com/samuele-perrone/fantasy_team` |
| Hosting | Vercel project `fantasy_team` (team `samueleperrone-9210s-projects`) |
| Current URL | `fantasyteamhub.com`, plus `www` and `fantasyteam.vercel.app` |
| Database + auth | Supabase project `ebfhufyataxktvfgkjkh` |

There is a second Supabase project, `yciikyzmesqcnvacurqv`, created by a marketplace install.
**It is not used.** It was disconnected from the Vercel project so it cannot re-sync its
environment variables over the real ones. Deleting it is safe but has not been done.

## Deploys

Vercel is connected to the repository, so:

- **merge or push to `main`** → production deploy, automatically
- **open a pull request** → its own preview URL

GitHub Actions runs lint, route typegen, typecheck and build on every push and PR. CI and the
Vercel build run in parallel, so **a red CI run does not currently block a deploy**. To make
it gate production, enable branch protection on `main` requiring the `Lint, types and build`
check, and work through pull requests.

Manual deploy if ever needed: `vercel deploy --prod --yes`.

## Environment variables

Set on Vercel across production, preview and development. Pull them locally with
`vercel env pull`.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser client key — public by design, RLS protects the data |
| `SUPABASE_*` | Server-side equivalents |
| `ALLOWED_EMAILS` | Comma-separated sign-in allow-list. **Fails closed** — unset means nobody can sign in |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for metadata |
| `NEXT_PUBLIC_GA_ID` | Google Analytics measurement ID. Analytics only load when this is set. Changing it needs a redeploy, since `NEXT_PUBLIC_*` values are inlined at build time |
| `FPL_API_BASE` | Local only — point the FPL client at a fixture server |

To add someone to the allow-list:

```bash
vercel env rm ALLOWED_EMAILS production --yes
printf 'you@example.com,them@example.com' | vercel env add ALLOWED_EMAILS production
```

It is read at runtime, not baked into the build, so no redeploy is needed. A bare
`@domain.com` entry admits everyone at that domain. Gmail dots and `+tags` are normalised, so
`a.b+fpl@gmail.com` and `ab@gmail.com` are treated as the same account.

## Database

Schema lives in `supabase/migrations/` and is applied by pasting into the Supabase SQL
editor at `https://supabase.com/dashboard/project/ebfhufyataxktvfgkjkh/sql/new`.
Migrations are written to be idempotent, so re-running is safe.

`scripts/db-push.mjs` can apply them over a direct Postgres connection instead, but it needs
`POSTGRES_URL_NON_POOLING` in `.env.local`. Those credentials went away when the unused
marketplace resource was disconnected, so the SQL editor is the working path today.

Two tables, both with row-level security:

- `profiles` — one row per auth user, holding their FPL entry id
- `squads` — named squads plus one reserved `__working_draft__` row per user, which is the
  builder's autosave and is hidden from the saved list

Every policy pairs `to authenticated` with an ownership predicate, and update policies carry
both `USING` and `WITH CHECK`. This was verified against the live database with two throwaway
users: reading, updating, deleting and forging another user's rows are all blocked, and
reassigning ownership is rejected.

## Authentication

Google OAuth through Supabase. Two things matter and are easy to confuse:

- **Google Cloud Console** holds the OAuth client, and its authorised redirect URI is the
  **Supabase** callback: `https://ebfhufyataxktvfgkjkh.supabase.co/auth/v1/callback`.
  This does **not** change when the app's own domain changes.
- **Supabase → Authentication → URL Configuration** holds the allow-list of app URLs it will
  redirect back to. This **does** need the new domain adding.

The app itself is origin-agnostic: the sign-in redirect is built from `location.origin` and
the callback from the request origin.

## The domain

`fantasyteamhub.com` and `www.fantasyteamhub.com` both serve the app from Vercel. DNS stays
on Squarespace's nameservers, with two custom records:

| Type | Name | Data |
| --- | --- | --- |
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |

TTL is 30 minutes. It was originally 4 hours, and a resolver that cached an answer under the
old TTL holds it for that long regardless of what the record says now — which looks exactly
like the site going down.

Before assuming an outage, check whether it is only your machine:

```bash
dig +short fantasyteamhub.com A            # your resolver
dig +short fantasyteamhub.com A @1.1.1.1   # a public one
curl -sI --resolve fantasyteamhub.com:443:216.150.1.1 https://fantasyteamhub.com/login
```

If the public resolver and the forced IP are healthy, it is a cache. Flush macOS with
`sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`, hard-reload the browser, or
test on mobile data, which uses a different resolver entirely.

`www` is configured in Vercel to redirect to the apex with a 307, preserving the path, so the
apex is the single canonical host. Certificates are issued by Vercel automatically.

Supabase's redirect allow-list holds both hosts, which is what makes sign-in work on them.
Google Cloud Console needed **no change**, per the note above.

### Optional, not required

- Squarespace's nameservers remain authoritative. Moving them to `ns1.vercel-dns.com` /
  `ns2.vercel-dns.com` would consolidate DNS in Vercel. If that happens, recreate the SPF
  record (`TXT @ = v=spf1 -all`); there are no MX records to preserve.
- Vercel flags a "DNS Change Recommended" badge suggesting `A @ 216.150.1.1` and a hashed
  CNAME for `www`, because it is expanding its IP range. Vercel states the current records
  keep working, and they do — the badge is an upgrade prompt, not a fault.

## Data freshness

| Data | Refresh |
| --- | --- |
| Player news, prices, ownership, squad rules (`bootstrap-static`) | 5 minutes |
| Fixtures and difficulty | 5 minutes |
| Live gameweek scores | 30 seconds |
| A manager's entry and picks | 1 minute |
| Player history (`element-summary`) | 10 minutes |

Everything driving squad logic — injury news, availability, prices, set-piece order and the
squad rules themselves — comes from `bootstrap-static` and is therefore at most five minutes
stale. The squad page shows what it is currently enforcing, and warns if FPL's published
rules ever diverge from what the app was built against.

## Backtesting

A scheduled workflow (`.github/workflows/backtest.yml`) runs twice daily, snapshots
projections for the upcoming gameweek, scores any gameweek that has finished, and commits the
results to `backtest/`. Snapshots are overwritten until the deadline passes, so the stored
projection is the last one made before kick-off.

`backtest/RESULTS.txt` holds the latest scoring run. `backtest/GW1_OUT_OF_SAMPLE.txt` is the
one-off gameweek-one check. Run any of it by hand with `npx tsx scripts/backtest.mjs
<snapshot|score|gw1>`.

The workflow pushes to `main`, so it needs `contents: write`, which is declared in the file.
Its commits carry `[skip ci]` to avoid triggering a pointless build.

## Analytics

Google Analytics loads through `@next/third-parties` and only when `NEXT_PUBLIC_GA_ID` is
set. Create a GA4 property, take the `G-XXXXXXXXXX` measurement ID, and set it as an
environment variable. Note the site is behind a login, so it will only ever record the
handful of people on the allow-list.

## When something breaks

**Sign-in redirects in a loop.** The app URL is missing from Supabase's redirect allow-list,
or `ALLOWED_EMAILS` is unset — it fails closed, and the login page says so explicitly.

**Everyone is denied.** Check `ALLOWED_EMAILS` exists in the right environment.

**A deploy fails on `FPL request failed (403)`.** FPL rate-limited the build. Requests retry
with backoff, and nothing is prerendered any more, so this should not recur — if it does, FPL
is likely blocking Vercel's egress and the fetch needs a proxy.

**Projections look absurd** (everyone rated near zero, premiums projecting 1–2 points).
Something has broken the minutes model or the per-90 rates. This happened at the season
rollover: FPL wipes season stats, and the model was reading a one-match sample as a full
season. See [DECISIONS.md](DECISIONS.md).

**Autosave shows "Could not autosave".** Migration `0002` has not been applied to the
database in use.

## Verifying changes locally

The whole site is behind the auth gate, so `curl` gets a 307 on every page. To check rendering
locally, temporarily neuter the redirect in `src/proxy.ts`:

```ts
if (false && !signedIn && !isPublic) return redirectTo("/login", pathname + search);
```

**Restore it from git afterwards** (`git checkout src/proxy.ts`) and confirm
`grep -c 'if (false &&' src/proxy.ts` returns 0 before committing.

## Ask about your squad (the AI panel)

`/my-team` has an **Ask about your squad** panel backed by Claude, talking to the **Anthropic
API directly**.

### Setup

```bash
vercel env add ANTHROPIC_API_KEY        # paste the key, select all three environments
vercel env pull .env.local              # for local development
```

Get the key from <https://console.anthropic.com> → API keys. Without it `/api/ask` returns
503 with a message saying so, rather than failing somewhere less obvious.

The model is pinned in `src/lib/ai/model.ts` (`claude-sonnet-5`). Override without a code
change:

```bash
vercel env add FTH_AI_MODEL             # e.g. claude-opus-5
```

### Why not the Vercel AI Gateway

The gateway needs no key at all — it authenticates with the deployment's `VERCEL_OIDC_TOKEN`.
It was the first implementation and it worked, but it serves models according to the **Vercel
plan**: on a free plan only `anthropic/claude-3-haiku` is available, rate-limited to roughly
one request every few minutes, which is enough to prove the wiring and nothing more. An
Anthropic key is billed by Anthropic and has no such gate, so that is what the panel uses.

To go back to the gateway, swap `chatModel()` in `src/lib/ai/model.ts` for a plain
`"anthropic/claude-sonnet-5"` string — the `ai` package resolves bare strings through the
gateway by default.

### Cost control

`/api/ask` calls `getUserId()` before spending anything, so it is gated by the same allow-list
as the rest of the site — **the proxy matcher does not cover API routes**. Threads are capped
at 24 messages and 2000 characters per message.

### Where the numbers come from

The model never does the maths. `src/lib/ai/squad-brief.ts` renders the squad, the
projections, the ranked transfer plans and the chip state as text, all computed by the same
code that renders the pages, and the prompt tells the model to use those figures rather than
derive its own. That is what keeps the chat from contradicting the page it sits on.

## "My squad is not showing my latest transfers"

Expected, and not fixable from here. FPL keeps a manager's picks private until the gameweek
deadline passes:

- `GET /entry/{id}/event/{n}/picks/` returns **404** for the upcoming gameweek
- `GET /entry/{id}/transfers/` does **not** list pending transfers either

Only `GET /api/my-team/{id}/` exposes the pending squad, and it requires the manager's own FPL
login session. The app has no way to obtain that, so `/my-team` shows the most recent published
side — the previous gameweek's.

`/my-team` now says so explicitly, with the deadline after which the new squad appears, and
links to `/squad` where the manager can enter or screenshot-import the side they have actually
picked and have it rated straight away. The AI brief carries the same warning, so the assistant
believes a manager who says they own a player it cannot see.

Before investigating a report like this, check `entry.current_event` against
`bootstrap.events` — if `current_event` matches the last finished gameweek, the app is correct
and the manager is describing an unpublished team.

## ALLOWED_EMAILS

Comma separated, and now also tolerant of newlines, semicolons and spaces — the dashboard's
multi-line field invites one address per line, which arrives either as a real newline or as the
literal characters `\` and `n`. Splitting on commas alone turned two addresses into a single
entry with two `@` signs that matched nobody, locking out everyone including addresses that had
worked before.

Set it in **all three environments** (Production, Preview, Development) and **redeploy** —
Vercel injects environment variables at deploy time, so an edit alone changes nothing on the
live site.

```bash
vercel env ls | grep ALLOWED_EMAILS     # check the age; an old timestamp means the edit did not save
vercel env rm ALLOWED_EMAILS production
vercel env add ALLOWED_EMAILS production
vercel redeploy <latest-production-url>
```

Bare domains work too: `@example.com` admits everyone at that domain. Gmail dots and `+tags`
are normalised, so `a.b+fpl@gmail.com` and `ab@gmail.com` are the same account.

The list fails closed: unset or empty denies everyone rather than opening the site.
