#!/usr/bin/env node
/**
 * CI gate + renderer: docs/decisions.json still indexes every decision this
 * repo has recorded, and every open one can still be answered by a stranger.
 *
 * Two halves, and the second is the one that is easy to skip.
 *
 * The first half is the shape this repo already runs on — pointers resolve, the
 * generated page is not stale, and nothing sits in docs/decisions/ that the
 * index does not know about. That reverse check is why the index exists at all:
 * a record can be written, committed and forgotten, and every forward link in
 * the repo will keep resolving perfectly the whole time, because nothing points
 * at it.
 *
 * The second half is about who a decision is *for*. An option is only really
 * open if somebody outside this code can look at it and choose, so:
 *
 *   - An open decision must name two or more options, must carry a published
 *     `artifact` link anyone can open, and must carry the `page` — the same
 *     picture checked in here. Both, or the gate fails. A link with no copy
 *     dies when the host does; a copy with no link cannot be sent to anybody.
 *     Since 2026-09-01 the link is the page's own address on the app's site,
 *     derived from its path (decisions.mjs artifactFor), and a row that names
 *     any other address is refused.
 *   - Whatever is checked in must be rebuildable: `builtBy` names the script,
 *     and it has to exist. A committed page nobody can regenerate is a
 *     screenshot with extra steps, and it starts lying the day the data moves.
 *   - The record must link to both of them. A decision doc that argues about a
 *     picture the reader cannot reach is asking them to take its word for it.
 *   - The `question` must be plain language: no file names, no paths, no
 *     symbols, no commands, no backticked code. That is the CLAUDE.md tenet,
 *     and this is the only place it is more than a preference. The check is
 *     narrow on purpose — it refuses identifiers, not long words.
 *
 * Deliberately NOT refused: an `open` decision. An unanswered question is the
 * normal state of a live project, and a gate that failed for having one would
 * be switched off within a week. This gate only ever fails because two files
 * disagree, or because a decision was written down in a way nobody outside the
 * repo could act on.
 *
 * Usage:
 *   node scripts/gate-decisions.mjs                 check everything (CI)
 *   node scripts/gate-decisions.mjs --list          the register, open first
 *   node scripts/gate-decisions.mjs --id <id>       one decision in full
 *   node scripts/gate-decisions.mjs --files a b c   the pre-commit scope
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";
import {
  readDecisions,
  records,
  titleOf,
  splitDoc,
  hasAnchor,
  plainLanguage,
  decisionsHash,
  docHash,
  STATUSES,
  STATUS_ORDER,
  artifactFor,
} from "./decisions.mjs";

const decisions = readDecisions();
const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : (argv[i + 1] ?? "");
};

const byId = new Map(decisions.map((d) => [d.id, d]));
const exists = (p) => existsSync(join(ROOT, p));

// ---------------------------------------------------------------- renderers

const STATUS_MARK = { open: "○", living: "◍", decided: "●", superseded: "◌" };

const line = (d) => {
  const t = titleOf(splitDoc(d.doc).file);
  return `  ${STATUS_MARK[d.status] ?? "?"} ${d.id.padEnd(20)} ${d.question}\n      ${t ?? "(no record)"}  —  ${d.doc}`;
};

if (argv.includes("--list")) {
  const order = (d) => STATUS_ORDER.indexOf(d.status);
  console.log("\nDecisions — open first. `make decisions ID=<id>` for one in full.\n");
  for (const status of STATUS_ORDER) {
    const rows = decisions.filter((d) => d.status === status).sort((a, b) => order(a) - order(b));
    if (rows.length === 0) continue;
    console.log(`${STATUS_MARK[status]} ${status} — ${rows.length}`);
    for (const d of rows) console.log(line(d));
    console.log("");
  }
  process.exit(0);
}

if (flag("--id") !== null) {
  const d = byId.get(flag("--id"));
  if (!d) {
    console.error(`no decision with id "${flag("--id")}"`);
    process.exit(1);
  }
  console.log(`\n${d.question}\n`);
  console.log(`  id       ${d.id}`);
  console.log(`  status   ${d.status}${d.decided ? ` — ${d.decided}` : ""}`);
  if (d.by || d.date) console.log(`  made by  ${d.by ?? "?"} on ${d.date ?? "?"}`);
  console.log(`  record   ${d.doc}`);
  console.log(`           ${titleOf(splitDoc(d.doc).file) ?? "(missing)"}`);
  if (d.artifact) console.log(`  look at  ${d.artifact}`);
  if (d.page) console.log(`           ${d.page}${d.builtBy ? `  (rebuild: node ${d.builtBy})` : ""}`);
  for (const o of d.options ?? []) {
    console.log(`  option   ${o.id === d.decided ? "✓" : " "} ${o.id} — ${o.label}`);
  }
  for (const r of d.related ?? []) {
    console.log(`  related  ${r.padEnd(20)} ${byId.get(r)?.question ?? ""}`);
  }
  console.log("");
  process.exit(0);
}

// -------------------------------------------------------------------- gate

/**
 * The pre-commit scope. `--files a b c` runs the whole check, but only when one
 * of the staged files could have moved something the register points at — so a
 * commit that touches none of this costs nothing and says nothing. The hook
 * exists for the one moment the information is free: you are renaming the file
 * right now, so you know where it went. CI runs the unscoped check regardless.
 */
