-- The trip's email address (build 8 step 5b, mockup ai-reading-v5 screens 7–8, 16 Nov 2026).
-- Each trip can have an address, colombia-k7q2@voyagefare.app. Travellers forward booking emails
-- to it; the trip-mail server function reads them (only from a traveller's own address) and puts
-- what it found in "To review": nothing goes into the trip until someone checks it.

alter table public.trips add column mail_code text unique
  check (mail_code ~ '^[a-z0-9-]{3,40}$');

-- What was forwarded: what the AI found (or why not), who forwarded it. Never the email itself.
create table public.trip_mails (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips (id) on delete cascade,
  resend_id     text not null unique, -- the same email is never read twice
  forwarded_by  uuid references auth.users (id) on delete set null,
  forwarder     text, -- the traveller's name, as on the trip
  subject       text,
  found         jsonb, -- what was booked (the AI's answer), or null
  problem       text check (problem in ('not_booking', 'unreadable', 'paused', 'too_long')),
  status        text not null default 'new' check (status in ('new', 'done', 'dropped')),
  received_at   timestamptz not null default now()
);
create index trip_mails_trip on public.trip_mails (trip_id, status);
alter table public.trip_mails enable row level security;
-- The trip's members see them and mark them done or dropped; only the server adds them.
create policy "trip mails: members read" on public.trip_mails
  for select to authenticated using (private.is_trip_member(trip_id));
create policy "trip mails: members mark them" on public.trip_mails
  for update to authenticated using (private.is_trip_member(trip_id)) with check (private.is_trip_member(trip_id));
-- The demo is read without signing in: visitors get an empty list (no policy for them), not an error.
grant select on public.trip_mails to authenticated, anon;
grant update (status) on public.trip_mails to authenticated;

-- "colombia-k7q2": the trip's name in plain letters, and 4 random characters nobody can guess.
create function private.new_mail_code(p_name text) returns text
language plpgsql volatile set search_path = '' as $$
declare
  v_slug text;
  v_letters text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_code text;
begin
  v_slug := translate(lower(coalesce(p_name, '')),
                      'áàâäãåéèêëíìîïóòôöõøúùûüçñ', 'aaaaaaeeeeiiiioooooouuuucn');
  v_slug := trim(both '-' from regexp_replace(v_slug, '[^a-z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from left(v_slug, 20));
  if v_slug = '' then v_slug := 'trip'; end if;
  loop
    v_code := v_slug || '-';
    for i in 1..4 loop
      v_code := v_code || substr(v_letters, 1 + floor(random() * length(v_letters))::int, 1);
    end loop;
    exit when not exists (select 1 from public.trips where mail_code = v_code);
  end loop;
  return v_code;
end $$;

-- The trip's address (made the first time someone asks). p_new: a new one; the old one stops.
create function public.trip_mail_address(p_trip_id uuid, p_new boolean default false) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
  v_name text;
  v_demo boolean;
begin
  if not private.is_trip_member(p_trip_id) then
    raise exception 'Trip not found' using errcode = 'P0002';
  end if;
  select mail_code, name, is_demo into v_code, v_name, v_demo from public.trips where id = p_trip_id;
  if v_demo then
    raise exception 'The demo trip has no address.' using errcode = 'P0001';
  end if;
  if v_code is null or p_new then
    v_code := private.new_mail_code(v_name);
    update public.trips set mail_code = v_code where id = p_trip_id;
  end if;
  return v_code || '@voyagefare.app';
end $$;
revoke all on function public.trip_mail_address(uuid, boolean) from public, anon;
grant execute on function public.trip_mail_address(uuid, boolean) to authenticated;
