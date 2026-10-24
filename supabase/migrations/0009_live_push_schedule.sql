-- Calls the live-push edge function once a minute, which sends live match notifications.
--
-- The function exits at once when nothing has changed, and refuses a second run within 40
-- seconds, so this costs one cheap call a minute. It reads the site's 60-second Matches cache,
-- so FPL sees no extra load. To pause notifications: select cron.unschedule('live-push');
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('live-push') where exists (select 1 from cron.job where jobname = 'live-push');
select cron.schedule(
  'live-push',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://xplgtysifprqfxmvkwjy.supabase.co/functions/v1/live-push',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);
