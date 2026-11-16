-- AI reading (build 8 step 5a, mockup ai-reading-v5, 15 Nov 2026).
-- Pasted text is read by Claude through the ai-read server function, which holds the key. Here:
-- the switch and the monthly cap (for everyone together), what each reading cost (no text is kept),
-- what admins see, and "mark it booked from the email" in one step.

create table private.ai_settings (
  id             integer primary key default 1 check (id = 1),
  enabled        boolean not null default true,
  month_cap_usd  numeric not null default 5.80, -- about 5 €
  per_person_day integer not null default 20,
  warned_month   text -- 'YYYY-MM' once admins were told 80 % is used
);
insert into private.ai_settings default values;
revoke all on private.ai_settings from public, anon, authenticated;

-- One row per reading: who, what kind, its cost. Never the text.
create table private.ai_readings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users (id) on delete set null,
  kind          text not null check (kind in ('trip', 'booking')),
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd      numeric not null default 0,
  created_at    timestamptz not null default now()
);
create index ai_readings_created on private.ai_readings (created_at);
create index ai_readings_user on private.ai_readings (user_id, created_at);
revoke all on private.ai_readings from public, anon, authenticated;

-- Admin: this month's use, of the cap.
create function public.admin_ai() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_since timestamptz := date_trunc('month', now());
begin
  if not private.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'enabled', s.enabled,
      'cap_usd', s.month_cap_usd,
      'used_usd', coalesce((select sum(cost_usd) from private.ai_readings where created_at >= v_since), 0),
      'readings', (select count(*) from private.ai_readings where created_at >= v_since),
      'bookings', (select count(*) from private.ai_readings where created_at >= v_since and kind = 'booking'),
      'people', (select count(distinct user_id) from private.ai_readings where created_at >= v_since)
    )
    from private.ai_settings s where s.id = 1
  );
end $$;
revoke all on function public.admin_ai() from public, anon;
grant execute on function public.admin_ai() to authenticated;

-- Admin: turn AI reading off (or back on) for everyone.
create function public.admin_set_ai(p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  update private.ai_settings set enabled = p_enabled where id = 1;
end $$;
revoke all on function public.admin_set_ai(boolean) from public, anon;
grant execute on function public.admin_set_ai(boolean) to authenticated;

-- "Mark it booked" from an email, all or nothing. p_item_id: the line it goes on, or null for a new
-- line (kind, name, place, day). The option booked is the chosen one, else the one with the email's
-- name, else a new one. A line already paid stays paid (only the confirmation and link are added).
-- Security invoker: only the trip's members can do it (the usual rules apply).
create function public.apply_booking(
  p_trip_id     uuid,
  p_item_id     uuid default null,
  p_kind        text default null,
  p_name        text default null,
  p_place_id    uuid default null,
  p_day_number  integer default null,
  p_option_name text default null,
  p_amount      numeric default null,
  p_currency    text default null,
  p_rate        numeric default null,
  p_ref         text default null,
  p_link        text default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_item uuid := p_item_id;
  v_option uuid;
  v_trip_currency text;
  v_currency text;
  v_rate numeric;
  v_status text;
  v_option_name text := coalesce(nullif(trim(p_option_name), ''), trim(p_name));
begin
  select currency into v_trip_currency from public.trips where id = p_trip_id;
  if v_trip_currency is null then
    raise exception 'Trip not found' using errcode = 'P0002';
  end if;
  if p_amount is not null and p_amount < 0 then
    raise exception 'An amount can’t be negative.' using errcode = 'P0001';
  end if;
  if p_link is not null and trim(p_link) <> '' and trim(p_link) !~* '^https?://' then
    raise exception 'A booking link starts with https://' using errcode = 'P0001';
  end if;
  v_currency := coalesce(upper(nullif(trim(p_currency), '')), v_trip_currency);
  if v_currency = v_trip_currency then
    v_rate := 1;
  elsif p_amount is not null and (p_rate is null or p_rate <= 0) then
    raise exception 'An amount in another currency needs its rate.' using errcode = 'P0001';
  else
    v_rate := coalesce(p_rate, 1);
  end if;

  if v_item is null then
    if coalesce(trim(p_name), '') = '' then
      raise exception 'A new line needs a name.' using errcode = 'P0001';
    end if;
    v_item := public.add_item(p_trip_id, p_kind, p_name, p_place_id, p_day_number);
  end if;
  select status into v_status from public.items where id = v_item and trip_id = p_trip_id;
  if not found then
    raise exception 'Item not found' using errcode = 'P0002';
  end if;

  select id into v_option from public.options where item_id = v_item and is_chosen;
  if v_option is null then
    select id into v_option from public.options
    where item_id = v_item and lower(trim(name)) = lower(v_option_name)
    order by position limit 1;
    if v_option is null then
      insert into public.options (trip_id, item_id, name, amount, currency, rate, link)
      values (p_trip_id, v_item, v_option_name, p_amount, v_currency, v_rate, nullif(trim(p_link), ''))
      returning id into v_option;
    end if;
    update public.options set is_chosen = true where id = v_option;
  end if;

  update public.items
  set booking_ref  = coalesce(nullif(trim(p_ref), ''), booking_ref),
      booking_link = coalesce(nullif(trim(p_link), ''), booking_link)
  where id = v_item;

  if v_status is distinct from 'paid' then
    perform public.set_item_status(v_item, 'booked', p_amount, null, null,
                                   case when p_amount is null then null else v_currency end,
                                   case when p_amount is null then null else v_rate end);
  end if;
  return v_item;
end $$;
revoke all on function public.apply_booking(uuid, uuid, text, text, uuid, integer, text, numeric, text, numeric, text, text)
  from public, anon;
grant execute on function public.apply_booking(uuid, uuid, text, text, uuid, integer, text, numeric, text, numeric, text, text)
  to authenticated;
