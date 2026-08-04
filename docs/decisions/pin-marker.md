# One bit of provenance, and the line it does not cross

*Backlog ⑮ · 2026-08-04 · supersedes nothing; completes [loop-6b](loop-6b.md) §"Pinning writes
every file twice".*

Loop 6b shipped pin-a-juz with a known waste: `pinPack` fetched with an ordinary page `fetch`,
so the service worker filed every pinned file a second time in `hifth-pages`. The entry was
written rather than patched because both candidate fixes looked worse than the waste. Neither
of those two readings survived measurement.

## The decision

**`pinPack` sends an `X-Hifth-Pin` request header, and both `runtimeCaching` routes decline
anything carrying it.**

The header is the entire mechanism. `PIN_HEADER` lives in `apps/web/src/packs.ts` and is
repeated as a literal in `apps/web/vite.config.ts`; the pin's fetches carry it, the pages and
data routes both test `!request.headers.has("X-Hifth-Pin")`, and a request no route matches is
never stored. One copy, in `hifth-pack-v1`, where the pack's own lifetime rules apply.

### The line this draws

The stated cost of this candidate — in ⑮ and again in loop-6b — was *pack knowledge in the
worker*. That was mispriced, and pricing it correctly is the decision.

**Static provenance is not knowledge. Dynamic shape is.**

The worker learns one bit: *this fetch is not a read for display*. It does not learn
`PACK_CACHE`'s name, which URLs a pack holds, how many, that an IndexedDB register exists, or
what `whole` / `torn` / `gone` mean. `planPack` can change shape forever — more shards, fewer
pages, a different edition layout — and `sw.js` does not move. Every candidate that lost either
crossed that line or did not fix the harm.

## What the measurements settled

Three probes against the built app with the worker in control. All of them are why this entry
stopped being a design question.

**Sweeping afterwards cannot work — this retires candidate 2 on a number.** `ExpirationPlugin`
evicts at *write* time (`cacheDidUpdate` → `expireEntries`), so the reader's trail is already
gone before any `unpinPack` sweep could run. Clear `hifth-pages`, read 32 pages → 31 entries.
Fetch 21 pages as a pin → **11 of the 31 survive**. Delete all 21 duplicates → **still 11**.
The evicted do not come back. Candidate 2 was never a narrower fix; it was not a fix.

**No fetch option avoids the store.** ⑮ had established that a page-initiated `cache.add` is
routed through the worker like anything else. Extending it: `{}`, `cache:"reload"`,
`no-store`, `no-cache` and a marked fetch all land in `hifth-pages` under the pre-fix worker.
So the route change *is* the fix, and the marker is only how the route recognises it — ⑮'s
phrasing pairs `cache:"reload"` with a declining route, and the first half is inert. The
mechanism the fix rests on was checked directly too: `fetch("/_headers")`, which no route
matches, ends up in zero caches.

**The marker survives into the worker.** `Cache.prototype.put` was wrapped inside the running
worker to record the `Request` workbox is about to file. An ordinary read files
`{cache:"default", pin:null}`; a marked fetch files `{cache:"reload", pin:"1"}`. The request
workbox files is the one `Router.handleRequest` hands the matcher, so what is visible at the
write is visible at the match.

## Three choices inside the decision

**A header, not a URL marker.** `?hifth-pin=1` is expressible with `url.searchParams` alone —
the cheapest primitive, already used in this config — and it was rejected because it gives
every file two identities. `cache.put` must then be told which one to key on, and keying it
wrong produces a pack that reports `whole` while `packedResponse` misses: a pin that can only
be found wanting in aeroplane mode, which is the one shape this feature exists to prevent. It
would also change the CDN cache key and take `assets/manifest.json` off the precache route.

**A custom header, not `request.cache !== "reload"`.** This was a genuine third door — it
invents no vocabulary at all, and it is visible inside the worker (measured). It lost on
meaning: a pin does not want fresh bytes, it wants not to be *filed*, and using an HTTP-cache
directive to say "do not file" conflates two caches — the same conflation loop-6b refused when
it gave the pack its own store rather than sharing an eviction policy with reading. It is also
over-broad by construction: any future reload-mode fetch would silently stop the trail cache
filling. And `&& request.cache !== "reload"` does not say why it is there;
`!request.headers.has("X-Hifth-Pin")` does.

