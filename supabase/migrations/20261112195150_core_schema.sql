-- Voyage Fare — core schema (cahier des charges §5).
-- Every table carries trip_id, and composite foreign keys guarantee that a
-- row can only point at things from the same trip (a payer, a place, a room…).

create table public.trips (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(trim(name)) > 0),
  start_date    date,
  end_date      date,
  currency      text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  target_amount numeric(14,2) check (target_amount >= 0),
  target_scope  text not null default 'per_person' check (target_scope in ('per_person', 'total')),
  is_demo       boolean not null default false,
  created_by    uuid references auth.users (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

-- People with an account who can open and edit a trip.
create table public.trip_members (
  trip_id    uuid not null references public.trips (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'editor' check (role in ('owner', 'editor')),
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

-- Named people on the trip. No account needed.
create table public.travellers (
  id       uuid primary key default gen_random_uuid(),
  trip_id  uuid not null references public.trips (id) on delete cascade,
  name     text not null check (length(trim(name)) > 0),
  user_id  uuid references auth.users (id) on delete set null,
  position integer not null default 0,
  unique (id, trip_id)
);

create table public.places (
  id        uuid primary key default gen_random_uuid(),
  trip_id   uuid not null references public.trips (id) on delete cascade,
  name      text not null check (length(trim(name)) > 0),
  country   text,
  latitude  double precision,
  longitude double precision,
  nights    integer not null default 0 check (nights >= 0),
  position  integer not null default 0,
  unique (id, trip_id)
);

-- Something that costs money. place_id null = belongs to the whole trip.
create table public.items (
  id              uuid primary key default gen_random_uuid(),
  trip_id         uuid not null references public.trips (id) on delete cascade,
  place_id        uuid,
  kind            text not null check (kind in
                    ('transport', 'housing', 'activity', 'restaurant', 'car_rental', 'insurance', 'other')),
  category        text not null check (category in
                    ('main_transport', 'local_transport', 'accommodation', 'activities', 'food', 'insurance', 'buffer')),
  name            text not null check (length(trim(name)) > 0),
  day_number      integer check (day_number >= 1),
  end_day_number  integer,
  status          text not null default 'idea' check (status in ('idea', 'chosen', 'booked', 'paid')),
  -- What was really paid (BR-2), in its own currency, with the rate saved at entry (BR-10).
  actual_amount   numeric(14,2) check (actual_amount >= 0),
  actual_currency text check (actual_currency ~ '^[A-Z]{3}$'),
  actual_rate     numeric(18,8) not null default 1 check (actual_rate > 0),
  paid_by         uuid,
  paid_on         date,
  note            text,
  location_name   text,
  latitude        double precision,
  longitude       double precision,
  position        integer not null default 0,
  created_at      timestamptz not null default now(),
  unique (id, trip_id),
  foreign key (place_id, trip_id) references public.places (id, trip_id) on delete set null (place_id),
  foreign key (paid_by, trip_id) references public.travellers (id, trip_id),
  check (end_day_number is null or (day_number is not null and end_day_number >= day_number)),
  check (actual_amount is null or actual_currency is not null),
  -- One payer per item (SR-6); paid means an actual amount and a payer.
  check ((status = 'paid') = (paid_by is not null)),
  check (status <> 'paid' or actual_amount is not null)
);

-- A candidate for an item. Only the chosen one counts in the budget (BR-1).
create table public.options (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null,
  item_id        uuid not null,
  name           text not null check (length(trim(name)) > 0),
  amount         numeric(14,2) check (amount >= 0),
  currency       text not null check (currency ~ '^[A-Z]{3}$'),
  rate           numeric(18,8) not null default 1 check (rate > 0), -- trip currency per 1 unit
  rate_is_manual boolean not null default false,
  is_chosen      boolean not null default false,
  is_favourite   boolean not null default false,                   -- coup de cœur
  details        jsonb not null default '{}'::jsonb,               -- kind-specific comparison details
  link           text,
  note           text,
  location_name  text,
  latitude       double precision,
  longitude      double precision,
  position       integer not null default 0,
  created_at     timestamptz not null default now(),
  unique (id, trip_id),
  foreign key (item_id, trip_id) references public.items (id, trip_id) on delete cascade
);

create unique index options_one_chosen_per_item on public.options (item_id) where is_chosen;

-- A housing option can be split into rooms (SR-4). When rooms exist, their sum is the option's price.
create table public.rooms (
  id        uuid primary key default gen_random_uuid(),
  trip_id   uuid not null,
  option_id uuid not null,
  name      text not null check (length(trim(name)) > 0),
  amount    numeric(14,2) not null check (amount >= 0),
  position  integer not null default 0,
  unique (id, trip_id),
  foreign key (option_id, trip_id) references public.options (id, trip_id) on delete cascade
);

create table public.room_occupants (
  room_id      uuid not null,
  traveller_id uuid not null,
  trip_id      uuid not null,
  primary key (room_id, traveller_id),
  foreign key (room_id, trip_id) references public.rooms (id, trip_id) on delete cascade,
  foreign key (traveller_id, trip_id) references public.travellers (id, trip_id) on delete cascade
);

-- "Split between…" on an item (SR-2). No rows = follow the day, or everyone.
create table public.item_split_travellers (
  item_id      uuid not null,
  traveller_id uuid not null,
  trip_id      uuid not null,
  primary key (item_id, traveller_id),
  foreign key (item_id, trip_id) references public.items (id, trip_id) on delete cascade,
  foreign key (traveller_id, trip_id) references public.travellers (id, trip_id) on delete cascade
);

-- "Split between…" on a whole day (SR-3).
create table public.day_split_travellers (
  trip_id      uuid not null references public.trips (id) on delete cascade,
  day_number   integer not null check (day_number >= 1),
  traveller_id uuid not null,
  primary key (trip_id, day_number, traveller_id),
  foreign key (traveller_id, trip_id) references public.travellers (id, trip_id) on delete cascade
);

-- A per-person-per-day amount for what isn't pre-planned (BR-7).
create table public.daily_estimates (
  id       uuid primary key default gen_random_uuid(),
  trip_id  uuid not null references public.trips (id) on delete cascade,
  place_id uuid,
  category text not null check (category in
             ('main_transport', 'local_transport', 'accommodation', 'activities', 'food', 'insurance', 'buffer')),
  label    text not null check (length(trim(label)) > 0),
  amount   numeric(14,2) not null check (amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  rate     numeric(18,8) not null default 1 check (rate > 0),
  days     integer not null check (days > 0),
  unique (id, trip_id),
  foreign key (place_id, trip_id) references public.places (id, trip_id) on delete set null (place_id)
);

-- Travellers concerned by a daily estimate. No rows = everyone.
create table public.daily_estimate_travellers (
  daily_estimate_id uuid not null,
  traveller_id      uuid not null,
  trip_id           uuid not null,
  primary key (daily_estimate_id, traveller_id),
  foreign key (daily_estimate_id, trip_id) references public.daily_estimates (id, trip_id) on delete cascade,
  foreign key (traveller_id, trip_id) references public.travellers (id, trip_id) on delete cascade
);

-- One traveller paid another back. Always in the trip's main currency (SR-8).
create table public.repayments (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references public.trips (id) on delete cascade,
  from_traveller uuid not null,
  to_traveller   uuid not null,
  amount         numeric(14,2) not null check (amount > 0),
  paid_on        date not null default current_date,
  note           text,
  check (from_traveller <> to_traveller),
  foreign key (from_traveller, trip_id) references public.travellers (id, trip_id),
  foreign key (to_traveller, trip_id) references public.travellers (id, trip_id)
);

create index on public.travellers (trip_id);
create index on public.places (trip_id);
create index on public.items (trip_id);
create index on public.options (item_id);
create index on public.rooms (option_id);
create index on public.repayments (trip_id);
create index on public.trip_members (user_id);

-- ── Status follows the choice (BR-8) ─────────────────────────────────────────
-- Choosing an option moves the item to "chosen"; unchoosing moves it back to
-- "idea". Booked and paid never go back down on their own.

create function public.options_keep_one_chosen() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.is_chosen then
    update public.options set is_chosen = false
    where item_id = new.item_id and id <> new.id and is_chosen;
  end if;
  return new;
end $$;

create trigger options_keep_one_chosen
  before insert or update of is_chosen on public.options
  for each row execute function public.options_keep_one_chosen();

create function public.items_sync_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status in ('idea', 'chosen') then
    new.status := case
      when exists (select 1 from public.options o where o.item_id = new.id and o.is_chosen)
      then 'chosen' else 'idea' end;
  end if;
  return new;
end $$;

create trigger items_sync_status
  before insert or update on public.items
  for each row execute function public.items_sync_status();

create function public.options_touch_item() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Re-run the item's status rule now that its options changed.
  update public.items set status = status where id = coalesce(new.item_id, old.item_id);
  return null;
end $$;

create trigger options_touch_item
  after insert or delete or update of is_chosen on public.options
  for each row execute function public.options_touch_item();
