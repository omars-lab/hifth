-- The "tell me when the Mac app is out" list (docs/design/hifth-app-mailing-list.md,
-- "Where does the list live, and who can read it?").
--
-- The table sits in its own schema, `notify`, which the API does not serve (config.toml's
-- api.schemas lists only public and graphql_public), so nothing outside can list it. The site
-- reaches it through three functions in `public`, called with the publishable key:
--
--   notify_add(key, email, lang, confirm_code)   keep an address, waiting for its confirmation
--   notify_confirm(key, confirm_code)            the reader pressed the button in that email
--   notify_leave(key, leave_code)                the reader pressed "Leave the list"
--
-- The publishable key is public, so it alone must not be enough: each function also asks for
-- the site's own list key, held only as a Pages secret, and checks it against a hash kept in
-- notify.server_keys. Without it, anyone could skip the spam check and add (and, by choosing
-- the confirm code, confirm) addresses they do not own. No function returns anything about
-- anyone else; notify_add answers the same for a new address and one already there.
--
-- Ordering: this sorts after 20261112000001_close_qul_tables.sql on the supabase-move branch;
-- it touches none of the outside-library tables.

create schema if not exists notify;
revoke all on schema notify from public;
revoke all on schema notify from anon, authenticated;

create table notify.people (
  email        text primary key check (length(email) <= 254),
  lang         text not null default 'en' check (lang in ('en', 'ar')),
  signed_up_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirm_code text not null unique check (confirm_code ~ '^[0-9a-f]{48}$'),
  leave_code   text not null unique
               default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
);
comment on table notify.people is
  'The Mac-app list. Read only with the database password, by the laptop send script; never through the API.';

-- The site's list key, as a SHA-256 hash. The owner adds the production row once, with the
-- database password; supabase/seed.sql adds a made-up local one.
create table notify.server_keys (
  hash  bytea primary key,
  note  text not null default ''
);

alter table notify.people enable row level security;
alter table notify.server_keys enable row level security;
revoke all on all tables in schema notify from public, anon, authenticated;

create function notify.key_ok(p_key text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_key is not null
     and exists (select 1 from notify.server_keys k where k.hash = pg_catalog.sha256(pg_catalog.convert_to(p_key, 'UTF8')));
$$;
revoke all on function notify.key_ok(text) from public, anon, authenticated;

create function public.notify_add(p_key text, p_email text, p_lang text, p_confirm text) returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not notify.key_ok(p_key) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_email is null or length(p_email) > 254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'not an address' using errcode = '22023';
  end if;
  if p_confirm is null or p_confirm !~ '^[0-9a-f]{48}$' then
    raise exception 'not a confirm code' using errcode = '22023';
  end if;

  -- An address nobody confirmed within 7 days is someone who has not agreed.
  delete from notify.people where confirmed_at is null and signed_up_at < now() - interval '7 days';

  insert into notify.people as p (email, lang, confirm_code)
  values (lower(p_email), case when p_lang = 'ar' then 'ar' else 'en' end, p_confirm)
  on conflict (email) do update
    set confirm_code = excluded.confirm_code,
        lang         = case when p.confirmed_at is null then excluded.lang else p.lang end,
        signed_up_at = case when p.confirmed_at is null then now() else p.signed_up_at end;
end;
$$;

create function public.notify_confirm(p_key text, p_code text) returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not notify.key_ok(p_key) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update notify.people
     set confirmed_at = coalesce(confirmed_at, now())
   where confirm_code = p_code
     and (confirmed_at is not null or signed_up_at >= now() - interval '7 days');
  return found;
end;
$$;

create function public.notify_leave(p_key text, p_code text) returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not notify.key_ok(p_key) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from notify.people where leave_code = p_code;
end;
$$;

-- Postgres lets everyone run a new function, and Supabase's default rights add the API roles;
-- take both away, then let only the publishable key's role (anon) and the server role call them.
revoke all on function public.notify_add(text, text, text, text) from public, anon, authenticated;
revoke all on function public.notify_confirm(text, text) from public, anon, authenticated;
revoke all on function public.notify_leave(text, text) from public, anon, authenticated;
grant execute on function public.notify_add(text, text, text, text) to anon;
grant execute on function public.notify_confirm(text, text) to anon;
grant execute on function public.notify_leave(text, text) to anon;
