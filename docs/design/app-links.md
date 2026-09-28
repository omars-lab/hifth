# Links into the app: what opens today, what is missing, and one list for the guide and the tests

**Status:** proposal, 2026-09-28. Nothing here is built yet.

**What is being decided:** which parts of the app a link can open, in what shape, and
where the one list of those links lives, so the checks guide and the automated tests use the
same list.

**What it changes for a hafiz:** a teacher can send a student a link that opens on the right
page *with the right tool already in hand* (the look-alike list open on a verse, the word tool
ready), instead of a link plus three sentences of "then tap here". For the owner running a
check on a phone, each step can say "open this, look for that" and be one tap away.

**Why now:** the owner asked for guide steps of the form "visit this link, look for this".
Today most steps cannot have one, and the tests re-click their way into the same states over
and over (counts below).

**If nobody decides:** the guide keeps prose-only steps, and every new test adds more clicks
to reach a state a link could have opened in one line.

## Words used here

- **Link** — an address that opens the app somewhere specific. The part after `#` picks the
  place; the `?key=value` pairs after it pick how it is shown.
- **Refuses** — a link with a bad value is treated as no link at all: the app opens where it
  would have opened anyway, and says nothing.
- **Falls back** — a bad value is ignored and the default is used; the rest of the link still
  works.
- **Live site** — https://blog.bytesofpurpose.com/hifth/ . **This laptop** — the dev server,
  http://localhost:5173/ after `make dev`. Tests use their own copies on ports 4173 (the normal
  build) and 4273 (the private demo build).

## What can a link open today?

Everything below is read by the router (`packages/core/src/router.ts`, rules written down in
`docs/query-params.md`) when the app opens and on back/forward.

| Opens | Example (after the site address) | Bad value |
| --- | --- | --- |
| A verse, selected, on its page | `#/hafs-kfqc/2:255` | refuses |
| A run of verses | `#/hafs-kfqc/2:47-2:48` | refuses |
| Some words of a verse | `#/hafs-kfqc/2:255?w=3-7` | refuses |
| A bare page, nothing selected | `#/hafs-kfqc/p7` | refuses |
| The tajweed colours | `#/hafs-kfqc/2:255?skin=tajweed` | refuses |
| A page colour (tan, dark) | `#/hafs-kfqc/p7?field=tan` | falls back |
| "Came here from" a look-alike | `#/hafs-kfqc/2:122?via=2:48` | refuses |
| The trail of hops behind you | `#/hafs-kfqc/2:122?trail=2:40,2:47&via=2:48` | refuses |
| The phone's bottom bar layout (before the `#`) | `?phonebar=a#/hafs-kfqc/p7` | falls back to c |

So the same verse link is, live and local:

- https://blog.bytesofpurpose.com/hifth/#/hafs-kfqc/2:255
- http://localhost:5173/#/hafs-kfqc/2:255

Three things are deliberately **not** links: the smoothness probe and the private demo build
are switched on when the app is built, not by an address (a link could otherwise turn a
measuring bar on over someone's mus'haf — the reason is written in `apps/web/src/main.tsx`);
the chrome language and the "seen this tip" marks are kept in the browser's storage.

## Where do people and tests have to click their way in instead?

### The tests

The browser tests open the app about 190 times. 71 open the bare site, 65 a bare page, 32 a verse,
and only a handful use a parameter (4 ranges, 3 `via`, 3 `trail`, 1 `field`, 2 `phonebar`).
Then they click. Grouped by the state they are clicking toward:

