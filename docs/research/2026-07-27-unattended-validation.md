# Automating Hifth's Tier-7 checks — research report

*Researched 2026-07-27 against `loop-2-the-hop`. Question asked: for each of the six manual
checks still pending, how much can be driven end to end with no human in the loop, and what is
the honest residue that cannot be? Deliverable: a report to review, not a green tick.*

*Verified locally after the research ran: the installed Playwright is **1.61.1** (`^1.49.1` in
`apps/web/package.json`), so `toMatchAriaSnapshot` — which recommendation ① rests on — is
available today with no upgrade.*

---

## 1. Verdict

**One of the six can be fully automated with no residue at all** (`source-offer-resolves` — and
the automated version is *stronger* than the manual one, because a CI runner with no cookies is a
better model of "a stranger" than your own private window with your own IP). **Four are
substantially automatable with a named, honest residue** (`perf-verdict-on-device` — real Android
yes, iOS pinch no; `screen-reader-walkthrough` — every announcement string and its order yes,
whether the phrase sounds human no; `offline-survival-8-day` — the eviction-*detection* path yes,
the eight days no; `kfgqpc-terms-primary-source` — "has it moved?" yes, "is our summary stricter
than the source?" no). **One cannot be automated at all and should not be** (`edge-spot-audit` —
the data is scripture and a hafiz with a printed mushaf is the instrument; what *can* be automated
is making each 30-minute round buy more).

The most important structural finding: **four of the six have an automatable half that is
buildable today and that delivers the `tunes` the ledger already asks for, without waiting for the
human half.** `offline-survival-8-day`'s two `tunes` entries (assert the eviction-detection path;
tune `storage.ts`'s re-pin trigger) do not actually need eight days of calendar — they need an
origin whose storage vanishes under a live page, which is one CDP call. That is the pattern worth
generalising: **automate the half that tunes something, and let the human half shrink to the
judgement nobody else can make.**

On emulation-vs-real-device: **the Loop 1 judgement should not be overturned, and the
recommendation does not ask you to.** See §5.

---

## 2. The table

| Check | Automatable? | Mechanism | Cost | Residue | What the automated part tunes |
|---|---|---|---|---|---|
| `source-offer-resolves` | **Fully** | `HIFTH_BASE_URL=<deployed>` + existing `colophon.spec.ts`; unauthenticated `request.get()` on the colophon href and every attribution link; assert 200 + linked SHA == deployed SHA | ~1h build, ~10s/run, $0, very low brittleness | None material | New `scripts/gate-source-offer.mjs` becomes the gate on `public-deploy`; `provenance.ts` `SOURCE_REPO` if it 404s |
| `screen-reader-walkthrough` | **Mostly** | `expect(locator).toMatchAriaSnapshot()` over the whole hop tour on both `iphone`+`android` projects; axe already present | ~1h build, +~5s/run, $0, low brittleness | Whether «الآية البقرة · ٢:٤٨» is a phrase a person would say; how an Arabic TTS voice pronounces ٢:٤٨; the eyes-closed tour | `share-a11y.spec.ts` — every announced label and its order pinned as a committed snapshot; `highlighter.ts` label shape |
| `perf-verdict-on-device` | **Mostly (Android)** | `playwright._android` over adb → real Chrome on real silicon + CDP `Input.synthesizePinchGesture` / `synthesizeScrollGesture` / `synthesizeTapGesture`, reusing `probe.ts`'s stats shape | ~1 day build, ~2 min/run, $0 (own phone) / $175–225 mo (cloud), medium brittleness (experimental APIs) | Real iOS Safari pinch (no CDP, no multi-touch); the standalone-vs-Home-Screen comparison | `apps/web/perf/pan-zoom-trace.mjs` — the asserted frame budget becomes a measured number from real hardware; `PLAN §Loop 4b` rendering verdict |
| `offline-survival-8-day` | **Half** | CDP `Storage.clearDataForOrigin` under a live page = what an ITP sweep looks like to the app; `navigator.storage.estimate()` + Cache Storage introspection already in `offline.spec.ts` | ~2h build, +~10s/run, $0, low brittleness | Whether Safari actually sweeps at 7 days, and whether the installed bucket survives. **No supported fast-forward exists** | `offline.spec.ts` eviction-detection path; `storage.ts` re-pin trigger — i.e. **both** of the ledger's `tunes`, delivered without the 8 days |
| `kfgqpc-terms-primary-source` | **Half, and conditional** | Scheduled fetch → normalize → SHA-256 → fail/open-issue on drift. Blocked on reachability (§3.4). Independently: a copy-drift gate between `SOURCES.md` and `Colophon.tsx` | ~2h + a 2-min reachability probe first, $0, medium brittleness (gov site, likely geo-fenced) | The judgement "is our restatement stricter than the source?" — which fails *silently*, so it is exactly the judgement a machine must not make | `SOURCES.md` §hafs-kfqc status line; a new `gate-licence-copy.mjs` that stops the two restatements drifting apart |
| `edge-spot-audit` | **No** | — | — | **All of it.** A printed mushaf in a hafiz's hands | Sampler upgrades (stratified draw, root-sequence similarity from already-vendored morphology, coverage-by-type) make each round buy more. They never touch `verdict` |

---

## 3. Per check

### 3.1 `source-offer-resolves` — fully automatable, and better automated

