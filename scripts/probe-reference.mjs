#!/usr/bin/env node
/**
 * Reference-mushaf probe — is there a second opinion available today, and does it
 * agree with what we ship?
 *
 * WHY THIS EXISTS. `docs/validation/ledger.json`'s `edge-spot-audit` is the only
 * check in the project that can say the data is *true* rather than well-formed,
 * and it is blocked on a printed mushaf. That block has held for months. A
 * reachable, independently-published reference does not replace paper — see the
 * skill for what only paper can settle — but it discharges the part of the audit
 * that is arithmetic: *is ayah k on the page we say it is on?*
 *
 * `.claude/skills/mushaf-reference/SKILL.md` is the prose half of this file: what
 * each reference can and cannot settle, and which archive.org scans are the wrong
 * qira'a to compare against at all.
 *
 * NOT `packages/etl/scripts/probe-ligature-print.mjs`, which asks a question that
 * sounds identical. That one compares our table against another *corpus* — bytes
 * somebody derived by processing the same artwork — to identify which print the
 * corpus is. This one compares it against a page table *published for readers* by
 * a party who has never seen our data, to identify which print WE are. The second
 * is the one an auditor would ask for, and it is the only check here that reaches
 * outside the repo's own supply chain.
 *
 * WHY IT IS NOT A GATE, AND WILL NOT BECOME ONE. SOURCES.md already writes the
 * rule down for the quran-meta tables: "A gate that reaches the network fails
 * when a host is down, which teaches everyone to skip it." Everything here
 * reaches the network. It is opt-in (`make probe-reference`), it is absent from
 * `make ci`, and its output is evidence a human banks with `make record` — not a
 * red build.
 *
 * WHAT IT DOES NOT READ. `--page-table` asks api.quran.com for verse *keys* and
 * nothing else: no `fields` parameter, so no `text_uthmani`, no translation, no
 * transliteration. The repo's standing rule is "There is no Quran text in this
 * repo and there will not be" (packages/etl/scripts/morphology.mjs), and the
 * cheapest way to keep a probe honest is for the text never to cross the wire in
 * the first place. Nothing here writes a file.
 *
 * Usage:
 *   node scripts/probe-reference.mjs                 # reachability, ~15s
 *   node scripts/probe-reference.mjs --page-table    # 29 sampled pages
 *   node scripts/probe-reference.mjs --page-table --all   # all 604, ~4 min
 *
 * Exit code is 1 when a page-table row is a *surprise* — agreement where the two
 * print revisions must differ, or difference where they must not; see
 * V1_V2_DIVERGENCE for why those are the two halves of one assertion. A known
 * divergence is not a surprise and does not fail. Exit is 0 otherwise, including
 * when a host is simply down: an unreachable reference is news about the network,
 * not about us.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// Reached through core's build output rather than the bare specifier: nothing
// else in scripts/ is a workspace dependent, and `make probe-reference` depends
// on the `core` target the same way `make test` does.
import { fromAbsoluteAyah } from "../packages/core/dist/index.js";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = join(REPO, "apps", "web", "public", "assets", "manifest.json");

const argv = new Set(process.argv.slice(2));
const TIMEOUT_MS = 12_000;

/**
 * The candidates, and what each one can actually settle.
 *
 * `measured` records a probe that has already been run and whose result is worth
 * more than the run you are about to do — a host that failed from two unrelated
 * networks is not going to succeed because you retried it, and re-deriving that
 * conclusion has cost this project a research task already (research ⑦ was
 * cancelled over it).
 */
