-- Persistence for signed-in managers: their FPL entry id, and any squads they save.
--
-- Both tables live in `public`, which is exposed to the Data API, so RLS is mandatory and
-- every policy pairs `to authenticated` with an ownership predicate — `to authenticated`
-- alone would let any signed-in user read every row.

-- ---------------------------------------------------------------- profiles

create table if not exists public.profiles (
  -- one row per auth user; cascade so deleting the account removes the profile
  id uuid primary key references auth.users (id) on delete cascade,
  fpl_entry_id integer,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_fpl_entry_id_positive check (fpl_entry_id is null or fpl_entry_id > 0)
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

-- update needs both USING and WITH CHECK: without WITH CHECK a user could reassign the row
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "profiles: delete own" on public.profiles;
create policy "profiles: delete own" on public.profiles
  for delete to authenticated
  using ((select auth.uid()) = id);

-- ---------------------------------------------------------------- squads

create table if not exists public.squads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'My squad',
  -- 15 element ids in pick order: first 11 start, last 4 are the bench
  player_ids integer[] not null,
  captain_id integer,
  vice_captain_id integer,
  formation text,
  bank numeric(4, 1) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint squads_name_not_blank check (length(btrim(name)) between 1 and 60),
  constraint squads_fifteen_players check (array_length(player_ids, 1) = 15),
  constraint squads_bank_sane check (bank >= 0 and bank <= 100)
);

create index if not exists squads_user_id_updated_at_idx
  on public.squads (user_id, updated_at desc);

alter table public.squads enable row level security;

drop policy if exists "squads: read own" on public.squads;
create policy "squads: read own" on public.squads
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "squads: insert own" on public.squads;
create policy "squads: insert own" on public.squads
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "squads: update own" on public.squads;
create policy "squads: update own" on public.squads
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "squads: delete own" on public.squads;
create policy "squads: delete own" on public.squads
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- updated_at

-- SECURITY INVOKER (the default) — this only touches the row being written, so it has no
-- reason to run with the definer's privileges and bypass RLS.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists squads_set_updated_at on public.squads;
create trigger squads_set_updated_at
  before update on public.squads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- data API grants

-- Tables created by raw SQL are not always exposed to the Data API automatically. RLS above
-- decides which rows are visible; these grants decide whether the table is reachable at all.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.squads to authenticated;
