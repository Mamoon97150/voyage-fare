-- Photos on options (build 9, mockup maps-v6, 16 Nov 2026): the link's preview picture (it stays
-- a link: nothing copied) or your own photo, kept in the trip's private files.
alter table public.options
  add column photo_url  text check (photo_url is null or (photo_url ~* '^https://' and length(photo_url) <= 2000)),
  add column photo_path text check (photo_path is null or length(photo_path) <= 300);
