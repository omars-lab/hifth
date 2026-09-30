---
name: x-callback-url-contract
description: "hifth's native shell answers x-callback-url (open/current) since 2026-09-29; the contract is ONE OpenAPI JSON under docs/design (Edition schema with shipped flags, x-public-site) held honest by Swift tests, core vitests (enums vs router; every example through the JS link-builder port) and a node test (rendered page with the inlined builder); add a key in all four"
metadata:
  node_type: memory
  type: project
  originSessionId: e85ea537-5f5b-46cb-add4-971a01406e5a
  modified: 2026-09-30T00:40:00.000Z
---

Since 2026-09-29 (branch `x-callback-url`) the Mac/iPad shell answers `hifth://x-callback-url/open`
(`page=`, `verse=`+`words=`, `surah=` → first verse with `open=context`, `mode=` = web `tool=`,
`open=commentary|context|…`, `view=`, or a whole `route=`) and `…/current`, opening the caller's
`x-success` with `route`+`url`, or `x-error` with `errorCode`+`errorMessage`. Plain `hifth://` links
are unchanged. Web side gained `?open=commentary` and `?open=context` (pitch build only).

**Why:** the owner asked "did we implement xcallback? can we make a swagger spec of all the
xcallback urls?", then added: open to a page / verse / words, to tafsir and surah context, and
choose the mode to open in. Everything went in behind the existing `open(url)` path.

**How to apply:** the contract is `docs/design/app-url-scheme.openapi.json`, rendered by
`make app-links-doc` to `docs/design/app-url-scheme.html`; `make app-links-ui` serves the same JSON in Swagger UI
(`docs/design/app-url-scheme.swagger.html`, a hand-written page whose plugin draws the spec's `x-examples`
under each operation, since OpenAPI has no whole-URL examples of its own). A new key or action goes in the JSON
(parameter + enum + an `x-examples` row), in `native/Hifth/Route/XCallback.swift` (+ its lists
`tools`/`panels`/`views`), and the tests will say what is out of step: XCallbackTests runs every
example through the parser and compares enums to the Swift lists; `packages/core/src/link-spec.test.ts`
compares the same enums to `OPEN_PANELS`/`LINK_TOOLS`; `scripts/app-url-scheme.test.mjs` refuses
a stale page. Open item ⑨ in native-shell.md: nothing drives a request through the OS end to end.

Since branch `app-links-editions` (2026-09-29): the JSON carries `components.schemas.Edition`
(`enum` of four ids + `x-editions` with `shipped`/`reason`; only `hafs-kfqc` ships) and
`x-public-site`; Swift `Route.editions` refuses unknown/unshipped editions by name (`badEdition`
in XCallback); `packages/core/src/link-builder.ts` is an import-free JS port of the parser
(`predictLink`/`composeLinks`), compiled and inlined by `scripts/build-app-url-scheme.mjs` as
the live builder on the rendered page (`make app-links-doc` depends on `core`). So a new key or
edition goes in FOUR places: JSON, Swift lists, the JS port, and the tests
(`link-builder.test.ts` runs every x-example through the port; Playwright `link-builder.spec.ts`
drives the form). Design: `docs/design/app-links-editions-and-builder.md`; its open items are
the share-sheet builder (draw on a phone first) and the website accepting unknown editions.
See [[standing-merge-approval]], [[no-held-text-in-pr-bodies]].
