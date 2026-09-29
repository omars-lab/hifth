#!/usr/bin/env node
/**
 * Does docs/artifacts.json keep its own books, and does it agree with
 * docs/decisions.json wherever the two describe the same page?
 *
 * This is the half of the published-page register that CAN be checked from
 * the tree. The other half — has every publish been written down here at all —
 * cannot, because the record of a publish lives in a session log on one laptop;
 * scripts/artifact-sweep.mjs does that half where the logs are, and is not a
 * gate for that reason. This file only reads what is already written here:
 *
 *   - every `url` is a link on the one other host pages were put on, and no
 *     two rows share one;
 *   - every row has a title, a plain `shows` sentence and a published date;
 *   - a row that names a `decision` points at a real one, and if it keeps its
 *     own copy of `page`/`builtBy` (sitting-hosting does, with a `note` saying
 *     why) that copy is exactly the decision's, never a stale or different one;
 *   - every `page` a row claims is checked in under docs/, and names the
 *     script that rebuilds it — or, for a page written by hand, a note that
 *     says so;
 *   - a row with no decision and no page (the genuine orphan this register was
 *     built to make visible) says in its note why there is no copy anywhere.
 *
 * Written on the experience-atlas branch in August 2026 and brought onto main
 * on 2026-09-29. Two rules from that draft were dropped on the way, because
 * main had changed underneath them: a row's url no longer has to equal its
 * decision's address (a decision's address is its page on the app's own site
 * now, and this register holds only the other-host copies), and every design
 * page no longer needs a row somewhere (the site's generated front door lists
 * every page under docs/ already).
 *
 * Usage:
 *   node scripts/gate-artifacts.mjs                 check everything
 *   node scripts/gate-artifacts.mjs --list          the shelf, homeless first
 *   node scripts/gate-artifacts.mjs --files a b c   only if a staged file could matter
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";
import { readDecisions } from "./decisions.mjs";
import { readArtifacts } from "./artifacts.mjs";

// Since 2026-09-01 a decision's own address is its page on the app's site, and
// this register holds only the copies put on the one other host pages went to.
// So the host rule lives here now, not in decisions.mjs, and a row's url is
// never expected to equal its decision's address — they are two copies.
const ARTIFACT_HOST = "https://claude.ai/";

const artifacts = readArtifacts();
const decisions = readDecisions();
const byId = new Map(decisions.map((d) => [d.id, d]));
const exists = (p) => existsSync(join(ROOT, p));
const argv = process.argv.slice(2);

// ---------------------------------------------------------------- renderers

if (argv.includes("--list")) {
  const homeless = artifacts.filter((a) => !a.decision && !a.page);
  const kept = artifacts.filter((a) => !homeless.includes(a));
  console.log("\nPublished pages — no home first.\n");
  for (const group of [
    ["○ no copy anywhere", homeless],
    ["● named by a decision or checked in", kept],
  ]) {
    const [label, rows] = group;
    if (rows.length === 0) continue;
    console.log(`${label} — ${rows.length}`);
    for (const a of rows) {
      console.log(`  ${a.title}`);
      console.log(`    ${a.url}`);
      if (a.decision) console.log(`    decision: ${a.decision}`);
      if (a.page) console.log(`    page:     ${a.page}`);
      if (a.note) console.log(`    note:     ${a.note}`);
    }
    console.log("");
  }
  process.exit(0);
}

// -------------------------------------------------------------------- gate

/**
 * The pre-commit scope, same shape as gate-decisions.mjs's: `--files a b c`
 * runs the full check only when a staged file could have moved something this
 * register points at, so an unrelated commit costs nothing. CI always runs
 * the unscoped check.
 */
const scoped = argv.includes("--files");
if (scoped) {
  const staged = new Set(argv.slice(argv.indexOf("--files") + 1));
  const watched = new Set(["docs/artifacts.json", "docs/decisions.json"]);
  for (const a of artifacts) {
    if (a.page) watched.add(a.page);
    if (a.builtBy) watched.add(a.builtBy);
  }
  for (const d of decisions) {
    if (d.page) watched.add(d.page);
    if (d.builtBy) watched.add(d.builtBy);
  }
  const touched = [...staged].some((f) => watched.has(f) || f.startsWith("docs/design/"));
  if (!touched) process.exit(0);
}

