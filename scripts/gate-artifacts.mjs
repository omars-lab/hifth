#!/usr/bin/env node
/**
 * CI gate: docs/artifacts.json still knows about every page this project has
 * published, and does not silently repeat what docs/decisions.json already
 * owns.
 *
 * Same two-half shape as scripts/gate-decisions.mjs, and for the same reason.
 *
 * The first half is the register's own bookkeeping: every `url` is a real
 * published address, every `page` it claims is checked in and rebuildable,
 * and a row that names a `decision` never drifts from what that decision's
 * own record already says. `url` is the one deliberate duplicate
 * (docs/artifacts.json's own $comment: "an inventory whose whole job is
 * 'every page we published, in one place' has to list all of them or it is
 * not one"), checked here against the decision's own `artifact` field. The
 * usual case leaves `page`/`builtBy` null and lets docs/decisions.json hold
 * the checked-in copy and the script that rebuilds it; a row is allowed to
 * keep its own copy too — sitting-hosting does, with a `note` explaining why
 * — but only if it names exactly the same page and builtBy the decision
 * does, never a stale or different one.
 *
 * The second half is the reverse check every register here carries: a page
 * under docs/design/ that neither register names is a page nobody would ever
 * be led to, which is the failure CLAUDE.md's "one register no gate can
 * check" section is about — the one direction that IS checkable, checked.
 *
 * Deliberately NOT refused: a row with `decision` and `page` both null. That
 * is the genuine orphan this register was built to make legible, not to
 * erase — it is refused only if it has nothing to say about why.
 *
 * Usage:
 *   node scripts/gate-artifacts.mjs                 check everything (CI)
 *   node scripts/gate-artifacts.mjs --list          the shelf, homeless first
 *   node scripts/gate-artifacts.mjs --files a b c   the pre-commit scope
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";
import { readDecisions, ARTIFACT_HOST } from "./decisions.mjs";
import { readArtifacts } from "./artifacts.mjs";

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
    // and this row leaves them null; `url` is the one field worth repeating
    // regardless (docs/artifacts.json's own $comment: an inventory of every
    // published page has to list all of them or it is not one). A row is
    // allowed to keep its own copy of page/builtBy too — sitting-hosting does,
    // because the row itself carries a reason worth reading — but only if it
    // matches the decision's own copy exactly. Drifting from it, or naming a
    // different page than the decision does, is the failure this checks for.
    if (d.artifact && a.url !== d.artifact) {
      fail.push(
        `${at}: decision "${a.decision}" already names ${d.artifact} as its artifact` +
          ` — this row's url must match it exactly, got ${a.url}`,
      );
    }
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
    if (!a.builtBy) fail.push(`${at}: page ${a.page} has no builtBy — nobody could rebuild it`);
    else if (!exists(a.builtBy)) fail.push(`${at}: builtBy ${a.builtBy} does not exist`);
  } else if (a.builtBy) {
    fail.push(`${at}: builtBy is set but page is not — a build script with nothing to check in`);
  }

  // --- the genuine orphan must say why it is one.
  if (!hasDecision && !hasPage && (!a.note || !a.note.trim())) {
    fail.push(`${at}: no decision and no page — note must say why there is no copy anywhere`);
  }
}

// --- the reverse direction: a page under docs/design/ that neither register names.
const DESIGN_DIR = join(ROOT, "docs", "design");
const named = new Set();
for (const a of artifacts) if (a.page) named.add(a.page);
for (const d of decisions) if (d.page) named.add(d.page);

if (existsSync(DESIGN_DIR)) {
  for (const f of readdirSync(DESIGN_DIR)) {
    if (!f.endsWith(".html") || f.endsWith(".artifact.html")) continue;
    const rel = `docs/design/${f}`;
    if (!named.has(rel)) {
      fail.push(`${rel}: a design page with no row in docs/artifacts.json or docs/decisions.json — add one`);
    }
  }
}

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
