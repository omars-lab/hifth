# What does someone see when they type hifth.app?

**Short version:** hifth.app gets a front page. It says in one line what Hifth is for, opens the
web app (which moves to hifth.app/read), says the Mac app is coming soon, and lets a reader leave
an email to hear when it ships. The full plan, with every step, is in
[the hifth.app plan](../../.claude/plans/hifth-app-site.md).

**What it changes for a hafiz:** a short address to remember and to pass to a friend, and one
place to hear when the Mac app is out. The pages, marks and look-alike jumps are unchanged.

**What is settled (owner, 2026-11-11):**

- The page says "Mac app — coming soon", with no store name and no store badge.
- The web app moves to hifth.app/read now. Readers at the old address are offered a way to carry
  their marks across.
- The page collects emails for one "it's out" message. It keeps nothing else, and it has no
  sign-in button.
- It is hosted on Cloudflare Pages, on the new account that holds hifth.app.

## Open questions, and what would answer each

### ① Is hifth.app live, with the app at /read and the email form working? · **open**

Not yet. The front page and the privacy page are drawn and checked on a laptop and a phone-width
screen. The release tool is built and tested (④). The email form's server part is built (⑥).
The app runs under /read (checked 2026-11-12), and the way to carry marks across is built and
tested, but switched off until hifth.app is live (⑦).

What would answer it: hifth.app and hifth.app/read open in Firefox and Chrome; a throwaway email
signs up and leaves again; marks made at the old address arrive at the new one.

### ② Can the "what each commit was for" picture open from the local hub? · **fixed**

Yes (2026-11-11). It used to open only as a file on disk, from whichever folder had drawn it, so
it had no place on the local hub. Now the app's development server hands it over at /intent/,
and the hub lists it as a private, local-only page. A production build never includes it, and
the route serves that one page and nothing else from the repository. Draw or redraw it with
`make intent`.

### ③ What contact address does the privacy page give? · **open**

The privacy page tells a reader how to have their email removed without the link in the email.
It needs an address the owner reads. Until the owner picks one, the page shows a placeholder,
and the site does not go live with it.

### ④ Has the release tool ever put hifth.app up? · **open**

Not yet. `make hifth-app-check` is proven on a real build: it refused exactly the four real
problems and nothing else. The last look at the live site is proven against Cloudflare's own
local server (see `docs/issues/hifth-app-unknown-addresses.md`). The upload itself has never
run. Before it can:

- the Cloudflare Pages project `hifth-app` has to be made on the new account, with `main` as
  its live branch and hifth.app attached to it;
- the keys have to be on this laptop (`lpass login`, then `make env-keys-pull env-bootstrap`);
- ③ and ⑤ have to be answered, or the check refuses the pages;
- the email list's database has to be made (⑥), or the check refuses the site's settings.

Two things still point at the old setup. The `app-setup` skill names
hifth.bytesofpurpose.com/share for Cloudflare. `make deploy-cloudflare` publishes with wrangler's
own login, which is the other account. Both get pointed at hifth.app, or retired, once the
first upload works.

What would answer it: `make hifth-app-publish` from a clean worktree at origin/main, ending in
its own "live" line, and a look at hifth.app in Firefox and Chrome.

### ⑤ Which spam-check key does the email form carry? · **open**

The front page carries Cloudflare's published test key for its spam check (Turnstile), which
lets every robot through. The release check refuses it. The real key comes from the new
Cloudflare account, when the owner makes the Turnstile widget for hifth.app. Its secret half
goes in as a Pages secret, never in the repository.

### ⑥ Does the email form keep an address? · **built, not live**

Yes, on this laptop (2026-11-12). It was tried on Cloudflare's own local server, with the real
spam check in its test setting. From the page at phone width, an address went in and the page
said "You're on the list". The same address again said "already on the list", and a bad one was
turned away. The leave link took the address off, and the list was back to zero.

How it works:

1. The page sends the address and the spam-check answer to `/api/notify`.
2. The server asks Cloudflare once whether the spam check passed, and on which site. An answer
   can only be checked once, so it never asks twice.
3. It keeps three things: the address, the date, and a random key for the leave link. It keeps
   nothing else.
