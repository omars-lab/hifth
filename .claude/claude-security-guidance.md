# Hifth security rules: the reader decides who sees their data

Hifth is a mus'haf for huffaz. What a reader marks, notes and revises is a record of their
worship, so the first rule is privacy: **nothing about a reader leaves their device, and
no one (a teacher, a friend, a server, us) gets it, until the reader presses a button that
says what goes and to whom. They must also be able to see who has it and take it back.**
Flag any change that breaks this, even when it looks harmless (a share link with one field
too many, a "last revised" in a share sheet, a crash report that carries app state).

## What counts as the reader's data

- Mistake marks, notes, highlights and pen strokes.
- The revision record (`packages/core/src/revision.ts`, `packages/core/src/revision-days.ts`,
  `apps/web/src/revision-store.ts`): when they opened which page, and how often.
- The confusion-jump record: where their memory slips from one verse into another.
- Their settings, their email address, and anything that identifies their device.

## Flag these in the app (apps/web, packages/core)

- A new `fetch`, `sendBeacon`, `WebSocket`, `EventSource`, image ping, URL or query string,
  `navigator.share`, clipboard write or message to the native shell
  (`apps/web/src/native-bridge.ts`) that could carry any of the data above.
- A new import of the revision or confusion-jump modules from a file not on the allow-list in
  `scripts/gate-revision-privacy.mjs`, or a file added to that list with no reason given.
- Analytics, crash reporting, telemetry, A/B testing, ad or tracking scripts, or any
  third-party script tag. The app has none, and adding one needs the owner's decision.
- A share (`apps/web/src/components/ShareSheet.tsx`) that sends more than the verse or
  passage the button names. A private record must never ride along inside another share; it
  gets its own button, worded for it.
- A new way for data to leave that the reader cannot later see and revoke in one place
  ("who has my data"), or that ships without an update to the privacy page.
- Reader data in `localStorage`, Cache Storage or IndexedDB under a key another site or
  another reader on the same device could read by design (e.g. a shared origin).

## If a server ever keeps reader data: an agreement first

Today no server keeps reader data. The day one does (Supabase, Cloudflare D1/KV/R2, Worker
logs), flag any change where:

- Data is stored before the reader has accepted an agreement in plain words that says what is
  kept, who can read it, for how long, and how to delete it. Store which version they
  accepted and when, and refuse to store anything if they have not.
- A table holding reader rows has no row-level security, or a policy like `using (true)`, or
  grants to the public `anon` key. Each reader reads and writes only their own rows.
- A teacher or another reader can read data by guessing or changing an id. Check access on
  the server, on every request, against a share the reader made and can revoke. A revoked
  share must stop working at once, not when a cache expires.
- "Delete my data" does not delete it from every copy (backups excepted, with their
  retention stated), or the reader cannot download their own data.
- Reader data, emails or tokens are written to logs, error messages or analytics.

## The sign-up list on hifth.app (apps/landing, on the landing site's branch)

The "tell me when the apps are out" form keeps an email, the date, and an unsubscribe
token. Nothing else. Flag:

- Any new field, cookie or log line holding the email.
- Turnstile not checked on the server before the row is written.
- An unsubscribe link that uses the email instead of a random token, or a token that is
  guessable or not made with a secure random source.
- A response that shows whether an email is already on the list.
- A change to what is stored without the same change to the privacy page.

## Secrets and the Supabase store

- The Supabase store holds a copy of an outside library (QUL) for our own tools. Its tables
  are closed to the public key; only the laptop reaches them, through `dotenvx`. Flag a
  Supabase client, service key or database password in `apps/web` or apps/landing, in a
  test, a doc, a commit message or a log, and any policy that reopens a table to `anon`.
- Flag a project id, database host with a project id in it, token or key written into the
  repo. Secrets live only in the encrypted `.env` copy.

## The book's text stays private

The Study Quran's translation and commentary appear only in the private pitch build
(`apps/web/src/pitch/`, served from `assets/private/`). Flag anything that copies that text,
or the outside library's bytes, into public assets, tests, docs, PR text or commit messages,
or that makes `assets/private/` reachable from the public site's build.

## Links that open the app (x-callback-url)

The Mac and iPad apps answer links from other apps (`native/Hifth/Route/XCallback.swift`).
Parameters from another app or a link are untrusted. Flag one that is used without checking
it is a real surah, verse or page, or a reply link (`x-success`) that sends back marks, notes
or the revision record without the reader confirming it on screen.