const REFERENCES = [
  {
    id: "quran-com-api",
    url: "https://api.quran.com/api/v4/verses/by_page/1",
    settles:
      "page → ayah for all 604 pages — but in the V1/1405H layout, which is " +
      "NOT our print. Used here as a fingerprint, not as a truth: see --page-table.",
  },
  {
    id: "quran-com-page",
    url: "https://quran.com/page/604",
    settles: "the same V1 table for a human eye. Off by a page in 36 places.",
  },
  {
    id: "qul-v2-layout",
    url: "https://qul.tarteel.ai/resources/mushaf-layout/10",
    settles:
      "the V2/1421H layout our pin was matched against — the authority for " +
      "this edition. Browser: the export is a download, so it is not probed here.",
  },
  {
    id: "archive-madinah-prints",
    url: "https://archive.org/metadata/mushaf_madinah_tercetak",
    settles: "photographs of the printed Madani masahif. Browser, BookReader.",
  },
  {
    id: "tanzil",
    url: "https://tanzil.net/",
    settles: "the tokenisation the tajweed offsets index. Not a layout.",
  },
  {
    id: "kfgqpc",
    url: "https://dm.qurancomplex.gov.sa/",
    settles: "the printer's own scans — the best reference there is.",
    measured:
      "times out on TCP 443 from a GitHub runner (2026-07-27), from the " +
      "maintainer's machine, and again on 2026-08-06. Two unrelated networks " +
      "failing at the TCP layer is not a header problem. Wayback is not " +
      "fetchable either. Treat as permanently unavailable to tooling.",
  },
];

/** A HEAD-shaped GET: status and latency only, body discarded. */
async function reach(url) {
  const started = process.hrtime.bigint();
  const stop = () => Number(process.hrtime.bigint() - started) / 1e6;
  try {
    const r = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    await r.arrayBuffer();
    return { ok: r.ok, code: String(r.status), ms: stop() };
  } catch (e) {
    return { ok: false, code: e.name === "TimeoutError" ? "timeout" : "error", ms: stop() };
  }
}

async function reachability() {
  console.log("reference reachability — measured now, from this machine\n");
  for (const ref of REFERENCES) {
    const r = await reach(ref.url);
    const mark = r.ok ? "✓" : "✗";
    console.log(
      `${mark} ${ref.id.padEnd(24)} ${r.code.padEnd(7)} ${`${Math.round(r.ms)}ms`.padStart(7)}  ${ref.url}`,
    );
    console.log(`  ${ref.settles}`);
    if (ref.measured) console.log(`  RECORDED: ${ref.measured}`);
    console.log("");
  }
  console.log("A ✗ here is news about the network, not about the data. Exit stays 0.");
}

/**
 * The 36 pages where V1/1405H and V2/1421H place different ayahs.
 *
 * NOT a tolerance list, and not empirical slack. `packages/etl/data/pages/PROVENANCE.md`
 * identified this print as V2 in Loop 4a by exactly this argument — V1 and V2 QUL
 * layout DBs diverge on 36 pages, and quran-svg's boundaries match V2's at each one —
 * and drew the consequence: "any cross-check source must be the V2 layout … V1-based
 * tables (Tanzil metadata et al.) disagree on 36 pages and must not be used for this
 * edition."
 *
 * api.quran.com serves a V1 table. That makes it useless as a source and *ideal* as an
 * instrument, because a pagination is a fingerprint: a V2 corpus checked against a V1
 * table must disagree on precisely these pages and agree on the other 568. Anything
 * else means one of the two moved.
 *
 * Enumerated rather than expressed as the four ranges PROVENANCE.md names, because
 * 566, 571–574 and 577–582 sit inside "the 564–600 region" and do NOT diverge. A range
 * would quietly excuse six pages that ought to agree.
 */
const V1_V2_DIVERGENCE = new Set([
  120, 121, 122, 123, 144, 145, 531, 532, 533, 534, 564, 565, 567, 568, 569, 570, 575, 576, 583,
  584, 585, 586, 587, 588, 589, 590, 591, 592, 593, 594, 595, 596, 597, 598, 599, 600,
]);

/** Pages spread across the mushaf: both ends, both juz boundaries, both extremes of density. */
const SAMPLE = [
  1, 2, 3, 22, 50, 77, 101, 120, 128, 144, 150, 187, 202, 255, 293, 300, 342, 385, 400, 428, 477,
  500, 528, 531, 555, 564, 582, 592, 604,
];

