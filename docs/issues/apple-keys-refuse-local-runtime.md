# On the laptop, Apple refuses to hand its keys to Cloudflare's stand-in

*Found 2026-11-18, building sign-in step 10.*

## What happened

hifth.app checks each Sign in with Apple note against Apple's public keys, which it fetches from
`https://appleid.apple.com/auth/keys`. Run on the laptop with Cloudflare's own stand-in
(`wrangler pages dev`), every note was refused as `keys-unreachable`, even though curl from the
same laptop fetched the keys fine.

## What the evidence showed

- A throwaway worker on the stand-in fetched the keys itself: Apple answered **403 Forbidden**,
  whatever user agent or accept header it sent.
- The stand-in adds one header to every outgoing request: `Cf-Worker: <random>.example.com`.
- curl with that header also gets **403**. curl with `Cf-Worker: hifth.app` or
  `Cf-Worker: hifth-app.pages.dev` gets **200** and the keys.

So Apple refuses requests that say they come from `example.com`, the stand-in's placeholder name.
Live Cloudflare puts the site's real name in that header, which Apple accepts.

## What we do about it

- Nothing in the code. The check is right to refuse a note it cannot check against Apple's keys.
- On the laptop, `keys-unreachable` from the stand-in is expected. jose's own working was proved
  separately there with a made-up key (it checked a good note and refused a tampered one).
- The live fetch is proved by the first real sign-in after hifth.app's first upload. If that
  answers `keys-unreachable`, look at this page first.
