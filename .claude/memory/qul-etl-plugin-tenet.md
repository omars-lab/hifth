---
name: qul-etl-plugin-tenet
description: "The two Qur'an-data ETLs are complementary plugins behind one interface — a project tenet — not one replacing the other"
metadata: 
  node_type: memory
  type: project
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-08T02:26:17.834Z
---

Hifth takes in Qur'an data two **complementary** ways, and both stay. This became the third
CLAUDE.md tenet ("Every source of Qur'an data is a plugin") and decision `qul-etl-plugins`
(decided B, by omar, 2026-09-07).

- **derive-and-measure** (plugin role "derive", default:true) — the shipping build: extract-pages →
  build-adjacency → build-roots → build-tajweed. Ships none of the outside rulers' bytes; stays
  offline + byte-for-byte re-derivable. This is what `make ci` guards.
- **held-copy** (role "hold", default:false) — holds a copy of the outside library's V4 pieces in
  the owner's Supabase, off-repo/off-bundle, so tools can draw our own page and check it. Ships
  nothing to readers.

**How they're wired:** registry `packages/etl/scripts/lib/etl-plugins.mjs` (PLUGINS list) + runner
`packages/etl/scripts/etl.mjs`; each source is one descriptor under `plugins/`. `make etl` runs
defaults through the runner and produces byte-identical assets (proven, not just argued). Adding a
source = one file + one line; the runner never branches. Map feature `etl-plugins`.

**Why:** owner asked for "both etls... complementary... plugins" and "this should be a tenet". A
fork-the-pipeline or privileged-path approach was the thing to avoid.

**How to apply:** a new Qur'an-data source enters as a named plugin behind the shared interface,
never a hard-wired branch. A held source keeps its own licence gate *inside itself* — the runner
must not route around it.

**Distinct licence checks (do not merge them):** the ruler check
`qul-rulers-terms-and-text-free` confirms an export carries NO text; the held-copy check
`qul-held-copy-licensed-and-offbundle` confirms the text/fonts/morphology it deliberately holds are
each licensed. Opposite theses — broadening one into the other makes it self-contradictory.

See [[qul-gap-record-dont-import]], [[qul-licensing]], [[decisions-must-be-recorded-at-the-source]].
The full join is drawn in `docs/design/qul-data-erd.md` (mermaid, renders on the code host).
Worktree: `/Users/omareid/Workspace/git/hifth-qul-etl` on branch `qul-etl-supabase`.
