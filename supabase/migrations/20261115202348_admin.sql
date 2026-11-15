-- The Admin dashboard, stage A (build 8, mockup admin-v5, 15 Nov 2026): an admin role, feedback
-- sent from the app, and what admins may see. Admins see who has an account and how many trips,
-- never what's in the trips. Everything here is checked by the database, not just hidden.

create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  is_first   boolean not null default false,
  added_by   uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index admins_one_first on public.admins (is_first) where is_first;
alter table public.admins enable row level security;
-- Read through the functions below only.

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
grant execute on function private.is_admin() to anon, authenticated;

-- Am I an admin? (the account menu's "Admin" line)
create function public.am_i_admin() returns boolean
language sql stable security invoker set search_path = '' as $$
  select private.is_admin();
$$;
grant execute on function public.am_i_admin() to authenticated;

create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid default auth.uid() references auth.users (id) on delete set null,
  kind       text not null check (kind in ('broken', 'unclear', 'idea', 'love')),
  message    text not null check (length(trim(message)) between 1 and 4000),
  page       text check (length(page) <= 300),
  device     text check (length(device) <= 300),
  can_reply  boolean not null default true,
  status     text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now()
);
create index feedback_status on public.feedback (status, created_at desc);
alter table public.feedback enable row level security;
create policy "feedback: anyone signed in sends their own" on public.feedback
  for insert to authenticated with check (user_id = (select auth.uid()) and status = 'new');
create policy "feedback: admins read" on public.feedback
  for select to authenticated using (private.is_admin());
create policy "feedback: admins mark done" on public.feedback
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
grant insert on public.feedback to authenticated;
grant select, update (status) on public.feedback to authenticated;

-- Overview: the numbers. Admins only.
create function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'accounts', (select count(*) from auth.users),
    'accounts_week', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'trips', (select count(*) from public.trips where not is_demo),
    'trips_week', (select count(*) from public.trips where not is_demo and created_at > now() - interval '7 days'),
    'active_week', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'new_messages', (select count(*) from public.feedback where status = 'new'),
    'database_bytes', pg_database_size(current_database()),
    'files_bytes', (select coalesce(sum(size), 0) from public.item_files)
  );
end $$;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

-- People: who has an account and how many trips; never what's in them.
create function public.admin_people()
returns table (user_id uuid, first_name text, email text, created_at timestamptz, last_seen timestamptz,
               confirmed boolean, trips bigint, is_admin boolean, is_first boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
    select u.id, (u.raw_user_meta_data ->> 'first_name')::text, u.email::text, u.created_at, u.last_sign_in_at,
           u.email_confirmed_at is not null,
           (select count(*) from public.trip_members m join public.trips t on t.id = m.trip_id
            where m.user_id = u.id and not t.is_demo),
           a.user_id is not null, coalesce(a.is_first, false)
    from auth.users u left join public.admins a on a.user_id = u.id
    order by u.created_at desc;
end $$;
revoke all on function public.admin_people() from public, anon;
grant execute on function public.admin_people() to authenticated;

-- Feedback with who sent it (first name, and the email only when they said you can write back).
create function public.admin_feedback()
returns table (id uuid, kind text, message text, page text, device text, can_reply boolean, status text,
               created_at timestamptz, first_name text, email text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
    select f.id, f.kind, f.message, f.page, f.device, f.can_reply, f.status, f.created_at,
           (u.raw_user_meta_data ->> 'first_name')::text,
           case when f.can_reply then u.email::text end
    from public.feedback f left join auth.users u on u.id = f.user_id
    order by f.created_at desc;
end $$;
revoke all on function public.admin_feedback() from public, anon;
grant execute on function public.admin_feedback() to authenticated;

-- Add an admin by email (they need an account); remove one (never the first).
create function public.admin_add(p_email text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
begin
  if not private.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'No account with this email yet: they need to sign up first.' using errcode = 'P0001';
  end if;
  insert into public.admins (user_id, added_by) values (v_user, auth.uid()) on conflict (user_id) do nothing;
  return v_user;
end $$;
revoke all on function public.admin_add(text) from public, anon;
grant execute on function public.admin_add(text) to authenticated;

create function public.admin_remove(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if exists (select 1 from public.admins where user_id = p_user_id and is_first) then
    raise exception 'The first admin stays.' using errcode = 'P0001';
  end if;
  delete from public.admins where user_id = p_user_id;
end $$;
revoke all on function public.admin_remove(uuid) from public, anon;
grant execute on function public.admin_remove(uuid) to authenticated;

-- Who added each admin, for the Admins tab.
create function public.admin_list()
returns table (user_id uuid, first_name text, is_first boolean, added_by_name text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
    select a.user_id, (u.raw_user_meta_data ->> 'first_name')::text, a.is_first,
           (b.raw_user_meta_data ->> 'first_name')::text, a.created_at
    from public.admins a join auth.users u on u.id = a.user_id left join auth.users b on b.id = a.added_by
    order by a.is_first desc, a.created_at;
end $$;
revoke all on function public.admin_list() from public, anon;
grant execute on function public.admin_list() to authenticated;
