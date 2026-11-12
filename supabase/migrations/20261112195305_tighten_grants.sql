-- Supabase gives its API roles every right on new tables by default.
-- Keep only what the app needs; row-level security then decides which rows.
revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
