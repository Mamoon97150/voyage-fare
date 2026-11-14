-- Build 6 (14 Nov 2026): invitations (mockup invitations-v4).
-- An invitation is tied to a traveller (decided 12 Nov): whoever opens the link and signs in
-- becomes that traveller, so "your share" is theirs from the start.
-- A link works once, for 14 days, and can be cancelled. Sending it again reuses the open link.
-- Link only in V1; email after going online.

create table public.invitations (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips (id) on delete cascade,
  traveller_id uuid not null,
  -- 32 random hex characters: the secret in the link.
  token        text not null unique default replace(gen_random_uuid()::text, '-', ''),
  invited_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '14 days',
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users (id) on delete set null,
  cancelled_at timestamptz,
  foreign key (traveller_id, trip_id) references public.travellers (id, trip_id) on delete cascade
);

create index on public.invitations (trip_id);
create index on public.invitations (traveller_id);

-- Members see their trip's invitations (who is invited, since when). Changes go through
-- the functions below only, and nobody else ever reads a token.
alter table public.invitations enable row level security;
revoke all on public.invitations from anon, authenticated;
grant select on public.invitations to authenticated;
create policy "invitations: members read" on public.invitations
  for select to authenticated
  using (private.is_trip_member(trip_id));

-- Invite a traveller: returns the open link, or makes a new one.
create function public.invite_traveller(p_traveller_id uuid)
returns table (token text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_trip uuid;
  v_user uuid;
  v_name text;
begin
  select t.trip_id, t.user_id, t.name into v_trip, v_user, v_name from public.travellers t where t.id = p_traveller_id;
  if v_trip is null then
    raise exception 'Traveller not found' using errcode = 'P0002';
  end if;
  if not private.is_trip_member(v_trip) then
    raise exception 'Only the people on this trip can change it' using errcode = '42501';
  end if;
  if exists (select 1 from public.trips where id = v_trip and is_demo) then
    raise exception 'The demo trip can''t be shared.' using errcode = 'P0001';
  end if;
  if v_user is not null then
    raise exception '% is already on the trip.', v_name using errcode = 'P0001';
  end if;

  return query
    select i.token, i.expires_at from public.invitations i
    where i.traveller_id = p_traveller_id
      and i.accepted_at is null and i.cancelled_at is null and i.expires_at > now()
    order by i.created_at desc limit 1;
  if found then
    return;
  end if;

  return query
    insert into public.invitations (trip_id, traveller_id, invited_by)
    values (v_trip, p_traveller_id, auth.uid())
    returning invitations.token, invitations.expires_at;
end $$;

-- Cancel a traveller's open invitation: the link stops working.
create function public.cancel_invitation(p_traveller_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_trip uuid;
begin
  select trip_id into v_trip from public.travellers where id = p_traveller_id;
  if v_trip is null then
    raise exception 'Traveller not found' using errcode = 'P0002';
  end if;
  if not private.is_trip_member(v_trip) then
    raise exception 'Only the people on this trip can change it' using errcode = '42501';
  end if;
  update public.invitations set cancelled_at = now()
  where traveller_id = p_traveller_id and accepted_at is null and cancelled_at is null;
end $$;

-- What the link shows before signing in: whose trip, who you are on it, and whether it still works.
-- Only for whoever holds the link; nothing of the trip's money.
-- state: open · expired · cancelled · used · joined (you're already that traveller)
create function public.invitation_preview(p_token text)
returns table (
  trip_id uuid, trip_name text, start_date date, end_date date, places text[],
  traveller_name text, invited_by_name text, state text
)
language sql stable security definer set search_path = '' as $$
  select
    i.trip_id, tr.name, tr.start_date, tr.end_date,
    coalesce((select array_agg(p.name order by p.position) from public.places p where p.trip_id = i.trip_id), '{}'),
    t.name,
    (select x.name from public.travellers x where x.trip_id = i.trip_id and x.user_id = i.invited_by limit 1),
    case
      when t.user_id is not null and t.user_id = auth.uid() then 'joined'
      when i.accepted_at is not null or t.user_id is not null then 'used'
      when i.cancelled_at is not null then 'cancelled'
      when i.expires_at <= now() then 'expired'
      else 'open'
    end
  from public.invitations i
  join public.trips tr on tr.id = i.trip_id
  join public.travellers t on t.id = i.traveller_id
  where i.token = p_token;
$$;

-- Accept: you join the trip as that traveller. Returns the trip.
create function public.accept_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.invitations;
  v_traveller public.travellers;
  v_already text;
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select * into v_inv from public.invitations where token = p_token for update;
  if v_inv.id is null then
    raise exception 'This invitation doesn''t exist. Ask for a new link.' using errcode = 'P0002';
  end if;
  select * into v_traveller from public.travellers where id = v_inv.traveller_id for update;

  -- Opening the link again once in: just open the trip.
  if v_traveller.user_id = v_me then
    return v_inv.trip_id;
  end if;
  if v_inv.accepted_at is not null or v_traveller.user_id is not null then
    raise exception 'This invitation was already used. Ask for a new link.' using errcode = 'P0001';
  end if;
  if v_inv.cancelled_at is not null or v_inv.expires_at <= now() then
    raise exception 'This invitation was cancelled or has expired. Ask for a new one.' using errcode = 'P0001';
  end if;
  select name into v_already from public.travellers where trip_id = v_inv.trip_id and user_id = v_me limit 1;
  if v_already is not null then
    raise exception 'You''re already on this trip as %.', v_already using errcode = 'P0001';
  end if;

  update public.travellers set user_id = v_me where id = v_traveller.id;
  insert into public.trip_members (trip_id, user_id, role) values (v_inv.trip_id, v_me, 'editor')
  on conflict (trip_id, user_id) do nothing;
  update public.invitations set accepted_at = now(), accepted_by = v_me where id = v_inv.id;
  -- Any other open link for that traveller stops working.
  update public.invitations set cancelled_at = now()
  where traveller_id = v_traveller.id and id <> v_inv.id and accepted_at is null and cancelled_at is null;
  return v_inv.trip_id;
end $$;

-- Leave a trip you were invited to: you go back to being a name on the notebook;
-- your share and what you paid stay. The creator can't leave (they delete the trip instead).
create function public.leave_trip(p_trip_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
begin
  if not private.is_trip_member(p_trip_id) then
    raise exception 'You''re not on this trip.' using errcode = '42501';
  end if;
  if private.is_trip_owner(p_trip_id) then
    raise exception 'You created this trip: you can delete it, not leave it.' using errcode = 'P0001';
  end if;
  update public.travellers set user_id = null where trip_id = p_trip_id and user_id = v_me;
  delete from public.trip_members where trip_id = p_trip_id and user_id = v_me;
end $$;

revoke all on function public.invite_traveller(uuid) from public, anon;
revoke all on function public.cancel_invitation(uuid) from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;
revoke all on function public.leave_trip(uuid) from public, anon;
revoke all on function public.invitation_preview(text) from public;
grant execute on function public.invite_traveller(uuid) to authenticated;
grant execute on function public.cancel_invitation(uuid) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.leave_trip(uuid) to authenticated;
grant execute on function public.invitation_preview(text) to anon, authenticated;

-- Removing a traveller who opens the trip with their own account: only the trip's creator,
-- and they lose access too. Everything else as before (13 Nov).
create or replace function public.remove_traveller(p_traveller_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_trip uuid;
  v_user uuid;
  v_name text;
  v_item text;
  v_money boolean;
begin
  select trip_id, user_id, name into v_trip, v_user, v_name from public.travellers where id = p_traveller_id;
  if v_trip is null then
    raise exception 'Traveller not found' using errcode = 'P0002';
  end if;
  if not private.is_trip_member(v_trip) then
    raise exception 'Only the people on this trip can change it' using errcode = '42501';
  end if;
  if v_user is not null and v_user = auth.uid() then
    raise exception 'You can''t remove yourself from the trip.' using errcode = 'P0001';
  end if;
  if v_user is not null and not private.is_trip_owner(v_trip) then
    raise exception '% is on the trip with their own account: only the person who created the trip can remove them.', v_name using errcode = 'P0001';
  end if;
  if (select count(*) from public.travellers where trip_id = v_trip) <= 1 then
    raise exception 'A trip needs at least one traveller.' using errcode = 'P0001';
  end if;

  select exists (select 1 from public.items where paid_by = p_traveller_id)
      or exists (select 1 from public.repayments where from_traveller = p_traveller_id or to_traveller = p_traveller_id)
      or exists (select 1 from public.v_traveller_balances b
                 where b.traveller_id = p_traveller_id and (b.share_of_paid <> 0 or b.balance <> 0))
    into v_money;
  if v_money then
    raise exception '% has paid or owes money on this trip: settle up first.', v_name using errcode = 'P0001';
  end if;

  select i.name into v_item
  from public.item_split_travellers s
  join public.items i on i.id = s.item_id
  where s.traveller_id = p_traveller_id
    and not exists (select 1 from public.item_split_travellers o where o.item_id = s.item_id and o.traveller_id <> p_traveller_id)
  limit 1;
  if v_item is not null then
    raise exception '% is the only one on “%”: change that first.', v_name, v_item using errcode = 'P0001';
  end if;

  -- The owner may remove a member's access (trip_members policy "owner manages").
  if v_user is not null then
    delete from public.trip_members where trip_id = v_trip and user_id = v_user;
  end if;
  delete from public.travellers where id = p_traveller_id;
end $$;