const fail = [];
const seenUrl = new Set();

for (const a of artifacts) {
  const at = `artifacts.json[${a.title ?? a.url ?? "?"}]`;

  if (!a.url || !a.url.startsWith(ARTIFACT_HOST)) {
    fail.push(`${at}: url must be an absolute ${ARTIFACT_HOST}… link, got ${a.url}`);
  } else {
    if (seenUrl.has(a.url)) fail.push(`${at}: duplicate url`);
    seenUrl.add(a.url);
  }

  if (!a.title || !a.title.trim()) fail.push(`${at}: title is empty`);
  if (!a.shows || !a.shows.trim()) fail.push(`${at}: shows is empty — say what a reader sees on opening it`);
  if (!a.published || !/^\d{4}-\d{2}-\d{2}$/.test(a.published)) {
    fail.push(`${at}: published must be YYYY-MM-DD, got ${a.published}`);
  }

  const hasDecision = Boolean(a.decision);
  const hasPage = Boolean(a.page);
  const d = hasDecision ? byId.get(a.decision) : null;

  if (hasDecision && !d) {
    fail.push(`${at}: decision "${a.decision}" matches no row in docs/decisions.json`);
  }

  if (d) {
    // --- the decision usually owns the page and the script that rebuilds it,
    // and this row leaves them null. A row is allowed to keep its own copy of
    // page/builtBy too — sitting-hosting does, because the row itself carries a
    // reason worth reading — but only if it matches the decision's own copy
    // exactly. Drifting from it, or naming a different page than the decision
    // does, is the failure this checks for.
    if (a.page !== null && a.page !== (d.page ?? null)) {
      fail.push(
        `${at}: decision "${a.decision}" names page ${d.page ?? "null"}` +
          ` — this row must match it exactly or leave page null, got ${a.page}`,
      );
    }
    if (a.builtBy !== null && a.builtBy !== (d.builtBy ?? null)) {
      fail.push(
        `${at}: decision "${a.decision}" names builtBy ${d.builtBy ?? "null"}` +
          ` — this row must match it exactly or leave builtBy null, got ${a.builtBy}`,
      );
    }
  }

  // --- whatever this row itself claims to hold — whether or not a decision
  // also owns it — must actually exist and rebuild.
  if (hasPage) {
    if (!a.page.startsWith("docs/")) fail.push(`${at}: page must live under docs/, got ${a.page}`);
    else if (!exists(a.page)) fail.push(`${at}: page ${a.page} does not exist`);
    // A page written by hand has no script to name; the row's note says so,
    // the same way a page with no copy anywhere has to say why.
    if (!a.builtBy) {
      if (!a.note || !a.note.trim()) {
        fail.push(`${at}: page ${a.page} has no builtBy and no note saying it is written by hand`);
      }
    } else if (!exists(a.builtBy)) fail.push(`${at}: builtBy ${a.builtBy} does not exist`);
  } else if (a.builtBy) {
    fail.push(`${at}: builtBy is set but page is not — a build script with nothing to check in`);
  }

  // --- the genuine orphan must say why it is one.
  if (!hasDecision && !hasPage && (!a.note || !a.note.trim())) {
    fail.push(`${at}: no decision and no page — note must say why there is no copy anywhere`);
  }
}

// The reverse direction — a design page neither register names — is no longer
// checked here. Since 2026-09-01 the site's own front door (dist/docs/index.html,
// written by scripts/stage-docs.mjs) lists every page under docs/ by folder, so
// no merged page is one nobody would be led to, and a row per page would be a
// second list of what that one already derives.

if (fail.length > 0) {
  console.error("gate:artifacts — FAIL\n");
  for (const f of fail) console.error(`  ${f}`);
  console.error(`\n  ${fail.length} problem${fail.length === 1 ? "" : "s"}.`);
  process.exit(1);
}

if (!scoped) {
  const homeless = artifacts.filter((a) => !a.decision && !a.page).length;
  console.log(`gate:artifacts — OK: ${artifacts.length} published pages, ${homeless} with no copy anywhere.`);
}