| State reached by clicking | Lines | Files | Example |
| --- | --- | --- | --- |
| A tool picked (word, slip, note, sign, select, crop...) | 31 | 6+ | `notes.spec.ts:23`, `crop.spec.ts:15` |
| The jump box (press `/`) | 32 | 5 | `contrast.spec.ts:142` |
| The About panel | 22 | 6 | `contrast.spec.ts:169` |
| The verse drawer (a verse's tools) | 16 | 5 | `mistakes.spec.ts:19` |
| Tips already seen (set in storage first) | 16 | 7 | `contrast.spec.ts:4` |
| The revision record | 13 | 6 | `bookmarks.spec.ts:22` |
| The look-alike list | 8 | 2 | `desktop.spec.ts:1588` |
| The offline shelf | 8 | 1 | `offline.spec.ts:268` |
| The tajweed colour key | 6 | 2 | `contrast.spec.ts:178` |
| The mus'haf (edition) picker | 6 | 2 | `contrast.spec.ts:159` |
| Language switched | 6 | 2 | `desktop.spec.ts:1477` |
| Tips open | 6 | 3 | |
| Page bar showing juz | 5 | 3 | `desktop.spec.ts:711` |
| One page or two side by side | — | 2 | `stage-fit.spec.ts` |
| Magnified (wheel or pinch) | 70 | 4 | `page-turn.spec.ts:392` |

Tool picks break down as: word 5 keys, slip 5, select 2, note 2, sign 2, highlight 2, read 1,
bookmark 1, plus 11 clicks through the "Page tools" menu.

### The owner's checks

| Check, step | Needs | Link today? |
| --- | --- | --- |
| Smoothness on a phone, step 1 | the probe build | no — built on purpose, stays that way |
| Screen reader round, step 2 | a verse's look-alike list open | no — a verse link selects the verse only |
| 20 look-alike pairs, step 4 | the pair on screen | **yes** — `#/hafs-kfqc/2:122?via=2:48` |
| 8 days offline, steps 1–2 | the offline shelf, juz 1 | no |
| Two days of revision, step 1 | the revision record open | no |
| The three box-placing sittings | their own local pages, not the app | not an app link |
| Outside sources licences | outside websites | not an app link |

## What should each missing link look like?

Same grammar as today: a place after `#`, then one key per concern. A tool or panel that
cannot be shown at that place **falls back** (the app still opens on the verse), because a
teacher's link should never land on nothing just because the student's screen is narrower.
A value that is simply not a word we know also falls back. That keeps "refuses" for the place
itself, where it already lives.

Ranked by how many test lines and guide steps each would replace:

| # | Link | Opens | Serves |
| --- | --- | --- | --- |
| 1 | `?open=jump\|about\|record\|key\|editions\|tips\|shelf` — **built 2026-09-28** | one panel open on arrival | 93 test lines in at least 6 files; 2 guide steps (record, shelf) |
| 2 | `?tool=read\|select\|highlight\|bookmark\|note\|sign\|word\|slip\|crop` | that tool in hand | 31 test lines in at least 6 files |
| 3 | `?open=lookalikes\|roots` (needs a verse in the place) — **built 2026-09-28**, as two more values of `open` rather than a new `sheet` key: one key for "what is open on arrival". The verse's drawer needed nothing, since a verse link already raises it | the selected verse's look-alike list or roots | 24 lines in 5+ files; the screen reader step |
| 4 | `?view=one\|two` and `?bar=page\|juz` | page layout and page-bar scale | 5+ lines in 4 files |
| 5 | `?lang=en\|ar` | the chrome language for this visit only, not saved | 6 lines in 2 files |

Notes on each:

- **`open`** takes one value: two panels open at once is not a state the app has. `open=shelf`
  with `#/hafs-kfqc/p1` shows juz 1's row, which is what the offline check asks for.
- **`tool`** names match the buttons, and "mistake" is spelled `slip`, the word the reader sees.
- **`sheet`** is separate from `open` because it belongs to a verse; without a verse it falls
  back to nothing.
- **`lang`** must not overwrite the saved choice, or opening a test link would silently change
  a reader's language for good.
- **Tips already seen** stays a test setup step, not a link: it is about the device, not the
  place.

**What should never get a link:**

- anything halfway through a gesture — mid-drag, mid-pinch, a page half turned;
- a magnification level (it depends on the screen; a link would open differently everywhere);
- half-filled forms, and anything that deletes (clear all notes, empty the shelf);
- the probe and the private demo (built, not linked, as above);
- anything held — a link never carries note text or commentary in its address.

## How do the guide and the tests share one list?

One file, `docs/links.json`, hand-edited like the other registers. One entry per named link:

```json
{ "verse-lookalikes": {
    "path": "#/hafs-kfqc/2:48?open=lookalikes",
    "opens": "Verse 2:48 selected, its look-alike list open",
    "lookFor": "A list titled with the verse, each row a verse that reads like it" } }
```

- **The guide** prints each step's link twice — live site and this laptop — by joining the
  two addresses above with `path`, and prints `lookFor` under it.
- **The tests** call `gotoLink(page, "verse-lookalikes")` instead of `page.goto(...)` plus
  clicks. If a link stops opening what it says, a test goes red, and the guide step that uses
  the same name was wrong at the same moment.
- **A step with no link yet** carries `"noLink": { "why": "...", "add": "?open=record" }`
  in its check, so the guide says in words why there is no link and what would add one — and
  the list of `add` values is this design's to-do list, counted.

## Do we need a Swagger (OpenAPI) spec of every link?

Everything after `#` never reaches a server. OpenAPI describes requests a server answers, so
our link forms would all be squeezed into one fake "path" or written as made-up endpoints. What
the owner actually wants from it — every form written down once, with its keys, allowed
values, what a bad value does, and examples, checked against the code — does not need the
server part.

| | A. Full OpenAPI file | B. One list of link forms (JSON, with a JSON Schema) | C. Keep the prose page only |
| --- | --- | --- | --- |
| **Pros** | Familiar; tools draw a reference page for free | Says exactly what we have: place, keys, refuse or fall back, examples; the router's tests, the guide and the reference page all read it | No new file |
| **Cons** | Each `#` form becomes a pretend endpoint; "falls back" has no slot; tooling mostly unused | We write a small page renderer ourselves (short, like the other registers) | Its table is already checked against the link reader (every key read, written and documented, and whether a bad value refuses or falls back), but no examples are checked, and settings read outside the link reader — `phonebar` — slip past it |
| **Implications** | Two sources of truth unless the router is generated from it — a rewrite of working code | `docs/query-params.md` becomes a page rendered from it; `docs/links.json` names examples from it | The guide and tests would still need a list, so it becomes B later anyway |
| **How the hook keeps it in step** | Same round-trip check as B, plus a translation layer | See below | None possible |

**Recommendation: B** — one list of link forms, `docs/link-forms.json`, with a JSON Schema so
editors check its shape. It gives the owner the "every URL we support" page without pretending
the app has a server.

**What was built (2026-09-28): B, without the new file.** Once C's gaps were written down, they
turned out to be the only things B added: checked examples, and the setting read before the
`#`. So the existing parameter page, `docs/query-params.md`, became the one list: it gained an
Examples table (every key has at least one, and each is run through the app's own link reader)
and a Settings table (`phonebar`). The same parameter check that already ran on every commit now
checks both — checks 1 and 2 below, in `gate:params`, not a new `links-check`. A second file
would have been a second place to keep in step. Check 3 waits for `docs/links.json`, which comes
with the tests that open the app by name.

### How does it stay in step with the code?

The router stays the code that reads links; the list does not generate it (a working reader
rewritten from a file is more risk than the drift it prevents). Instead, a check in the
pre-commit hook, run locally like the others, `make links-check`:

1. **Every example round-trips.** Each example in the forms list is read by `parseHash` and
   written back by `serializeState`; it must come back the same, and a "refuses" example must
   actually be refused. A key the code changes without the list, fails.
2. **Every key the code reads is listed.** The check scans `apps/web/src` and
   `packages/core/src` for `URLSearchParams(...).get("...")` and the router's key table; a key
   read but not listed fails, and a key listed but never read fails.
3. **Every named link in `docs/links.json` opens.** Its path must parse, and every guide step's
   link name must exist. Whether it opens *the right thing* is the tests' job (above).

Checks 1–3 take well under a second, so they belong in the hook, not in CI.

## What else was considered?

- **Short names instead of a query** (`#/hafs-kfqc/2:48/lookalikes`). Reads nicely, but breaks the
  one-key-per-concern rule the router already has, and every new state would be a new place.
- **A test-only setup hook** (`window.__hifth.open("record")`). Fast for tests, useless for the
  guide and for teachers, and a second way into the same states.

## What would change the answer?

- If links are shared outside the app (teachers, messages), `lang` and `tool` might want to be
  saved rather than one-visit — that is a reader choice, not a test one.
- If a server ever answers these addresses (share previews), OpenAPI earns its place for that
  part.
- If the phone's bottom bar settles on one layout, `phonebar` goes away rather than joining the
  list.

## What this is not settling

The names of the panels on screen, which tools exist, or the private demo's own links. The
test-rewrite order is a backlog question: build link 1, move the tests that click into panels,
then the next.