async function pageTable() {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));

  /** page → the ayah keys we say are on it, in mushaf order. */
  const ours = new Map();
  manifest.ayahPages.forEach((page, i) => {
    const { surah, ayah } = fromAbsoluteAyah(i + 1);
    if (!ours.has(page)) ours.set(page, []);
    ours.get(page).push(`${surah}:${ayah}`);
  });

  const pages = argv.has("--all") ? [...ours.keys()].sort((a, b) => a - b) : SAMPLE;
  console.log(
    `page table — ${manifest.edition} (V2/1421H) vs api.quran.com (V1/1405H), ` +
      `${pages.length} page(s), keys only\n`,
  );

  let unreachable = 0;
  /** Agreed where V2 and V1 are supposed to agree. */
  const expectedSame = [];
  /** Diverged where they are supposed to diverge — this is the V2 fingerprint. */
  const expectedDiff = [];
  /** Neither. Every entry here is a finding. */
  const surprises = [];

  for (const p of pages) {
    let theirs;
    try {
      const r = await fetch(`https://api.quran.com/api/v4/verses/by_page/${p}?per_page=60`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      theirs = (await r.json()).verses.map((v) => v.verse_key);
    } catch (e) {
      unreachable += 1;
      console.log(`p${String(p).padStart(3)}  ?  ${e.message}`);
      continue;
    }

    const mine = ours.get(p) ?? [];
    const same = theirs.length === mine.length && theirs.every((k, i) => k === mine[i]);
    const expected = V1_V2_DIVERGENCE.has(p) ? !same : same;

    if (!expected) surprises.push({ page: p, mine, theirs, same });
    else if (same) expectedSame.push(p);
    else expectedDiff.push(p);

    const span = (a) => (a.length ? `${a[0]}…${a.at(-1)} (${a.length})` : "—");
    const mark = !expected ? "!" : same ? "✓" : "≠";
    if (!expected || !argv.has("--quiet")) {
      console.log(
        `p${String(p).padStart(3)}  ${mark}  ours ${span(mine).padEnd(24)} theirs ${span(theirs)}` +
          (V1_V2_DIVERGENCE.has(p) ? "   [V1/V2 divergence]" : ""),
      );
    }
  }

  const covered = [...V1_V2_DIVERGENCE].filter((p) => pages.includes(p)).length;
  console.log(
    `\n${expectedSame.length} agree where the two prints agree · ` +
      `${expectedDiff.length}/${covered} diverge where V1 and V2 are known to diverge`,
  );
  if (unreachable) console.log(`${unreachable} page(s) unreachable — not counted either way`);

  if (surprises.length === 0) {
    console.log(
      "\nOur pagination still fingerprints as V2/1421H against a V1 table. That is what\n" +
        "PROVENANCE.md pinned in Loop 4a, re-measured today from outside the repo.\n" +
        "\nWhat it does NOT prove: that a hop edge joins two ayahs that genuinely\n" +
        "resemble each other. That still needs a reader — make validate CHECK=edge-spot-audit.",
    );
    return 0;
  }

  console.log(`\n${surprises.length} SURPRISE(S) — neither print's behaviour:`);
  for (const s of surprises) {
    console.log(
      `  p${s.page} — ${
        s.same
          ? "agrees, but V1 and V2 are supposed to differ here"
          : "differs, and it is not one of the 36 pages where they may"
      }`,
    );
    console.log(`    ours   ${s.mine.join(" ")}`);
    console.log(`    theirs ${s.theirs.join(" ")}`);
  }
  console.log(
    "\nThis is not proof we are wrong — the reference may have re-based its layout.\n" +
      "Settle it against the artwork before changing anything: the SVG for that page IS\n" +
      "the print, and it is already in the repo. `#/hafs-kfqc/p<N>` in `make dev` shows it,\n" +
      "and its `verse-<abs>` polygon ids are the manifest's own source. If the artwork\n" +
      "sides with the reference, that is a gate:pages-shaped defect and belongs in\n" +
      "docs/issues.json today — it is the shape of #80.",
  );
  return 1;
}

const code = argv.has("--page-table") ? await pageTable() : (await reachability(), 0);
process.exit(code);
