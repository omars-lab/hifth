# The sign-in limit could not reuse the email form's "are you a person" check

*2026-11-18, while building sign-in step 17.*

## What we assumed

The sign-in plan said step 17 would limit how often anyone can try to sign in by reusing the
check the "tell me when it's out" form already has: Cloudflare's "are you a person" widget
(Turnstile), which the form's server code verifies before it does anything.

## What the code showed

- **The widget lives in a web page.** It runs in the reader's browser, on hifth.app, and hands
  the page a token for the server to verify. Our real widget key answers only on hifth.app.
- **Sign-in is not asked by a page.** The Swift app calls the two sign-in addresses itself, so
  that the session never reaches the page. There is no page for the widget to run in, and
  showing a web view just to run it would put a second screen in front of Apple's sheet.
- **We keep nothing about a caller.** The privacy draft says no internet address is kept, so a
  count per caller in our own database is out as well.

## What replaced it

**In our code: a count of sign-ins started in each ten minutes**, at most 60 for everyone
together. A sign-in starts with a one-off word that is good for ten minutes. Handing one out is
the only step that writes to the database for someone who has proved nothing yet, so that is
where the limit is. It keeps anyone from using up the free database's 100,000 writes a day,
which would stop every sign-in until midnight. Past the limit, the address says how long to
wait (ten minutes at most) and writes nothing.

## The first try at it was wrong, and how we found out

The first version (commit 841ccf70, the same day) counted words *waiting*, not words handed
out: at most 60 could be waiting at once. A review pointed out the hole, and a test proved it:
a caller can ask for a word and use it up straight away with a junk note, which frees the place,
and repeat without end. The test asked 180 times and got 180 words. Counting words handed out
per stretch of time closes that; the test now stops at 60.

The same review caught two more things written into the owner's steps:

- **The Cloudflare rule was drawn too wide.** "Addresses starting with /api/sign-in" would also
  have limited delete my account and Apple's notices, which must never be turned away. It is
  now the one address that starts a sign-in.
- **The Cloudflare rule was oversold.** The free plan's limit counts over 10 seconds and blocks
  for 10 seconds. Even set as tight as it goes, one caller can still ask about once every ten
  seconds: 60 in ten minutes, the whole shared allowance. So it stops a flood from one place,
  and it cannot stop one patient caller keeping new sign-ins out.

## What the limit costs, and what is left open

The 60 are one count for everyone, because nothing about a caller is kept. Someone asking
steadily can take them all and keep new sign-ins out for as long as they keep at it. They
cannot sign anyone out: readers already signed in, sign-out, delete my account and Apple's
notices never pass through the limit, and a test holds that.

Limits on how often people ask cannot fix this on the free plan: the database's allowance and
one caller's smallest possible share are the same size. What can is deciding who may start a
sign-in at all. That is question ⑮ on the sign-in page, with its options; the recommended one
is to check the tester invite code (step 18) before a word is handed out.

## What was checked afterwards

- The counting statement was tried once through Cloudflare's own local database, not only the
  tests' stand-in: with a limit of 2 and four asks it reported 1, 1, 0, 0 changes and kept 2.
- The server half of the invite check is built and off (`uninvited` in
  `apps/landing/lib/sign-in-api.mjs`, the codes in `apps/landing/lib/invites.mjs`).
- A turned-away ask still runs our code, and Cloudflare's free plan runs it 100,000 times a
  day. So the free rule per caller is worth having for that reason, even though it cannot stop
  the lock-out above.

## Where it lives

`handOutWord` in `apps/landing/lib/accounts.mjs`, the count's table in
`apps/landing/migrations/0003_sign_in_counts.sql`, the word address in
`apps/landing/lib/sign-in-api.mjs`, and their tests beside them. The owner's Cloudflare step is
in the deploy-site skill, step 5.