The check asks two machine questions: does the colophon's link resolve for a client that is not
you, and does it point at the commit that is actually deployed. Neither needs a human.

`playwright.config.ts` already has the hook — `HIFTH_BASE_URL` points a run at an already-served
build (it exists for `make golden-linux`). `colophon.spec.ts` already opens the wordmark, finds
the `الشيفرة المصدرية` link, and asserts the href shape against `SOURCE_REPO`. What it does not do
is **follow** the link, and it runs against localhost.

Three additions close it:

1. Run the existing spec against the deployed URL. A fresh Playwright context has no cookies by
   construction — it is logged out more reliably than a private window, which still carries your
   IP and can pass geo/rate rules a stranger's would not.
2. `request.get(href)` with no auth and assert 200. GitHub returns **404**, not 403, to
   unauthenticated clients for a private repo, so this catches the exact failure the check is
   written for.
3. Assert the SHA in the href equals the SHA the deployed bundle reports. The ledger's third
   `reading` line — "lands on a commit that is not the deployed build … which is worse than no
   link" — is currently checked by nobody, and it is trivially checkable.

Plus the attribution links (`corpus.quran.com` is plain `http` — a redirect or a dead host is
precisely the "licence term being quietly failed" the runbook names).

**Residue: none material.** The only thing lost is a human's eye on whether the sheet *looks*
right, which `contrast.spec.ts` and the golden set already own.

### 3.2 `screen-reader-walkthrough` — the structure automates, the ear does not

The check has two halves that the runbook itself already separates. Steps 1, 2, 4, 5, 7 are
assertions about **what is announced and in what order**. Steps 3 and 8 are "does this sound like
something you would say" and "do the whole tour with your eyes closed". The first half is fully
machine-checkable; the second is the check.

