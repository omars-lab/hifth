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

Two layers, each doing the one thing it can:

1. **In our code: a cap on how many sign-ins can be waiting at once** (60). A sign-in starts
   with a one-off word that is good for ten minutes. Handing one out is the only step that
   writes to the database for someone who has proved nothing yet, so that is where the cap is.
   It keeps anyone from using up the free database's 100,000 writes a day, which would stop
   every sign-in until midnight. Past the cap, the address answers "try again in a minute".
   Words that have run out are cleared at the same moment, so they hold no place.
2. **At Cloudflare: a limit per caller**, which the owner switches on. Only Cloudflare sees
   each caller before our code runs, and it keeps the count, not us.

## What the cap costs

The 60 places are one list for everyone. Someone asking non-stop can fill it and keep new
sign-ins out until the second layer is on. They cannot sign anyone out: readers already signed
in, sign-out, delete my account and Apple's notices never pass through the cap, and a test
holds that.

Also still true: each refused ask reads the waiting list (up to 60 rows), and the free plan
allows 5 million rows read a day. About one refused ask a second, all day, would use that up.
Only the per-caller limit stops it.

## Where it lives

`handOutWord` in `apps/landing/lib/accounts.mjs`, the word address in
`apps/landing/lib/sign-in-api.mjs`, and their tests beside them. The owner's Cloudflare step is
in the deploy-site skill, step 5, and is question ⑮ on the sign-in page.
