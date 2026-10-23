-- Lets a signed-in user delete their own account, as App Store guideline 5.1.1(v) requires of
-- any app where an account can be created.
--
-- Deleting the auth.users row removes everything else: profiles, watchlist and saved_teams all
-- reference it with on delete cascade. The function runs as its owner (security definer)
-- because users cannot touch auth.users themselves, so it is written to do exactly one thing:
-- delete the caller's own row, found from auth.uid(), with no argument to point it elsewhere.
-- The site holds no service-role key, and this keeps it that way.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
