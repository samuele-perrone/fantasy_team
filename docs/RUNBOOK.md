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
| `NEXT_PUBLIC_GA_ID` | Google Analytics measurement ID. Analytics only load when this is set |
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

TTL is 4 hours, so allow for that when changing records — a stale local resolver will keep
returning Squarespace's IPs long after the change is live everywhere else. Test past a cache
with `curl --resolve fantasyteamhub.com:443:76.76.21.21 https://fantasyteamhub.com/login`.

Certificates are issued by Vercel automatically.

Supabase's redirect allow-list holds both hosts, which is what makes sign-in work on them.
Google Cloud Console needed **no change**, per the note above.

### Still outstanding

- Squarespace's nameservers remain authoritative. Moving them to `ns1.vercel-dns.com` /
  `ns2.vercel-dns.com` would consolidate DNS in Vercel. If that happens, recreate the SPF
  record (`TXT @ = v=spf1 -all`); there are no MX records to preserve.
- Pick a canonical host in Vercel's domain settings so the other redirects to it. The app
  declares the apex as canonical via `NEXT_PUBLIC_SITE_URL`.

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
