-- Allow partially built squads to be stored.
--
-- The builder autosaves on every edit so work is not lost on a refresh, and a squad being
-- built is by definition incomplete. Requiring exactly 15 meant a draft could only be saved
-- at the moment it happened to be finished, which is the one moment the user does not need
-- it saved.
--
-- Named saves are still required to be a legal 15 — that is enforced in saveSquad, where it
-- belongs, since it is a rule about finished squads rather than about the table.

alter table public.squads
  drop constraint if exists squads_fifteen_players;

alter table public.squads
  drop constraint if exists squads_at_most_fifteen;

-- cardinality() rather than array_length(), which returns NULL for an empty array and would
-- make the check pass by accident on an empty squad.
alter table public.squads
  add constraint squads_at_most_fifteen
  check (player_ids is not null and cardinality(player_ids) <= 15);
