-- Someday (build 8½, mockup menus-home-v6, 16 Nov 2026): restaurants and activities saved before
-- there's a trip (an Instagram find, a friend's tip), grouped by place. Only yours: nobody else
-- sees them. "Start a trip from these" makes a trip with that place and moves the ideas into its
-- To try, in one go.
create table public.someday_ideas (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  place_name      text check (place_name is null or length(trim(place_name)) between 1 and 80),
  place_country   text check (place_country is null or length(place_country) <= 80),
  place_latitude  double precision check (place_latitude is null or place_latitude between -90 and 90),
  place_longitude double precision check (place_longitude is null or place_longitude between -180 and 180),
  kind            text not null default 'restaurant' check (kind in ('restaurant', 'activity')),
  name            text not null check (length(trim(name)) between 1 and 120),
  link            text check (link is null or (link ~* '^https?://' and length(link) <= 2000)),
  note            text check (note is null or length(note) <= 300),
  created_at      timestamptz not null default now()
);
create index someday_ideas_user on public.someday_ideas (user_id, place_name);

alter table public.someday_ideas enable row level security;
create policy "someday: only yours" on public.someday_ideas
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
revoke all on public.someday_ideas from anon, public;
grant select, insert, update, delete on public.someday_ideas to authenticated;

-- A trip from one place's ideas: the trip (named after the place), you on it, the place, and each
-- idea in its To try. The ideas leave Someday. Ideas with no place stay where they are.
create function public.start_trip_from_someday(p_place_name text, p_me text default null)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_trip uuid;
  v_place uuid;
  v_first public.someday_ideas;
  r public.someday_ideas;
begin
  if auth.uid() is null then
    raise exception 'Sign in to start a trip' using errcode = '42501';
  end if;
  select * into v_first from public.someday_ideas
  where user_id = auth.uid() and place_name = trim(p_place_name)
  order by created_at limit 1;
  if v_first.id is null then
    raise exception 'Nothing saved for that place.' using errcode = 'P0001';
  end if;

  v_trip := public.create_trip(v_first.place_name, p_me);
  insert into public.places (trip_id, name, country, latitude, longitude, nights, position)
  values (v_trip, v_first.place_name, v_first.place_country, v_first.place_latitude, v_first.place_longitude, 0, 1)
  returning id into v_place;

  for r in
    select * from public.someday_ideas
    where user_id = auth.uid() and place_name = v_first.place_name
    order by created_at
  loop
    perform public.add_to_try(v_place, r.name, r.link, r.note, null, r.kind);
  end loop;
  delete from public.someday_ideas where user_id = auth.uid() and place_name = v_first.place_name;
  return v_trip;
end $$;

revoke all on function public.start_trip_from_someday(text, text) from public, anon;
grant execute on function public.start_trip_from_someday(text, text) to authenticated;
