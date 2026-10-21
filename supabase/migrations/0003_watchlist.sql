-- Players a manager is keeping an eye on as possible transfers.
--
-- One row per user and FPL element. FPL element ids are reassigned every season, so a new
-- season's rollover should clear this table rather than leave it pointing at different
-- players.

create table if not exists public.watchlist (
  user_id uuid not null references auth.users (id) on delete cascade,
  element_id integer not null,
  created_at timestamptz not null default now(),
  primary key (user_id, element_id),
  constraint watchlist_element_id_positive check (element_id > 0)
);

alter table public.watchlist enable row level security;

drop policy if exists "watchlist: read own" on public.watchlist;
create policy "watchlist: read own" on public.watchlist
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "watchlist: insert own" on public.watchlist;
create policy "watchlist: insert own" on public.watchlist
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- upsert issues an update on conflict, so it needs an update policy too
drop policy if exists "watchlist: update own" on public.watchlist;
create policy "watchlist: update own" on public.watchlist
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "watchlist: delete own" on public.watchlist;
create policy "watchlist: delete own" on public.watchlist
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.watchlist to authenticated;