**The cheapest high-value tool is `toMatchAriaSnapshot`**
([Playwright ≥1.49](https://playwright.dev/docs/aria-snapshots); this repo runs 1.61.1). It
serialises the accessibility tree to YAML — roles, names, structure, order — and commits it as a
snapshot. Applied to the chrome, the page group, the rail, the popover and the trail, it pins
every string in the runbook's `expect` lines *as a committed artifact*, on both the `iphone`
(WebKit) and `android` (Chromium) projects you already run. It catches, forever and for free:

- a glyph-only control (⌖, ▤) losing its label — the runbook's own "cheapest place in the tour to
  catch that"
- the number badge leaking through as "circle 3"
- announcement **order** changing
- focus escaping the sheet (assert the dialog's subtree is the whole snapshot when open)

This is strictly better than what the repo has now, and it is the exact artifact the ledger's
first `tunes` line asks for. Note the skill file already records why axe cannot do this job here —
it files this app's chrome under `incomplete`, which never fails a build. Aria snapshots have no
`incomplete` tier.

**Real screen readers.** [Guidepup](https://github.com/guidepup/guidepup) drives real VoiceOver on
macOS and NVDA on Windows from Playwright, and exposes `spokenPhraseLog()` /
`lastSpokenPhrase()`. **It does not support VoiceOver on iOS or TalkBack on Android.** macOS
VoiceOver is a genuinely different reader from iOS VoiceOver — different gesture model, different
grouping heuristics, different rotor — so a green macOS run is not a pass on the device this app
is for. Worth one exploratory run; not worth a gate (§7).

**TalkBack.** Capture is technically possible: enable TalkBack over `adb shell settings put secure
enabled_accessibility_services`, set log level VERBOSE, and parse utterances out of `logcat`. The
one public reference implementation,
[`bocoup/aria-at-talkback-capture`](https://github.com/bocoup/aria-at-talkback-capture), is 8
commits, macOS-only, and its own README documents that the captured lines are sometimes different
from TalkBack's speaker queue — i.e. utterances get dropped. A harness whose failure mode is a
silently missing announcement is the wrong tool for a check about missing announcements.

**Cloud options.**
[LambdaTest added iOS VoiceOver on real devices](https://www.globenewswire.com/news-release/2025/02/27/3034039/0/en/lambdatest-introduces-ios-voiceover-testing-on-real-devices-elevating-mobile-accessibility.html)
(Feb 2025) and
[Assistiv Labs](https://assistivlabs.com/articles/automating-screen-readers-for-accessibility-testing)
runs real NVDA/JAWS/VoiceOver remotely. Both are primarily **assisted manual** — you listen, they
record the session. They remove the "own the device" cost, not the "a human must listen" cost.
That is fine: the human cost is the irreducible part anyway.

**Residue, precisely:** (a) whether «الآية البقرة · ٢:٤٨» is a phrase a person would actually say
— the ledger is right that this is the bet under test; (b) how an Arabic voice *pronounces* ٢:٤٨ —
note that even Guidepup captures the text VoiceOver *would* speak, not the audio, so digit
pronunciation is invisible to every automated route; (c) the eyes-closed tour, which the runbook
itself calls "the actual verdict".

### 3.3 `offline-survival-8-day` — the eviction-detection half is buildable today

Two facts settle this.

**The premise is well documented and current.**
[WebKit's tracking-prevention page](https://webkit.org/tracking-prevention/) still states the
7-day cap on all script-writable storage, and states the exemption verbatim: home screen web
applications' first-party domain is exempt from it. PLAN §4 rule 4 already re-verified this in
2026-07 and cites
[Apple's own forum thread](https://developer.apple.com/forums/thread/710157) on the separate
days-of-use counter. So the experiment is confirming a documented asymmetry, not discovering one.

**There is no supported fast-forward, and two plausible-looking ones do not work:**

- `page.clock` ([Playwright](https://playwright.dev/docs/clock)) overrides `Date`, `setTimeout`,
  `setInterval`, `requestAnimationFrame`, `requestIdleCallback`, `performance` and
  `Event.timeStamp` — **all inside the page's JavaScript environment**. ITP's sweep timer lives in
  the browser process. Faking the page's clock cannot move it.
- [ITP Debug Mode](https://www.simoahava.com/privacy/itp-debug-mode-in-safari/) is a **console
  logger** for ITP's actions. It does not shorten the storage cap.

WebKit's own layout tests force the sweep through `WKWebsiteDataStore` SPI, but a WKWebView's data
store is not Safari's, so a green result there would be evidence about your harness, not about
Safari. **Wait the eight days, once.**

**What *is* automatable is the half the ledger actually banks.** Both `tunes` entries are about the
app's *reaction* to eviction, not about whether eviction happens. CDP's Storage domain has
[`Storage.clearDataForOrigin`](https://chromedevtools.github.io/devtools-protocol/tot/Storage/)
(and `clearDataForStorageKey`, `overrideQuotaForOrigin`, `getUsageAndQuota`). Wiping the origin
under a live page is, from the app's point of view, indistinguishable from an ITP sweep.
`offline.spec.ts` is already Chromium-only with an honest comment about why, and already stubs
`navigator.storage` via `addInitScript` — the machinery is there.

Today this can assert "the app notices its cached pages are gone and does something sane rather
than rendering a broken page" (the runbook's last `reading` line, which applies "whichever bucket
it happened in"). When pin-a-juz lands in Loop 6b, the same test grows the re-pin assertion with
no new infrastructure.

**Residue:** the calendar. Does Safari's tab bucket actually lose the pack at day 8, and does the
installed bucket actually survive. One 8-day observation, once, confirming a premise rather than
finding a bug.

### 3.4 `kfgqpc-terms-primary-source` — automate "has it moved", never "is it still true"

**Reachability first.** The research reproduced the ledger's finding and it is worse than
recorded: `qurancomplex.gov.sa` resolves (to `66.9.131.70`) but **times out** on
`https://qurancomplex.gov.sa/en/` from this machine, with a browser UA and without, and
`fonts.qurancomplex.gov.sa` and `/en/techquran/dev/` fail identically. `web.archive.org` is not
fetchable from the agent tooling either.

But that is a fact about *this* egress, not about all egress. **A GitHub-hosted runner has
completely different egress** and may well reach a site that geo-fences or cloud-blocks. That is a
two-minute experiment (`curl -sS -o /dev/null -w '%{http_code}'` in a throwaway workflow) and it
decides whether the rest of this is worth building. Do not skip it and do not assume the answer.

**If reachable**, the automatable half is real: fetch the terms page on a schedule, strip markup,
normalize whitespace, SHA-256 it, and fail (or open an issue) when the hash moves. That converts a
one-shot human glance into a *durable* claim — precisely what the ledger says human results should
become — and makes `staleAfterDays` honest for this check.

**The irreducible part is the third `reading` line**, and it is worth quoting because it explains
why no machine and no model may make this call: *"Overstating someone else's terms fails silently:
it reads as caution, so no reader ever files a bug about being told they have fewer rights than
they do."* A hash watcher can tell you the source moved. Only a reader can decide whether your
restatement is now stricter than the source. This project makes a licensing claim on the King Fahd
Complex's behalf, in two user-facing places, and an LLM's reading of a legal page is not an
acceptable basis for that claim.

**One automatable thing that needs no reachability at all, and should be built regardless:** a gate
asserting that `SOURCES.md` §hafs-kfqc and `apps/web/src/components/Colophon.tsx` state the *same*
restriction, and that neither contains «غير التجاري» for the hafs-kfqc row. The ledger records that
this exact string was wrong once and shipped. Two copies of one claim, drifting independently, with
nothing checking they agree — that is a gate-shaped hole, and it is cheap.

### 3.5 `perf-verdict-on-device` — automatable on real Android, not on real iOS

**Loop 1's objection, restated exactly.** `docs/decisions/loop-1.md` and
`perf/pan-zoom-trace.mjs`'s own header say the emulated number (~8.3 ms/frame, flat at 4× and 6×
CPU throttle) is untrustworthy because the harness **writes `style.transform` in a loop**. It
therefore never pays for (a) touch dispatch, (b) hit-testing hundreds of polygons, (c) the
compositor's decision to re-raster a scaled layer, and separately never sees (d) initial raster of
a ~170 KB inline SVG on low-end silicon. That is an objection to a *synthetic transform sweep*,
not to automation.

**Two things now close (a)–(c) without touching the judgement:**

1. CDP's Input domain has
   [`Input.synthesizePinchGesture`, `synthesizeScrollGesture`, `synthesizeTapGesture`](https://chromedevtools.github.io/devtools-protocol/tot/Input/)
   — experimental, with a `gestureSourceType` parameter, and `dispatchTouchEvent` accepts an array
   of touch points for genuine multi-touch. These drive the browser's actual gesture pipeline:
   real touch dispatch, real hit test, real compositor pinch. Not a transform write.
2. [`playwright._android`](https://playwright.dev/docs/api/class-android) connects over adb to
   **Chrome on a real Android device** — real GPU, real DPR, real memory bandwidth, real thermal
   behaviour, real backing-store limits. That is not emulation at all. (Caveats: experimental; adb
   required, raw USB unsupported; "Stay awake" developer mode recommended.) Note `AndroidInput` is
   single-point only — `tap`/`drag`/`swipe`/`press`/`type`, **no pinch** — which is exactly why the
   CDP session, not `AndroidInput`, is the mechanism.

Objection (d) — first raster on low-end hardware — is closed only by the real device, never by
desktop emulation, because CPU throttling models neither GPU raster nor memory bandwidth. So:
**real Android, automated. Desktop emulation stays a regression tripwire and never a decider,
exactly as `pan-zoom-trace.mjs`'s header already says.**

**A finding that improves the manual check too.** `probe.ts` samples frame deltas with
`requestAnimationFrame`, which ticks on the **main thread**. Pinch-zoom re-raster happens on the
compositor and raster threads. A clean main-thread rAF trace is therefore compatible with the
compositor dropping frames and showing blurry tiles — *the exact risk this check exists to
measure*. The probe may understate it. `Tracing.start` with the frame/viz categories gives
presented-frame data instead. **This matters even if nothing is automated**: when running
`make phone-perf` by hand, trust your eyes on the re-sharpen moment at least as much as the p95.

**iOS: the residue is structural.**
[BrowserStack was first to enable Playwright on real iOS devices with Safari](https://www.prnewswire.com/in/news-releases/browserstack-becomes-the-first-platform-to-enable-playwright-testing-on-real-ios-devices-with-safari-302480159.html)
(June 2025), iPhone SE (2020) through 15 Pro Max, Safari 11–26. But their own guide states the
local constraint plainly: you cannot run Playwright directly against Mobile Safari on a connected
iPhone; Playwright can only launch its own WebKit. And in the cloud you get WebKit remote
automation — **no CDP, therefore no `synthesizePinchGesture`, and Playwright's `page.touchscreen`
is single-point**. So the pinch segment, which is the segment the verdict turns on, cannot be
automated on real iOS at any price. The standalone-vs-Home-Screen comparison is also outside every
web-automation surface — adding to the Home Screen is a Safari UI action.

**Costs.** Own Android phone + adb: $0, ~2 min/run.
[BrowserStack](https://www.browserstack.com/pricing?product=automate) Desktop & Mobile $175/mo,
Pro $225/mo (annual); Sauce Labs $39–149/mo base plus per-minute; AWS Device Farm ~$0.17/device-min
and [weaker for Playwright — it is Appium-oriented](https://softwaretestpilot.com/blog/automation-testing/playwright-cloud-testing).
Paying ~$2k/yr to a device cloud buys the two segments that were already going to pass, not the one
that decides. See §7.

### 3.6 `edge-spot-audit` — not automatable, and the automation should not try

The ledger says it best: *"Every automated gate here proves the shards are well-formed; none can
prove an edge is true."* The standard is not "are these similar" but "would a hafiz confuse these
two while reciting". There is no corpus, model, or heuristic that answers that. This check stays
human, permanently.

**What can be automated is the *informativeness* of each round**, and the return is real, because
the ledger's own `reading` says a *class* of wrong edge is worth more than twenty rejections:

- **Stratify the draw.** `sample-edges.mjs` flattens every directed edge and draws uniformly —
  deliberately, so surah 2 does not swamp surah 108. But uniform-over-edges still means a round can
  miss whole error *classes*. Stratifying by `type`, by dPage bucket, by same-juz vs cross-juz, and
  by **provenance** (dataset entry vs curated seed vs generated symmetric reverse —
  `build-adjacency.mjs` distinguishes all three, and generated reverses drop word anchors, so they
  are a distinct risk class) makes twenty edges cover the space instead of sampling it.
- **A similarity score, from data already shipped.**
  `packages/etl/data/roots/quranic-corpus-morphology-0.4.txt` carries per-token FORM, LEM and ROOT
  for all 6236 ayahs. A root- or lemma-sequence similarity (LCS over root tokens) can be computed
  with **no new vendored source and no new licence question**, and printed beside each pair. It
  does not judge anything. It tells the reader which pairs the data itself thinks are marginal, and
  lets a whole low-similarity cohort be surfaced for one targeted round.
- **Coverage accounting.** Print, in `make validate`, what fraction of shipped edges has ever been
  looked at, by type. Today `verified-edges.json` holds three entries, all
  `verifiedBy: "curated-mock"`, none a hafiz sign-off. A number makes that visible.

**What must not be built: an LLM verdict on edge truth.** It would write `verdict: "correct"` into
a file whose entire purpose is "a human actually looked at this", and `gate:verified-edges` would
then enforce a guess forever, in both directions, against future data refreshes. If a model is used
at all it is for triage *ordering* only, never as a value in `verdict`, and `verifiedBy` must never
carry a model name.

---

## 4. The report artifact

The repo already has the right shape: `docs/validation/ledger.json` is the one source, rendered
three ways (`gate-validation.mjs` → terminal, `build-validation-guide.mjs` → `guide.html` on the
phone, the `validate` skill → drives a session), with pictures generated by `make shots` and a gate
that fails on a `shot` with no file behind it. The skill states the rule explicitly: *"Never
restate a check's steps … a runbook that exists in two places drifts, and a drifted runbook fails
silently because it still looks authoritative."*

**So the report must not be a fourth artifact.** A separate "test report" generator would be
exactly the thing this architecture exists to prevent. The right move: **automation attaches
*evidence* to a check; the existing renderers grow one section each.**

Proposed shape:

- **One new optional field per check** in `ledger.json`:

  ```jsonc
  "evidence": {
    "run":      "make <target>",                      // how to produce it
    "produces": "docs/validation/evidence/<id>.json", // where it lands
    "covers":   ["step-1", "step-2", "step-4"],       // which runbook steps it discharges
    "residue":  ["step-3: phrasing", "step-8: eyes closed"]  // what it cannot
  }
  ```

- **One new writer:** `make validate-auto` runs every check's `evidence.run`. Each writes a
  normalized JSON — device/UA, build commit, timestamp, per-assertion pass/fail, raw numbers. Same
  discipline as `make shots`: produced by the real harness, never hand-written.
- **The three renderers grow one section each, from that same source.** `make validate` prints
  `automated: 6/8 assertions green · run 2026-07-27 on Pixel 6a · 2 steps still human`.
  `guide.html` renders the same badge on the card and — the load-bearing bit — **strikes through
  the runbook steps that `covers` names**, so the person holding the phone walks only what the
  machine could not. The skill's session flow gains one step: `make validate-auto` before
  `make guide`.
- **One new gate rule, and it is the important one:** a check with `evidence` **must** declare
  non-empty `residue`, and every id in `covers` must exist in `runbook.steps`. This blocks the new
  failure mode the proposal introduces — an automated run quietly claiming to have done the human's
  job. Same shape as the existing rule that a check tuning nothing is a check you are paying for
  and not banking.

**The "final report you review" is then `make validate` plus `docs/validation/guide.html`** — same
two surfaces, same one source, now with green/red evidence badges and a visibly shorter human
checklist. Nothing new to drift.

---

## 5. Emulation vs real device — the Loop 1 judgement stands

Loop 1 concluded that ~8.3 ms/frame, flat at 4× and 6× CPU throttle, was a measurement of the wrong
thing. That conclusion is correct and remains correct. But read carefully, it is an objection to a
*synthetic transform sweep on desktop Chromium*, decomposable into four claims: no touch dispatch,
no hit-testing, no compositor re-raster decision, no real first-raster cost.
`Input.synthesizePinchGesture` fixes the first three by going through the browser's real gesture
pipeline. **Nothing fixes the fourth on desktop** — which is exactly why Loop 1 was right, and why
"just add synthesized gestures to `pan-zoom-trace.mjs` and call it done" would be the wrong reading
of this report.

Hence: **real silicon, automated.** `playwright._android` over adb is not emulation — it is your
actual phone, driven from the laptop instead of by your fingers. It removes the friction that
`probe.ts`'s header identifies as the reason this check sat open for six loops, without removing
the hardware that makes the number mean anything. Emulated `pan-zoom-trace.mjs` keeps its
documented role: *"Use it to catch regressions, never to decide."*

Two honest caveats on the automated route:

- **A synthesized pinch is not your fingers.** It is a repeatable approximation with a fixed
  `scaleFactor` and `relativeSpeed`. It will not reproduce the ragged, variable-velocity pinch that
  pushes hardest past the backing store. So it is a *regression instrument on real hardware* — it
  does not retire the hand-driven `make phone-perf` capture for the one-time architecture verdict.
  It makes that verdict re-checkable afterwards, which has never existed.
- **rAF understates compositor jank** (§3.5). Any automated version should read presented-frame data
  from a CDP trace rather than only re-running the main-thread sampler — a reason to build it, since
  it measures something the manual probe structurally cannot.

---

## 6. Recommended implementation order

Cheapest-highest-value first. Proposals, not patches.

**① Aria-snapshot the hop tour — ~1h, $0, highest value per minute.**
`apps/web/e2e/share-a11y.spec.ts` + committed snapshots under `apps/web/e2e/__aria__/`.
`toMatchAriaSnapshot` on the chrome, the page group, the rail, the open popover, and the trail — on
both `iphone` and `android`. No new dependency. Pins every string the `screen-reader-walkthrough`
runbook lists under `expect`, forever, and delivers the ledger's first `tunes` line before the check
is run. Shrinks that runbook from 8 steps to 3.

**② `source-offer-resolves` → a gate — ✅ done, 2026-07-28.**
`scripts/check-source-offer.mjs`, `make source-offer [URL=…]`, and a `public-deploy` workflow
(`workflow_dispatch`). It follows the offer anonymously — no `gh`, no token — because signed in as
ourselves a private repo looks public, which is the exact failure the manual runbook opens a private
window to avoid. With `URL=<deployed>` it fetches the deployed page, follows its module scripts, and
reads `SOURCE_REPO` and the build's 40-hex commit straight out of the bundle, so it checks what a
reader is actually handed rather than what this branch declares.

Three deviations from the proposal, each deliberate:

- **`check-` not `gate-`.** Every `scripts/gate-*.mjs` runs on every commit via `pnpm gates`. This
  one reaches the public internet and must not, so it does not carry a name that says it does.
- **`colophon.spec.ts` was left alone.** Teaching it to follow links would put github.com on the
  critical path of `make e2e` and of CI's e2e job — the same trap that cancelled ⑦, and the reverse
  of the commit that stopped unit tests reaching the real network. The spec keeps asserting the
  offer's *shape*; the network half lives in the checker, where a flaky host is a `COULD NOT TELL`
  rather than a red build.
- **`workflow_dispatch`, not a schedule.** The check is red today, correctly: the repository is
  private, so the offer 404s anonymously. A scheduled job announcing a known-pending decision
  (task #53) every morning is noise.

The result is that the pending human check now has a machine half that runs in seconds, and #53
stopped being a note in a task list: `make source-offer` says, in words, that the site must not be
published yet and what the two fixes are. The half that still needs a person — that a reader can
*reach* the offer from inside the running app, on a device — stays in the ledger, with the checker
wired into its `setup` so it is answered before anyone picks up a phone.

**③ Licence-copy drift gate — ✅ done, 2026-07-27.**
`scripts/gate-license-copy.mjs`, wired into `pnpm gates`, `make ci`, CI, and the pre-commit hook
(scoped to commits touching either file). Built one step stronger than designed: rather than
comparing two independently-authored statements and hoping they say the same thing, each
`SOURCES.md` entry now *declares* the reader-facing row in a ` ```colophon ` fence and the gate
asserts `Colophon.tsx` renders exactly that set — same strings, same links, no extras, both
directions. The colophon stops being a parallel account of the licence and becomes a renderer of
the record, which is the same move as the ledger and the map. The «غير التجاري» check survives on
top of it, for the case exact-matching cannot catch: both files edited to the same wrong claim.
A source the app should not credit must say `not-credited: <reason>` — silence reads identically
to an oversight. Verified by inducing all five failures and reverting, including a deliberately
broken parser, which fails loudly rather than matching nothing against nothing.

**④ Eviction-detection e2e — ✅ done, 2026-07-27. Found two real defects.**
The design held: `Storage.clearDataForOrigin` over CDP takes the origin's caches out from under a
live page, and the app cannot tell that from an ITP sweep. What did not hold was the assumption
underneath it — that the app already survived eviction and only needed its reaction asserted. It
did not survive at all. Both tests were red when written; both are green now, and both were
confirmed to fail again with their fix reverted.

*Probed first, asserted second.* The design said "assert the app notices its cached pages are gone
and does something sane". Before writing that, a throwaway spec asked what the app actually does.
Neither answer was the expected one, which is the entire argument for probing before asserting:
a test written to the design would have encoded a recovery that did not exist.

1. **Eviction was permanent.** Workbox fills the precache in the service worker's `install`
   handler. Eviction takes the bytes and leaves the registration, so the worker never installs
   again and the shell never comes back. The *runtime* caches (pages, data) refill on demand, so
   every online signal says the app is healthy — and the next offline launch is the browser's own
   `ERR_FAILED` page, because `index.html` is gone and there is nothing to boot from. One sweep
   ended offline support permanently, until a deploy happened to ship new `sw.js` bytes. On an
   uninstalled iOS origin that sweep arrives on a 7-day timer, so this was the *default* outcome,
   with Loop 6a's promise silently false and nothing anywhere going red.

   Getting out of it took four measurements. Three reloads left the precache empty. An explicit
   `registration.update()` did nothing — identical `sw.js` bytes mean no new worker, so no
   `install`, so no precache. `unregister()` followed by `register()` in the same page brought the
   registration straight back as `activated` with `installing` never set: the old worker was still
   controlling this client, so unregistration only takes effect once that client goes away, and
   re-registering the same script URL resurrects it. The obvious next move — `unregister()` then
   `location.reload()`, so the reload drops the last client — shipped, and turned out to be **a
   coin flip**: the removal and the reloaded page's own `register()` race, and `register()` winning
   clears the uninstalling flag and hands back the same already-activated worker. No `install`, no
   precache, no controller. Ten repeats of the eviction e2e on one machine: five dead in exactly
   that state, which is why the test read as flaky rather than as the product defect it was.

   A URL the registration has never registered is not a race. `repairShellCache()` in
   `apps/web/src/pwa.ts` re-registers the *same* `sw.js` — same bytes, same precache manifest, same
   cache name — under a `?shell-repair=1` suffix, which makes `register()` mean *install* instead
   of *acknowledge*. The install refills the shared precache, and the worker still controlling the
   page reads it, so nothing has to be unregistered and the new worker never has to activate. It
   then waits for that install to *finish* before doing anything else: workbox writes the entries
   one at a time, `index.html` first and the app's scripts last, so a repair that stops when the
   shell reappears leaves an app that boots offline to a blank page — a worse failure than the
   empty cache, because it looks like a working app that lost its contents. Only then does it
   reload once per tab, to bring the runtime caches back too. All of it only when the shell is
   actually missing and only when online (there is nothing to refill from otherwise). The integrity
   check is `caches.match("index.html", {ignoreSearch:true})` — behavioural ("can I still boot
   offline?") rather than structural, so a workbox version bump does not read as an eviction.

2. **The app claimed a page it was not showing.** Offline with an evicted cache is how a
   *vendored* page fails to fetch, which is the one case that slips past App's resolver gate.
   `PageStage`'s `navigateTo`/`showPage` bailed silently on a failed mount (`if (!mp) return`)
   while the chrome and the live region had already committed to the new number. Probed: header
   `١٩`, stage still `page-label-7`, and «فُتح رابط · صفحة ١٩» announced aloud. A hafiz mid-review
   would be told they are on 19 while looking at 7, and a screen-reader user would have nothing on
   screen to contradict it. Both entry points now set the error status, and the banner names the
   page it failed on.

The eight-day wait still belongs to a human, but it is now only about the one thing no harness can
supply: whether iOS really sweeps an uninstalled origin at ~7 days and spares an installed one.
Everything downstream of "the sweep happened" is asserted in `Hifth · eviction`, and the re-pin
assertion slot is still there for Loop 6b.

**⑤ KFGQPC reachability probe — ✅ done, 2026-07-27. Answer: unreachable.**
The throwaway job ran on a GitHub runner (Azure westus2, run
[30285643491](https://github.com/omars-lab/hifth/actions/runs/30285643491)) and got the same
result as the maintainer's machine: DNS resolves to `66.9.131.70`, TCP 443 times out
(`connect: FAILED rc=124`), and `curl` returns `000` under both a curl and a desktop-Chrome
User-Agent. Two unrelated networks failing at the *TCP* layer is not a bot filter that a header
could talk its way past — the packets do not arrive. Recorded in the ledger's `how` and `needs`
for `kfgqpc-terms-primary-source`, and the probe deleted as designed. **This kills ⑦.**

**⑥ Automated on-device perf, real Android — ⏸ not building it yet. No Android device (2026-07-28).**
The design still stands and the API half was re-confirmed: `playwright._android.devices()` exists in
the pinned playwright 1.61.1, so `device-trace.mjs` would be `_android` over adb →
`device.launchBrowser()` → CDP session → `Tracing.start` with frame categories →
`synthesizeScrollGesture` / `synthesizePinchGesture` / `synthesizeTapGesture` in three segments
matching `probe.ts`'s `SEGMENTS`, emitting the **same JSON shape** so it drops straight into the
ledger, behind `make phone-perf-auto SERIAL=<adb-serial>`. Then tune `pan-zoom-trace.mjs`'s asserted
budget to the real number.

What is missing is not code. It is the two things the design assumes and cannot supply: an Android
phone with USB debugging, and `adb` (no Android platform-tools on the maintainer's machine).

Writing it anyway was considered and rejected for ⑦'s reason, which applies here word for word: an
`apps/web/perf/device-trace.mjs` and a `make phone-perf-auto` that have never once executed against
real hardware would put a *covered-looking* check in front of the one measurement the rendering
architecture actually turns on. Every failure mode of this script — whether the synthesized gestures
land on the stage, whether the trace carries the frame events, whether the segment boundaries line
up with `probe.ts` — is invisible until it runs on a device. A harness verified only against its own
author's expectations is not a check; it is a claim.

So the hand-driven `make phone-perf` remains the whole story: `probe.ts` measures the phone from
inside the phone, needs no cable and no DevTools, and works on iOS too — which the adb route never
will. Build ⑥ the day there is a device to point it at; the design above is the whole of what is
owed, and the blocker is hardware, not thinking.

**⑦ KFGQPC terms watcher — ❌ not building it. ⑤ came back unreachable.**
The design was `scripts/watch-kfgqpc-terms.mjs` + a scheduled workflow: normalize, SHA-256, open an
issue on drift, never auto-edit `SOURCES.md`. It cannot fetch the page it exists to watch. Building
it anyway would produce a scheduled job that fails every night, which decays into a muted
notification — and a muted watcher is worse than none, because the check it was standing in for
now *looks* covered. The honest outcome is the one now in the ledger: a human check, permanently,
with the measurement that proves why written beside it. Revisit only if the host ever answers from
a runner — which is a two-minute probe to re-establish, not a standing job.

**⑧ Edge-audit sampler upgrade — ✅ done, 2026-07-28. Built one thing that was not designed.**
`packages/etl/scripts/sample-edges.mjs` now stratifies by type × provenance × page-distance band,
prints a longest-shared-word-run and an in-order shared-root count per pair, and `make validate`
ends in a coverage table. `verdict` semantics and `gate-verified-edges.mjs` are untouched, as
designed.

The undesigned part is the unit. The corpus is bidirectional — `build-adjacency.mjs` generates b→a
from every a→b — so a draw over directed edges asks the same reader the same question twice, and it
did: the first stratified draw came back with three reciprocal duplicates in twenty rows. Human
minutes with a mushaf open are the scarcest input this project has. The draw now dedupes to
unordered pairs, presents each in reading order, and writes *both* directions into the paste block,
so one reading banks two entries. That also moved the denominator everywhere: 3002 directed edges
are 1501 pairs, and the coverage table counts the same unit the draw does.

Stratification mattered more than expected once the pair counts were in front of us. 97% of the
pairs are one class (dataset `mutashabih`, and two thirds of those more than fifty pages apart);
`shared-root` is 3 pairs and `related-meaning` is 1. A flat draw of twenty essentially never shows
either — and those are precisely the classes no automated check reaches, since `gate:edges`
deliberately does not score `shared-root` and the curated pairs are ones we wrote ourselves.
Round-robin was the obvious construction and was wrong for the same reason: six of the eleven
classes are curated, holding eleven pairs between them, so repeated rounds handed 55% of the audit
to 0.7% of the corpus. The draw takes one pair from each class rarest-first, then fills uniformly.
`--uniform` restores the flat draw for when the *rate* is the question — though `gate:edges` already
carries the rate, on every commit.

The similarity scores come from a new `packages/etl/scripts/morphology.mjs`, extracted from
`gate-edges.mjs` rather than reimplemented. Two readers of one format drift; here the drift would
have been *contradictory* rather than merely silent — a reader auditing a pair would see one score
printed beside it while CI enforced a floor computed a different way, and on the first disagreement
the human would be the one assumed wrong. Roots are read from the shipped `assets/roots/**` shards
instead, because `build-roots.mjs` already parses `ROOT:` and a second parser of it is the same
mistake in the other direction.

**⑨ The `evidence` field and `make validate-auto` — ~half a day.**
Last, deliberately: build it once there are three or four real evidence producers to render, so the
schema is designed against actual output rather than guessed.

---

## 7. Explicitly not worth automating

1. **Guidepup / macOS VoiceOver as a CI gate.** Worth one exploratory run. Not worth a gate: it
   needs a real macOS session with accessibility permissions granted and VoiceOver's first-run
   dialog suppressed, it is a known source of flake, and macOS VoiceOver is not iOS VoiceOver. ①
   gets most of the signal for a fraction of the cost, on both target engines.
2. **TalkBack utterance capture in CI.** The only public reference implementation is a prototype
   whose own README documents dropped utterances. Its failure mode is a *silently missing*
   announcement — precisely the defect the check exists to find.
3. **The eight-day wait.** No supported fast-forward exists. Wait it, once, and let ④ carry the
   code-tuning half meanwhile.
4. **Device-cloud minutes for the perf verdict.** On iOS there is no CDP and no multi-touch, so no
   pinch — the only segment the verdict turns on. $175–225/mo to automate the two segments that were
   already expected to pass is the wrong trade. Revisit if Playwright's iOS path grows multi-touch.
5. **The standalone-vs-Home-Screen comparison.** Adding a site to the Home Screen is Safari UI,
   outside every web-automation surface, on device and in every cloud. The JSON already stamps
   `standalone`, which is the right design.
6. **Any model-generated verdict on whether two ayahs are mutashabihat.** Non-negotiable. It would
   launder a guess into a permanent bidirectional gate, in the one file whose value is that a human
   actually looked.
7. **"Is our licence summary stricter than the source?"** A hash watcher can say the source moved.
   Only a reader decides whether a restatement made on a third party's behalf is now wrong — and
   the ledger already documents that this failure is invisible from the outside.
8. **"Does this phrase sound like something a person would say", and the eyes-closed tour.** Steps 3
   and 8 of the screen-reader runbook are not obstacles to automation. They are the check.
9. **A standalone test-report generator.** The fourth renderer is the failure mode this repo's
   one-source/three-renderers architecture was built to prevent. Evidence attaches to the ledger;
   the existing renderers grow a section.

---

## Sources

- [WebKit — Tracking Prevention](https://webkit.org/tracking-prevention/) ·
  [Apple Developer Forums — Safari iOS PWA data persistence beyond 7 days](https://developer.apple.com/forums/thread/710157) ·
  [Simo Ahava — ITP Debug Mode in Safari](https://www.simoahava.com/privacy/itp-debug-mode-in-safari/)
- [Chrome DevTools Protocol — Input domain](https://chromedevtools.github.io/devtools-protocol/tot/Input/) ·
  [Storage domain](https://chromedevtools.github.io/devtools-protocol/tot/Storage/) ·
  [Remote debug Android devices](https://developer.chrome.com/docs/devtools/remote-debugging)
- [Playwright — Android (experimental)](https://playwright.dev/docs/api/class-android) ·
  [AndroidInput](https://playwright.dev/docs/api/class-androidinput) ·
  [Aria snapshots](https://playwright.dev/docs/aria-snapshots) ·
  [Clock](https://playwright.dev/docs/clock)
- [BrowserStack — first Playwright testing on real iOS devices with Safari](https://www.prnewswire.com/in/news-releases/browserstack-becomes-the-first-platform-to-enable-playwright-testing-on-real-ios-devices-with-safari-302480159.html) ·
  [Playwright iOS automation guide](https://www.browserstack.com/guide/playwright-ios-automation) ·
  [Automate pricing](https://www.browserstack.com/pricing?product=automate) ·
  [Playwright cloud testing comparison](https://softwaretestpilot.com/blog/automation-testing/playwright-cloud-testing)
- [Guidepup](https://github.com/guidepup/guidepup) ·
  [guidepup-playwright](https://github.com/guidepup/guidepup-playwright) ·
  [bocoup/aria-at-talkback-capture](https://github.com/bocoup/aria-at-talkback-capture) ·
  [Assistiv Labs — automating screen readers](https://assistivlabs.com/articles/automating-screen-readers-for-accessibility-testing) ·
  [LambdaTest iOS VoiceOver on real devices](https://www.globenewswire.com/news-release/2025/02/27/3034039/0/en/lambdatest-introduces-ios-voiceover-testing-on-real-devices-elevating-mobile-accessibility.html) ·
  [Android — test your app's accessibility](https://developer.android.com/guide/topics/ui/accessibility/testing)
