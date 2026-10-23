-- FPL teams a manager has added, so they can switch between them by name.
--
-- profiles.fpl_entry_id stays the active team. Each team added is also kept here with the
-- name FPL gives it, read when it is added. A profile from before this table carries its
-- one team over the first time the list is read (src/lib/supabase/teams.ts), so nothing
-- needs backfilling here.

create table if not exists public.saved_teams (
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_id integer not null,
  name text not null,
  manager_name text,
  created_at timestamptz not null default now(),
  primary key (user_id, entry_id),
  constraint saved_teams_entry_id_positive check (entry_id > 0),
  constraint saved_teams_name_not_blank check (length(btrim(name)) between 1 and 60)
);

alter table public.saved_teams enable row level security;

drop policy if exists "saved_teams: read own" on public.saved_teams;
create policy "saved_teams: read own" on public.saved_teams
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "saved_teams: insert own" on public.saved_teams;
create policy "saved_teams: insert own" on public.saved_teams
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- upsert issues an update on conflict (a team re-added picks up a new name), so it needs one
drop policy if exists "saved_teams: update own" on public.saved_teams;
create policy "saved_teams: update own" on public.saved_teams
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "saved_teams: delete own" on public.saved_teams;
create policy "saved_teams: delete own" on public.saved_teams
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.saved_teams to authenticated;
