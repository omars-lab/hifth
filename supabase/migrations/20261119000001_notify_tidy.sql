-- The daily tidy of the Mac-app list (docs/design/hifth-app-mailing-list.md, item ⑦).
--
-- notify_add already deletes addresses nobody confirmed within 7 days, but only when someone
-- else signs up, so on a quiet week the privacy page's "deleted after 7 days" was not kept. And
-- Supabase's free plan puts a project to sleep after 7 quiet days. A small Cloudflare Worker
-- (apps/landing/tidy/) calls this once a day: the call deletes those rows, and being a call at
-- all keeps the project awake.
--
-- Like the other three, it asks for the site's own list key, and it answers only how many rows
-- went, never which.

create function public.notify_tidy(p_key text) returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  gone integer;
begin
  if not notify.key_ok(p_key) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from notify.people where confirmed_at is null and signed_up_at < now() - interval '7 days';
  get diagnostics gone = row_count;
  return gone;
end;
$$;

revoke all on function public.notify_tidy(text) from public, anon, authenticated;
grant execute on function public.notify_tidy(text) to anon;
