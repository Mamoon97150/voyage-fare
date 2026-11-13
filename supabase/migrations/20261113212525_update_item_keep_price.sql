-- With several options, an item's price is the chosen option's: changing the item's name, kind
-- or days from the trip view must not touch it (project review, 13 Nov: "one price per item"
-- becomes "the chosen option's price"). p_keep_price leaves the options alone.
drop function public.update_item(uuid, text, text, integer, integer, numeric);

create function public.update_item(
  p_item_id        uuid,
  p_kind           text,
  p_name           text,
  p_day_number     integer default null,
  p_end_day_number integer default null,
  p_amount         numeric default null,
  p_keep_price     boolean default false
) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  update public.items
  set kind = p_kind,
      category = public.item_category(p_kind, place_id),
      name = trim(p_name),
      day_number = p_day_number,
      end_day_number = p_end_day_number
  where id = p_item_id;
  if not found then
    raise exception 'Item not found' using errcode = 'P0002';
  end if;
  if not p_keep_price then
    perform private.set_item_price(p_item_id, p_amount);
  end if;
end $$;

revoke all on function public.update_item(uuid, text, text, integer, integer, numeric, boolean) from public, anon;
grant execute on function public.update_item(uuid, text, text, integer, integer, numeric, boolean) to authenticated;
