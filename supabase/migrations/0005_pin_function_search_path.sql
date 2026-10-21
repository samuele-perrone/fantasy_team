-- Pin the trigger function's search_path.
--
-- Supabase's security advisor flags functions whose search_path is inherited from the caller
-- (lint 0011): a role that can create objects earlier on the path could shadow what the
-- function resolves. set_updated_at only calls now(), which lives in pg_catalog and is always
-- searched first, so an empty path costs nothing.

alter function public.set_updated_at() set search_path = '';