4. The leave link, `/api/unsubscribe?t=…`, says the same thing whether or not it matched. The
   link can't be used to find out whether an address is on the list.

The answers never repeat the address. The tests use made-up addresses only.

The code is in `apps/landing/lib/notify.mjs`, with its tests next to it. Cloudflare's
two small entry files are in `apps/landing/functions/api/`, the table in
`apps/landing/schema.sql`, and the site's Cloudflare settings in `apps/landing/wrangler.toml`.

What is left before it is live:

- make the database on the new account, put its id in the settings, and make its table;
- put the spam check's secret in as a Pages secret (⑤);
- a way to count the list without showing any address.

Until the database is made, the release check refuses to publish.

### ⑦ Can a reader at the old address bring their marks to hifth.app? · **open**

Built, and switched off. It works in tests in Chrome, Firefox and iPhone Safari (2026-11-12). It stays off until hifth.app/read
is live, and then one switch turns it on (step 5 of the plan).

**Why it is needed.** A browser keeps a site's saved things under the site's exact address. A
reader's bookmarks, notes and look-alike jumps at blog.bytesofpurpose.com stay there; hifth.app
opens empty.

**What the reader sees.** A card at the foot of the page, at the old address only (never in the
iPad or Mac app): "Hifth has moved to hifth.app". It has two buttons:

- **Carry them to hifth.app** opens hifth.app/read in a new tab, and the marks arrive there. The
  new tab says how many came across, and the card says how many were carried. From then on the
  card offers **Open hifth.app** instead.
- **Later** puts the card away for a week.

If hifth.app doesn't answer within 15 seconds, or the browser stops the tab from opening, the card
offers **Save to a file**. The reader can then load that file at hifth.app, as they can today.

**How it works.**

```mermaid
sequenceDiagram
  participant Old as old address
  participant New as hifth.app/read
  Old->>New: opens it in a new tab (#/carry)
  Note over New: waits until its own bookmarks are read in
  New->>Old: ready
  Old->>New: the same file "Save to a file" writes
  Note over New: loads it like "Load from a file"; adds, never replaces
  New->>Old: done, N items
```

- Each side listens only to the other's exact address, and only to the tab it opened or was
  opened by. Any other page that sends the same message is ignored. A test checks this.
- Loading adds to what hifth.app already holds; nothing there is replaced. Building the carry
  found a real fault here, now fixed with a test. A bookmark loaded in the moment before the
  saved ones were read in wrote a list holding only itself, so the saved ones were lost on disk.
- A reload of the new tab doesn't take the file again.
- hifth.app must never send the header that cuts a new tab off from the page that opened it
  (Cross-Origin-Opener-Policy). The release check refuses it, with a test.

What doesn't come across yet is ⑧.

**Where the app lives under /read.** The app's offline helper (its service worker) covers
`/read/` and nothing above it, so the front page is never cached as part of the app. The app keeps
its place after the `#` in the link, so every link asks for `/read/` itself. That means there is
no catch-all rule sending unknown paths to the app; a mistyped path gets the site's "No page here"
page.

The rules are in `apps/web/src/moved.ts`, with tests beside it. The card is
`apps/web/src/components/MovedSheet.tsx`, the new tab's half is `apps/web/src/useCarryIn.ts`, and
the browser test is `apps/web/e2e/carry-marks.spec.ts`. The test stands in for the two addresses
with `localhost` and `127.0.0.1`, which a browser keeps apart like two sites.

### ⑧ What does a reader leave behind when they carry their marks across? · **open**

The carry brings what the saved file holds: bookmarks, notes and look-alike jumps. Three things
stay at the old address, because the app keeps them in a different store:

- where the reader left off, so hifth.app opens at the first page;
- the revision record;
- their settings (language, layout, sizes), so hifth.app opens in the default language.

Where they left off matters most: a hafiz who carries across and lands on page one has to find
their place again by hand.

What would answer it: the carry sends these too, and the browser test for the carry (⑦) finds them
at the new address.

`www.hifth.app` is a separate address with its own store as well, so every link sends readers to
`hifth.app` itself.
