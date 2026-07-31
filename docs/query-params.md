# The link is the state — every parameter Hifth reads

A hafiz's session is a place in the mus'haf: a page, an ayah, the chain of
similar ayat they walked to get there. Hifth keeps all of it in the address bar
and nowhere else. There is no session store, no server, no account — the URL
*is* the app's state, which is why «share» is a one-line function
(`ShareSheet.tsx`) rather than a feature, and why a teacher's link opens on a
student's phone in exactly the view the teacher was looking at.

This file is the catalog. Adding a parameter without a row here fails
`gate:params`.

## Why the hash, and not `?` before it

Every parameter below lives *after* the `#`. That is not a React-Router habit;
it is the reason the whole design is defensible. **A fragment is never sent to
the server.** Type `?w=3-7` into the path and the span of an ayah a reader is
struggling with travels to the origin server, into its access log, into any CDN
in front of it, and into the `Referer` header of every outbound link. Put it
after the `#` and none of that happens — the browser keeps it. For an app whose
parameters describe *which verses a person is having trouble memorising*, that
distinction is the difference between a shareable link and a disclosed one.
[Cyphrme's URLFormJS notes the same rule in the general
case](https://github.com/Cyphrme/URLFormJS): prefer fragment query parameters
over query parameters when the values are at all sensitive.

The rest of the well-known advice for URL-as-state applies here unchanged and is
worth stating because it is what makes the parameters below *few*: the URL
carries state that describes the view and that a second person could usefully
receive — filters, selections, the current target — and not state that belongs to
one person's device.
[LogRocket's guide to URL state](https://blog.logrocket.com/url-state-usesearchparams/)
calls this shareable state, and it is exactly the line Hifth draws: the UI
language lives in `localStorage` (it is a property of the reader's phone, and a
link should not retune a stranger's chrome), the revision record lives in
IndexedDB (it is personal history, and it is never transmitted — see
`gate:revision-privacy`), and everything in the table below rides in the link.

Two more rules this app holds itself to:

- **One state, one spelling.** `serializeState` emits the keys in a fixed order,
  so a given view has exactly one URL. Links are then diffable, cacheable and
  comparable, and `parseHash(serializeState(s)) === s` is a test rather than a
  hope (`router.test.ts` sweeps every combination of the axes).
- **A key that is absent means the default.** No parameter is ever emitted at its
  default value. Ordinary links stay short, and a reader is never invited to
  think the default is part of the address.

## The path

The path names *what you are looking at*. It is not optional — a hash with no
path is not a link, and `parseHash` returns `null` for it (which the app reads as
"no deep link, open normally").

| Form | Means | Example |
| --- | --- | --- |
| `#/<edition>/<surah>:<ayah>` | Select and navigate to one ayah | `#/hafs-kfqc/2:48` |
| `#/<edition>/<surah>:<ayah>-<surah>:<ayah>` | A highlighted range, within one surah | `#/hafs-kfqc/2:47-2:48` |
| `#/<edition>/p<N>` | A bare page, nothing selected | `#/hafs-kfqc/p7` |

The compact range tail `2:47-48` is still parsed — older links use it — and
normalises to the literal form on the way out. Ranges never cross surahs.

## The parameters

| Key | Shape | What it does | If the value is wrong | Failure mode |
| --- | --- | --- | --- | --- |
| `w` | `3-7`, or `5` for one word | Pulses a word span inside the selection (spec §7) | The whole link is refused | reject |
| `skin` | `tajweed` | Turns on the tajweed colouring (spec §8) | The whole link is refused | reject |
| `field` | one of the ids below | Paints the desk the mus'haf lies on | The value is dropped; the link opens on the default field | fall back |
| `via` | `2:48` | The breadcrumb origin — the single ayah this hop came from | The whole link is refused | reject |
| `trail` | `2:40,2:47,2:122` | The full hop chain, oldest → newest, excluding the selection | The whole link is refused | reject |

Unknown keys are ignored, always. A link that has picked up an analytics
parameter on its way through a chat client still opens the ayah.

All five are read by `parseHash` and written by `serializeState`, both in
`packages/core/src/router.ts`. That module is framework-free and never touches
`location`; `apps/web/src/useHashRouter.ts` owns the actual reading and writing
of `location.hash`.

### Why exactly one key falls back

The four rejecting keys all answer *what are you looking at*. Half-restoring one
of those is worse than refusing it: a link that quietly drops its `trail` puts
the reader somewhere that looks right and is not, and they will not know. So a
corrupt one is refused whole, and the app opens on its own default view.

`field` is the exception because it is the one key that does not describe the
view. It says what colour the desk is. Losing an ayah in order to protect a
background colour has the trade exactly backwards, so an unreadable `field=`
is dropped and the rest of the link stands. The reasoning is written at length in
`packages/core/src/field.ts`, and both halves of the rule are tested in
`router.test.ts` — that a bad `w` refuses, and that a bad `field` does not.

## The fields

Five options, and each one is a **wash and the ink that survives it**. That
pairing is the finding, not a detail: the reference mus'haf's own field
(`#af8a68`) carries this app's `--ink-soft` at 2.39:1, so a darker desk owes its
own ink or the one sentence ever written on the field — the stage's «تعذّر تحميل
صفحة ٧» hint — becomes unreadable.

| id | wash (near → far) | ink on it | worst measured ratio |
| --- | --- | --- | --- |
| `sunk` | `#ece4d6` → `#f4efe6` | `--ink-soft` | 5.98 |
| `linen` | `#ded3c0` → `#ece4d6` | `--ink-soft` | 5.10 |
| `slate` | `#d0cdc7` → `#dedbd5` | `--ink-soft` | 4.76 |
| `tan` | `#af8a68` → `#c9ab8d` | `--ink` | 5.11 |
| `dark` | `#221e1a` → `#35302a` | `--paper` | 11.41 |

`sunk` is the default. Measured, not asserted: `e2e/contrast.spec.ts` opens each
field with the hint on screen and checks the text against **both** stops of its
wash — a gradient passes only if its whole ramp does. Those numbers exist because
the instrument was taught to read gradients first; before that the field was the
app's largest surface and its least measured one. [WebAIM's contrast
article](https://webaim.org/articles/contrast/) is the standing reference for the
4.5:1 floor this holds to.

There is deliberately **no picker**. The field is an open design question with an
instrument attached (`docs/design/page-transition.md` §7 ④), not a preference: the
options ship behind a link so all five can be looked at in a real window, and
when one wins it becomes the default and the rest of the table goes. A control in
the chrome would turn an open question into a feature.

The id list lives in `FIELDS` (`packages/core/src/field.ts`) and is the source of
truth for three things `gate:params` keeps in step: the blocks in
`apps/web/src/styles/field.css`, the rows in the table above, and — by
construction, since the spec maps over `FIELDS` — the contrast rows.

## Adding a parameter

1. Add it to `AppState`, to `serializeState` (in a fixed position), and to
   `parseHash` in `packages/core/src/router.ts`.
2. Decide, in writing, whether a bad value rejects the link or falls back, and
   say why in the code. The default is **reject** — falling back needs the
   argument `field` makes.
3. Add a row to the table above, including its failure mode.
4. Extend the round-trip sweep in `router.test.ts` with the new axis.
5. `pnpm gate:params`.
