-- Build 10 (16 Nov 2026, mockup money-v6 screen 7): reminders for everyone, not only admins.
-- A notification 3 days before a balance is due, and on the day. Anyone signed in can turn
-- notifications on for their phone (Me → Reminders); admins still get their own alerts on top.
-- A daily job asks the notify function to send them (13:00 UTC: morning in the Caribbean,
-- afternoon in Europe).

drop policy "push: admins manage their own phones" on public.push_subscriptions;
create policy "push: everyone manages their own phones" on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Only where the scheduler exists (Supabase): not in the tests' local Postgres.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net with schema extensions;

    create or replace function private.send_reminders() returns void
    language plpgsql security definer set search_path = '' as $f$
    begin
      perform net.http_post(
        url := 'https://pvfraoarogagrobqvpzo.supabase.co/functions/v1/notify',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-hook-token', (select hook_token from private.push_settings where id = 1)
        ),
        body := jsonb_build_object('type', 'reminders')
      );
    end $f$;
    revoke all on function private.send_reminders() from public, anon, authenticated;

    perform cron.schedule('voyage-fare-reminders', '0 13 * * *', 'select private.send_reminders()');
  end if;
end $$;
