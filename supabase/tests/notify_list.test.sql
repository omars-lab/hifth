-- The sign-up list's database part, as the site's publishable key sees it (the anon role).
-- Run with: make notify-db-test (supabase test db, against a local copy). Every address here
-- is made up.
begin;
select plan(14);

-- The site's made-up local key, from supabase/seed.sql.
\set key local-list-key-made-up-not-secret
\set code1 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
\set code2 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb

set local role anon;

-- Nothing outside can read the list or the keys.
select throws_ok($$ select * from notify.people $$, '42501', null, 'the list cannot be read with the public key');
select throws_ok($$ select * from notify.server_keys $$, '42501', null, 'the site keys cannot be read with the public key');
select throws_ok($$ select notify.key_ok('x') $$, '42501', null, 'the key check cannot be called directly');

-- The public key alone is not enough.
select throws_ok(format($$ select public.notify_add(%L, 'someone@example.com', 'en', %L) $$, 'wrong-key', :'code1'),
  '42501', null, 'adding with the wrong site key is refused');
select throws_ok(format($$ select public.notify_add(null, 'someone@example.com', 'en', %L) $$, :'code1'),
  '42501', null, 'adding with no site key is refused');
select throws_ok(format($$ select public.notify_confirm(%L, %L) $$, 'wrong-key', :'code1'),
  '42501', null, 'confirming with the wrong site key is refused');

-- With the site key: a new address and one already there answer the same (nothing).
select lives_ok(format($$ select public.notify_add(%L, 'Someone@Example.com', 'ar', %L) $$, :'key', :'code1'), 'a new address is kept');
select lives_ok(format($$ select public.notify_add(%L, 'someone@example.com', 'en', %L) $$, :'key', :'code2'), 'the same address again answers the same');
select throws_ok(format($$ select public.notify_add(%L, 'not an address', 'en', %L) $$, :'key', :'code1'),
  '22023', null, 'something that is not an address is refused');

-- Only the latest code confirms, a wrong one says so, and confirming twice is fine.
select is(public.notify_confirm(:'key', :'code1'), false, 'an old confirm code does nothing');
select is(public.notify_confirm(:'key', repeat('c', 48)), false, 'a made-up confirm code does nothing');
select is(public.notify_confirm(:'key', :'code2'), true, 'the code in the latest email confirms');
select is(public.notify_confirm(:'key', :'code2'), true, 'pressing it again still says confirmed');

-- Leaving: look up the leave code as the owner would, then leave with the public key.
reset role;
select set_config('test.leave', (select leave_code from notify.people where email = 'someone@example.com'), true);
set local role anon;
select public.notify_leave(:'key', current_setting('test.leave'));
reset role;
select is((select count(*) from notify.people where email = 'someone@example.com')::int, 0, 'leaving removes the row');

select * from finish();
rollback;
