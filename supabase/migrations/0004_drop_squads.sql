-- The squad builder was removed in the rebuild, and with it every reader of `squads`.
--
-- Destructive: export the table from the Supabase table editor first if its rows are wanted.
-- `profiles` stays — it holds the FPL team id the new app still uses.

drop table if exists public.squads;
