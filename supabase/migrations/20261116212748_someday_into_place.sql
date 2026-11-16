-- "+ N from Someday" (build 8½, menus-home-v6): a place of a trip whose name matches places where
-- you saved ideas brings them into its To try, in one go. Only your ideas; only a trip you're on.
create function public.someday_into_place(p_place_id uuid)
returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  v_place public.places;
  r public.someday_ideas;
  v_count integer := 0;
begin
  select * into v_place from public.places where id = p_place_id;
  if v_place.id is null then
    raise exception 'Place not found' using errcode = 'P0002';
  end if;
  for r in
    select * from public.someday_ideas
    where user_id = auth.uid() and lower(trim(place_name)) = lower(trim(v_place.name))
    order by created_at
  loop
    perform public.add_to_try(v_place.id, r.name, r.link, r.note, null, r.kind);
    delete from public.someday_ideas where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

revoke all on function public.someday_into_place(uuid) from public, anon;
grant execute on function public.someday_into_place(uuid) to authenticated;
