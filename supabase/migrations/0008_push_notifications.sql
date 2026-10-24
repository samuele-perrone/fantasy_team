-- Live match notifications: which phones want them, and what has already been announced.
--
-- Phones register whether or not someone is signed in: the app works signed out, with its FPL
-- team ID kept on the phone. Nobody reads or writes these tables directly. The app's API
-- saves a phone's settings through register_push_device() below, and the live-push edge
-- function, which runs with Supabase's own service role, reads them to send notifications.

create table if not exists public.push_devices (
  -- the APNs device token: what a notification is addressed to
  token text primary key,
  -- the account the phone was signed in to, if any; deleting the account removes the phone
  user_id uuid references auth.users (id) on delete cascade,
  -- a signed-out phone's FPL team, for "matches with my players"; signed in, the profile's
  -- active team is used instead
  entry_id integer,
  environment text not null default 'production',
  enabled boolean not null default true,
  scope text not null default 'mine',
  goals boolean not null default true,
  red_cards boolean not null default true,
  full_time boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint push_devices_token_hex check (token ~ '^[0-9a-f]{32,200}$'),
  constraint push_devices_environment check (environment in ('sandbox', 'production')),
  constraint push_devices_scope check (scope in ('mine', 'all')),
  constraint push_devices_entry_positive check (entry_id is null or entry_id > 0)
);

create index if not exists push_devices_enabled on public.push_devices (enabled) where enabled;

-- One row: the last Matches snapshot the edge function compared against, and when it ran.
create table if not exists public.push_state (
  id integer primary key default 1,
  snapshot jsonb,
  ran_at timestamptz,
  constraint push_state_single_row check (id = 1)
);
insert into public.push_state (id) values (1) on conflict (id) do nothing;

-- Row level security on, with no policies: no client can touch either table. The service role
-- the edge function runs as bypasses RLS.
alter table public.push_devices enable row level security;
alter table public.push_state enable row level security;

-- Saves a phone's notification settings, signed in or not. Keyed by the device token, which
-- only that phone and Apple know; the signed-in account, if any, comes from auth.uid() and is
-- never taken from the caller.
create or replace function public.register_push_device(
  p_token text,
  p_environment text,
  p_enabled boolean,
  p_scope text,
  p_goals boolean,
  p_red_cards boolean,
  p_full_time boolean,
  p_entry_id integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.push_devices as d
    (token, user_id, entry_id, environment, enabled, scope, goals, red_cards, full_time, updated_at)
  values
    (lower(p_token), auth.uid(), p_entry_id, p_environment, p_enabled, p_scope, p_goals,
     p_red_cards, p_full_time, now())
  on conflict (token) do update set
    user_id = excluded.user_id,
    entry_id = excluded.entry_id,
    environment = excluded.environment,
    enabled = excluded.enabled,
    scope = excluded.scope,
    goals = excluded.goals,
    red_cards = excluded.red_cards,
    full_time = excluded.full_time,
    updated_at = now();
end;
$$;

revoke all on function public.register_push_device(text, text, boolean, text, boolean, boolean, boolean, integer) from public;
grant execute on function public.register_push_device(text, text, boolean, text, boolean, boolean, boolean, integer) to anon, authenticated;
