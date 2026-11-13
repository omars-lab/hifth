-- Close the held copy to the project's public key.
--
-- Supabase gives every new table in `public` to the `anon` and `authenticated`
-- roles with full read and write, and turns on no row rules. The public key is
-- meant to be shareable, so as first created these tables could be read, changed
-- or emptied by anyone holding it — including qul_words, the one table that holds
-- Qur'an text, which the qul-reliance decision keeps "for the building tools alone".
--
-- The building tools (the ingest and the page-fixture scripts) connect as the
-- database owner through SUPABASE_DB_URL. The owner bypasses row rules and keeps
-- its own grants, so nothing they do changes. Found 2026-11-12 while auditing the
-- store before moving it to a new project; scripts/supabase-migrations.test.mjs
-- fails if a table is ever added without this.

alter table public.qul_page_lines  enable row level security;
alter table public.qul_layout_info enable row level security;
alter table public.qul_words       enable row level security;

revoke all on table public.qul_page_lines, public.qul_layout_info, public.qul_words
  from anon, authenticated;

-- Tables, sequences and functions added later start closed as well.
alter default privileges for role postgres in schema public revoke all on tables    from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
