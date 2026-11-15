-- Phone notifications for admins (Admin stage C, mockup admin-v5, 15 Nov 2026).
-- An admin turns on "Notify me" on a phone: its push subscription is kept here. New feedback, or a
-- new email to hello@, sends a notification through the notify server function. The notification
-- keys (VAPID) and the token the database uses to call the function stay in a private table that
-- only the server can read.

create table private.push_settings (
  id           integer primary key default 1 check (id = 1),
  vapid_public text,
  vapid_private text,
  hook_token   text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  seen_threads text[] not null default '{}'
);
insert into private.push_settings default values;
revoke all on private.push_settings from public, anon, authenticated;

create table public.push_subscriptions (
  endpoint   text primary key check (endpoint ~ '^https://'),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
-- Only admins subscribe, each to their own phones.
create policy "push: admins manage their own phones" on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.is_admin());
grant select, insert, delete on public.push_subscriptions to authenticated;

-- New feedback: ask the notify function to tell the admins (only where pg_net exists: not in tests).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;

    create function private.notify_feedback() returns trigger
    language plpgsql security definer set search_path = '' as $f$
    begin
      perform net.http_post(
        url := 'https://pvfraoarogagrobqvpzo.supabase.co/functions/v1/notify',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-hook-token', (select hook_token from private.push_settings where id = 1)
        ),
        body := jsonb_build_object('type', 'feedback', 'id', new.id)
      );
      return new;
    end $f$;

    create trigger feedback_notify after insert on public.feedback
      for each row execute function private.notify_feedback();
  end if;
end $$;