**Both routes, not just the pages route.** `hifth-data`'s 400-entry cap means a duplicated
shard evicts nothing, so the pages route is where the whole harm is. The data route gets the
clause anyway: it is still a copy of bytes the pack already answers, and a rule with an
exception reads worse than a rule.

**`unpinPack` is deliberately untouched.** After this, a pin writes nothing outside its own
cache, so there is nothing to sweep. Duplicates left by an older build are valid page responses
in a page cache, indistinguishable from ordinary reading, and the LRU retires them within ~32
page reads. Teaching `packs.ts` the string `"hifth-pages"` to clean up a condition that expires
by itself is the app and the worker disagreeing about who owns a cache — which is a worse state
to be in than the waste it would remove.

## Why the two literals cannot be one

Workbox `generateSW` serialises a route matcher with `Function.prototype.toString`, so an
imported constant arrives at the worker as `undefined` and the route silently declines nothing
— the worst failure shape available, because it is green everywhere. Verified in the emitted
bundle:

```
registerRoute(({url:e,request:s})=>e.pathname.includes("/assets/pages/")&&!s.headers.has("X-Hifth-Pin"), …)
```

The e2e is what holds the two copies together; the comment beside each says so.

## What proved it

`apps/web/e2e/offline.spec.ts`, in the order a regression would hit them:

- **"keeping a juz does not spend the reader's browsing cache"** — new, and the one that
  asserts the *harm* rather than the symptom. The `hifth-pages` key set is compared across the
  pin and must be identical. It goes red if either literal is edited without the other, if a
  future `runtimeCaching` entry is added without the clause, or if a browser stops surfacing
  the header. One juz, not two: a second real pin is ~3 MB more in an already-90 s test and
  proves the same invariant.
- **"opens a page the reader has never visited, with the network gone"** — the tripwire ⑮
  planted, flipped from `[PACK_CACHE, "hifth-pages"]` to `[PACK_CACHE]`. It was written to
  fail the day the double-write stopped, and it did.
- **`dropOutsidePack`** stays, re-scoped. It is no longer about ⑮; the app opens *inside*
  juz 1, so the reader's own trail legitimately holds part of the juz being pinned, and that
  copy is still what would let the offline assertion pass with the pack deleted. Deleting the
  helper is the one edit that would make a future regression quiet again.
- `apps/web/src/packs.test.ts` **"marks every fetch so the worker's routes stand aside"** —
  runs in `pnpm test` with no build and no browser.

**Negative control, run and reverted.** With both clauses stripped from `vite.config.ts` and
the app rebuilt, exactly those two e2e tests fail and the other ten pass. The assertions are
not vacuous.

Cost: +0.1 KB gz against the budget baseline — roughly 40 bytes in `sw.js` and 40 in the app
chunk. Bytes at pin time are unchanged; unlike the `cache:"reload"` variant, a marked fetch can
still be answered by the HTTP cache, so pages already read are not re-downloaded.

## What it does not do

**The redundancy is gone, on purpose.** There used to be an accidental second copy of every
pinned page; now there is one. That was never durable — the LRU retired it within ~32 page
reads, which is why `dropOutsidePack` had to exist — and the machinery for its absence already
shipped in 6b: `checkPack` reports `torn`/`gone`, the notice says so in words, `repinPack`
restores from the register's own URL list, and `packedFetch` falls through to the network when
there is one.

**It is unverified outside Chromium.** Whether WebKit and Gecko surface a custom header on
`FetchEvent.request` is not checked here, and this suite is Chromium-only by construction.
There is no spec reason they would not, and the failure mode if one does not is exactly the old
behaviour — a duplicate, not a broken pack. The check belongs on the phone, in the
`offline-survival-8-day` runbook: pin juz 1, then confirm in Web Inspector that `hifth-pages`
does not hold the pinned pages.

**A cross-origin move would break it.** A custom header on a cross-origin GET triggers a CORS
preflight. Every pack URL is same-origin today (`base: "./"`); serving assets from a CDN
subdomain has to revisit this, and the reason is written in the `PIN_HEADER` docblock so it is
found at the moment it matters.