const scoped = argv.includes("--files");
if (scoped) {
  const staged = new Set(argv.slice(argv.indexOf("--files") + 1));
  const watched = new Set(["docs/decisions.json"]);
  for (const f of records()) watched.add(f);
  for (const d of decisions) {
    if (d.doc) watched.add(splitDoc(d.doc).file);
    if (d.page) watched.add(d.page);
    if (d.builtBy) watched.add(d.builtBy);
  }
  const touched = [...staged].some((f) => watched.has(f) || f.startsWith("docs/decisions/"));
  if (!touched) process.exit(0);
}

const fail = [];
const seen = new Set();

for (const d of decisions) {
  const at = `decisions.json[${d.id ?? "?"}]`;

  if (!d.id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.id)) fail.push(`${at}: id must be kebab-case`);
  if (seen.has(d.id)) fail.push(`${at}: duplicate id`);
  seen.add(d.id);

  if (!STATUSES.includes(d.status)) {
    fail.push(`${at}: status "${d.status}" is not one of ${STATUSES.join(", ")}`);
  }

  // --- the question is the register's own prose, so it is the register's rule.
  if (!d.question || !d.question.trim().endsWith("?")) {
    fail.push(`${at}: question must be a question, ending in "?"`);
  }
  for (const bad of plainLanguage(d.question ?? "")) {
    fail.push(`${at}: question is not plain language: ${bad}`);
  }
  for (const o of d.options ?? []) {
    if (!o.id || !o.label) fail.push(`${at}: every option needs an id and a label`);
    for (const bad of plainLanguage(o.label ?? "")) {
      fail.push(`${at}: option ${o.id} is not plain language: ${bad}`);
    }
  }

  // --- the record.
  if (!d.doc) {
    fail.push(`${at}: no doc — every decision names the record that holds its reasons`);
  } else {
    const { file, anchor } = splitDoc(d.doc);
    if (!exists(file)) fail.push(`${at}: doc ${file} does not exist`);
    else if (anchor && !hasAnchor(file, anchor)) fail.push(`${at}: doc ${file} has no heading "${anchor}"`);
    else if (!titleOf(file)) fail.push(`${at}: doc ${file} has no "# " title to index it by`);
  }

  // --- the two links, which are the reason a stranger can take part at all.
  const hasArtifact = Boolean(d.artifact);
  const hasPage = Boolean(d.page);
  if (hasArtifact !== hasPage) {
    fail.push(
      `${at}: ${hasArtifact ? "artifact with no checked-in page" : "checked-in page with no artifact link"}` +
        " — a link with no copy dies with its host, a copy with no link cannot be sent to anyone",
    );
  }
  if (hasArtifact && hasPage && d.artifact !== artifactFor(d)) {
    fail.push(
      `${at}: artifact must be the page's own address on the site, ${artifactFor(d)} — got ${d.artifact}`,
    );
  }
  if (hasPage) {
    if (!d.page.startsWith("docs/")) fail.push(`${at}: page must live under docs/, got ${d.page}`);
    else if (!exists(d.page)) fail.push(`${at}: page ${d.page} does not exist`);
    if (!d.builtBy) fail.push(`${at}: page ${d.page} has no builtBy — nobody could rebuild it`);
    else if (!exists(d.builtBy)) fail.push(`${at}: builtBy ${d.builtBy} does not exist`);
  }

  // The record has to reach both of them, or its argument is unreachable from
  // the thing it argues about.
  if (d.doc && hasPage && exists(splitDoc(d.doc).file)) {
    const prose = readFileSync(join(ROOT, splitDoc(d.doc).file), "utf8");
    const leaf = d.page.split("/").pop();
    if (!prose.includes(leaf)) fail.push(`${at}: ${splitDoc(d.doc).file} never links ${leaf}`);
    if (hasArtifact && !prose.includes(d.artifact)) {
      fail.push(`${at}: ${splitDoc(d.doc).file} never gives the site link a reader could open (${d.artifact})`);
    }
  }

  // --- status obligations.
  if (d.status === "open") {
    if ((d.options ?? []).length < 2) fail.push(`${at}: an open decision names two or more options`);
    if (!hasArtifact) fail.push(`${at}: an open decision needs something to look at — no artifact`);
    if (d.decided) fail.push(`${at}: open, but decided is set to "${d.decided}"`);
  }
  if (d.status === "decided") {
    if (!d.by || !d.date) fail.push(`${at}: decided, but does not say who decided it and when`);
    if ((d.options ?? []).length > 0 && !(d.options ?? []).some((o) => o.id === d.decided)) {
      fail.push(`${at}: decided is "${d.decided ?? "null"}", which is not one of its options`);
    }
  }
  // --- what else this decision is holding hands with.
  //
  // Both directions, or it does not count. A reader arrives at whichever of a
  // pair they were sent, and a one-way link is invisible from the other end —
  // which is the end they are usually standing at, because the second half of a
  // pair is written months later and the first is no longer what anyone opens.
  for (const r of d.related ?? []) {
    if (r === d.id) fail.push(`${at}: related to itself`);
    else if (!byId.has(r)) fail.push(`${at}: related "${r}" matches no decision`);
    else if (!(byId.get(r).related ?? []).includes(d.id)) {
      fail.push(`${at}: related "${r}" does not name it back — say it in both rows`);
    }
  }

  if (d.status === "superseded") {
    if (!d.supersededBy) fail.push(`${at}: superseded, but does not say by what`);
    else if (!decisions.some((o) => o.id === d.supersededBy)) {
      fail.push(`${at}: supersededBy "${d.supersededBy}" matches no decision`);
    }
  }
  if (d.date && !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) fail.push(`${at}: date must be YYYY-MM-DD`);
}

// --- the reverse direction: a record nothing points at.
const indexed = new Set(decisions.map((d) => splitDoc(d.doc ?? "").file));
for (const file of records()) {
  if (!indexed.has(file)) {
    fail.push(`${file}: a decision record with no row in docs/decisions.json — add one`);
  }
}

// --- the generated page.
const want = decisionsHash(decisions);
const got = docHash();
if (got === null) fail.push("docs/decisions/README.md is missing or unstamped — run `make decisions-doc`");
else if (got !== want) fail.push(`docs/decisions/README.md is stale (${got} ≠ ${want}) — run \`make decisions-doc\``);

if (fail.length > 0) {
  console.error("gate:decisions — FAIL\n");
  for (const f of fail) console.error(`  ${f}`);
  console.error(`\n  ${fail.length} problem${fail.length === 1 ? "" : "s"}.`);
  process.exit(1);
}

if (!scoped) {
  console.log(
    `gate:decisions — OK: ${decisions.length} decisions, ${records().length} records, ` +
      `${decisions.filter((d) => d.status === "open").length} open.`,
  );
}
