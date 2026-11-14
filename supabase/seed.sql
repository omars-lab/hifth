-- Local only: `supabase start` and `supabase db reset` run this after the migrations, and
-- `supabase db push` never does. It gives the local sign-up list a made-up site key, the same
-- one the release tool's `serve` hands the local server (LOCAL_LIST_KEY in
-- .claude/skills/deploy-site/scripts/release-hifth-app.mjs). The real key's hash is added to
-- the live project by the owner, once, with the database password.
insert into notify.server_keys (hash, note)
values (sha256(convert_to('local-list-key-made-up-not-secret', 'UTF8')), 'local, made up')
on conflict do nothing;
