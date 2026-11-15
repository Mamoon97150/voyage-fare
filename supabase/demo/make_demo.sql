-- The public demo trip (build 7, step 3, mockup demo-v5): a read-only copy of Colombia & Panama
-- for the welcome page's "Try it with a real trip". Run it as the database owner (SQL editor or
-- the Supabase tool), again whenever the real trip changes: it replaces the old demo.
--   · the 4 names change: Djamina → Ana, Danielle → Bea, Peggy → Cleo, Gabriel → Eva
--   · notes, links and repayments are left out (they can be personal)
--   · the separate "…: deposit" lines are left out (Djamina, 15 Nov), except the birthday dinner's,
--     which becomes the proper way: one line, a deposit then the balance, as two payments
--   · amounts, places, hotels, restaurants and tickets stay real
--   · simplified so a visitor understands it at a glance (Djamina, 15 Nov): one dropped line, one line
--     with no price, options compared on 4 lines only, one Uber / laundry / airport snack
do $$
declare
  src constant uuid := '512cbbcb-7601-4bb5-89cb-54921733d7b3';
  demo uuid := gen_random_uuid();
  v_dinner uuid;
  v_deposit public.items;
  v_bill public.items;
begin
  delete from public.trips where is_demo;

  insert into public.trips (id, name, start_date, end_date, currency, target_amount, target_scope, is_demo,
                            created_by, home_city, home_latitude, home_longitude)
  select demo, name, start_date, end_date, currency, target_amount, target_scope, true,
         null, home_city, home_latitude, home_longitude
  from public.trips where id = src;

  create temp table m_trav on commit drop as
    select id as old, gen_random_uuid() as new,
           case name when 'Djamina' then 'Ana' when 'Danielle' then 'Bea' when 'Peggy' then 'Cleo'
                     when 'Gabriel' then 'Eva' else 'Traveller ' || position end as name, position
    from public.travellers where trip_id = src;
  insert into public.travellers (id, trip_id, name, position) select new, demo, name, position from m_trav;

  create temp table m_place on commit drop as
    select id as old, gen_random_uuid() as new from public.places where trip_id = src;
  insert into public.places (id, trip_id, name, country, latitude, longitude, nights, position)
  select m.new, demo, p.name, p.country, p.latitude, p.longitude, p.nights, p.position
  from public.places p join m_place m on m.old = p.id;

  -- Lines, minus the separate deposits.
  create temp table m_item on commit drop as
    select id as old, gen_random_uuid() as new from public.items
    where trip_id = src and name not like '%: deposit';

  insert into public.items (id, trip_id, place_id, kind, category, name, day_number, end_day_number, status,
                            actual_amount, actual_currency, actual_rate, paid_by, paid_on, location_name,
                            latitude, longitude, position, paid_each, due_on, meal)
  select m.new, demo, mp.new, i.kind, i.category,
         replace(replace(replace(replace(i.name, 'Djamina', 'Ana'), 'Danielle', 'Bea'), 'Peggy', 'Cleo'), 'Gabriel', 'Eva'),
         i.day_number, i.end_day_number, i.status, i.actual_amount, i.actual_currency, i.actual_rate,
         mt.new, i.paid_on, i.location_name, i.latitude, i.longitude, i.position, i.paid_each, i.due_on, i.meal
  from public.items i
  join m_item m on m.old = i.id
  left join m_place mp on mp.old = i.place_id
  left join m_trav mt on mt.old = i.paid_by;

  update public.items d set package_id = mp.new
  from public.items s join m_item ms on ms.old = s.id join m_item mp on mp.old = s.package_id
  where d.id = ms.new;

  insert into public.options (trip_id, item_id, name, amount, currency, rate, rate_is_manual, is_chosen,
                              is_favourite, details, location_name, latitude, longitude, position)
  select demo, m.new, o.name, o.amount, o.currency, o.rate, o.rate_is_manual, o.is_chosen, o.is_favourite,
         o.details, o.location_name, o.latitude, o.longitude, o.position
  from public.options o join m_item m on m.old = o.item_id;

  insert into public.item_legs (trip_id, item_id, leg_number, mode, from_name, to_name, via, travel_date,
                                day_number, after_place_id, position)
  select demo, m.new, l.leg_number, l.mode, l.from_name, l.to_name, l.via, l.travel_date, l.day_number,
         mp.new, l.position
  from public.item_legs l join m_item m on m.old = l.item_id left join m_place mp on mp.old = l.after_place_id;

  insert into public.item_split_travellers (item_id, traveller_id, trip_id)
  select m.new, mt.new, demo
  from public.item_split_travellers s join m_item m on m.old = s.item_id join m_trav mt on mt.old = s.traveller_id;

  insert into public.day_split_travellers (trip_id, day_number, traveller_id)
  select demo, s.day_number, mt.new
  from public.day_split_travellers s join m_trav mt on mt.old = s.traveller_id where s.trip_id = src;

  -- The birthday dinner, the proper way: one line at its whole price, a deposit then the balance.
  select * into v_deposit from public.items where trip_id = src and name = 'Birthday dinner: deposit';
  select * into v_bill from public.items where trip_id = src and name = 'Birthday dinner';
  if v_deposit.id is not null and v_bill.id is not null then
    select m.new into v_dinner from m_item m where m.old = v_bill.id;
    update public.items
    set status = 'booked', paid_by = null, paid_on = null,
        actual_amount = v_bill.actual_amount + round(v_deposit.actual_amount * v_deposit.actual_rate / v_bill.actual_rate, 0)
    where id = v_dinner;
    update public.options set amount = (select actual_amount from public.items where id = v_dinner)
    where item_id = v_dinner and is_chosen;
    insert into public.payments (trip_id, item_id, kind, amount, currency, rate, paid_by, paid_on)
    values
      (demo, v_dinner, 'deposit', v_deposit.actual_amount, v_deposit.actual_currency, v_deposit.actual_rate,
       (select new from m_trav where old = v_deposit.paid_by), v_deposit.paid_on),
      (demo, v_dinner, 'balance', v_bill.actual_amount, v_bill.actual_currency, v_bill.actual_rate,
       (select new from m_trav where old = v_bill.paid_by), v_bill.paid_on);
    -- What add_payment does after each payment: covered → paid.
    perform private.sync_paid(v_dinner);
  end if;

  -- Simplified for a first look (Djamina, 15 Nov): fewer lines, one example of each kind.
  delete from public.items where trip_id = demo and name in (
    -- dropped: only the boat tour stays, to show what "dropped" means
    'Lunch in La Candelaria', 'Sunday morning', 'Something thrilling', 'Perfume workshop',
    'Palacio de la Inquisición', 'Farewell dinner',
    -- no price yet: only "Quick bite at Monserrate" stays
    'Trout dinner in town', 'Lunch in Guatapé', 'Bandeja paisa lunch', 'Evening out', 'Drinks',
    'Lunch on the neighbourhoods day', 'Lunch in Casco Viejo', 'Transfer to the airport',
    -- free: La Piedra del Peñol and the Panama afternoon stay
    'Plaza Bolívar + Museo Botero', 'Plaza Botero',
    -- repeats: one Uber, one laundry, one airport snack
    'Ubers in Bogotá', 'Ubers in Cartagena', 'Ubers in Panama', 'Laundry, again');
  delete from public.items i using public.places p
  where i.trip_id = demo and i.place_id = p.id and p.name = 'Panama City' and i.name = 'Snacks at the airport';
  -- Options compared on 4 lines only; elsewhere just the chosen one.
  delete from public.options o using public.items i
  where o.item_id = i.id and i.trip_id = demo and not o.is_chosen and i.status <> 'dropped'
    and i.name not in ('Cleo’s photoshoot', 'Day trip', 'The thrill day', 'The afternoon');
end $$;
