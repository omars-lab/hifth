/**
 * Shared reader for docs/issues.json and the four registers it indexes.
 *
 * Three things read this — the gate, the terminal renderer and the markdown
 * builder — and an issue that reads one way in the terminal and another in the
 * committed doc is worse than no doc, because the disagreement is silent. So
 * the parsing, the joins and the hash live here once. Same shape and same
 * reason as scripts/use-cases.mjs and scripts/validation-ledger.mjs.
 *
 * The interesting work in this file is `sectionItems`, which is the only place
 * that knows how an open item is written down in prose. Every design doc ends
 * with a section headed exactly SECTION_HEADING, and backlog.md's whole body is
 * one such register; under both, an item is
 *
 *     ### OEn <title> · **status**
 *
 * That shape is a convention, not a schema, and a convention costs nothing to
 * break by accident — which is precisely why a gate reads it. Note the scan
 * stops at the next `## `: page-transition.md's SS8 "Alternatives rejected" is
 * also a list of OEn headings, and pulling those in would index six decisions
 * already made as if they were open questions.
 */
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";

export const ISSUES_PATH = join(ROOT, "docs", "issues.json");
export const DOC_PATH = join(ROOT, "docs", "issues.md");
export const PLAN_PATH = join(ROOT, "docs", "PLAN.md");

/** The heading every design doc's open section carries, verbatim. */
export const SECTION_HEADING = "Open questions, and what would answer each";

/** The six words. Defined in docs/issues.json's $comment; enforced here. */
export const STATUSES = ["open", "confirmed", "suspected", "blocked", "answered", "fixed"];
export const SEVERITIES = ["defect", "question", "risk"];

/** Worst first — the order `make issues` and docs/issues.md both present. */
export const STATUS_ORDER = ["confirmed", "suspected", "open", "blocked", "answered", "fixed"];

// U+2460..U+2473. The list is written out rather than built from a code-point
// range so that a marker nobody can type is never silently legal — and it runs
// to ⑳ rather than to whatever the largest register currently uses, because the
// failure when it does not is a gate saying "docs/backlog.md has no ⑯ row"
// about a row that is plainly there, which reads as a doc bug and is not one.
const MARKERS = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
const ITEM = new RegExp(`^### ([${MARKERS}])\\s+(.*?)\\s+·\\s+\\*\\*(\\w+)\\*\\*\\s*$`);

export function readIssues() {
  if (!existsSync(ISSUES_PATH)) {
    console.error(`issues missing at ${ISSUES_PATH}`);
    process.exit(1);
  }
  const { issues } = JSON.parse(readFileSync(ISSUES_PATH, "utf8"));
  return issues;
}

/**
 * The OEn items a register file currently declares: marker → {title, status}.
 *
 * Returns null when the file exists but has no open section at all, which the
 * gate reports differently from an empty one — a design doc that lost its
 * section is a doc somebody rewrote without noticing what it was carrying.
 */
export function sectionItems(file) {
  const path = join(ROOT, file);
  if (!existsSync(path)) return null;
  const lines = readFileSync(path, "utf8").split("\n");

  // backlog.md is itself the register; a design doc holds one section of many.
  let from = 0;
  let to = lines.length;
  if (!file.endsWith("backlog.md")) {
    const start = lines.findIndex((l) => l.startsWith("## ") && l.includes(SECTION_HEADING));
    if (start === -1) return null;
    from = start + 1;
    const after = lines.slice(from).findIndex((l) => l.startsWith("## "));
    to = after === -1 ? lines.length : from + after;
  }

  const items = new Map();
  for (let i = from; i < to; i++) {
    const m = lines[i].match(ITEM);
    if (m) items.set(m[1], { title: m[2], status: m[3], line: i + 1 });
  }
  return items;
}

/**
 * PLAN.md's numbered follow-ups: number → {title, line}.
 *
 * Deliberately no status. Those eleven are compound narratives whose job is to
 * record how a thing was believed over time — follow-up 2 keeps its retracted
 * licence claim beside the correction — and a single word cannot stand in for
 * that. The gate checks the number still exists; the status in issues.json is
 * a summary a human wrote, and is not checked against the prose.
 */
export function planItems() {
  const lines = readFileSync(PLAN_PATH, "utf8").split("\n");
  const start = lines.findIndex((l) => l.startsWith("### Open follow-ups"));
  if (start === -1) return null;
  const after = lines.slice(start + 1).findIndex((l) => l.startsWith("### "));
  const to = after === -1 ? lines.length : start + 1 + after;

  const items = new Map();
  for (let i = start + 1; i < to; i++) {
    const m = lines[i].match(/^(\d+)\.\s+(.*)$/);
    if (!m) continue;
    // These are paragraphs, not headings, so the title has to be recovered.
    // Most follow-ups open with a bolded name — sometimes struck through, which
    // is how this file says "closed" — and that name is the title. The three
    // that do not get their first clause instead, cut at the first em-dash,
    // parenthesis or full stop, whichever the prose reaches first.
    const bold = m[2].match(/\*\*(.+?)\*\*/);
    const raw = bold ? bold[1] : m[2].replace(/\s*[—(].*$/, "");
    const title = raw
      .replace(/~~|\*\*/g, "")
      .replace(/\.\s.*$/, "")
      .replace(/\.$/, "")
      .trim();
    items.set(m[1], { title, line: i + 1 });
  }
  return items;
}

/** Where an entry points, as a display string. */
export function sourceOf(issue) {
  const s = issue.source;
  return s.ledger ? `ledger.json · ${s.ledger}` : `${s.file} · ${s.item}`;
}

/** Which register an entry belongs to — the grouping every renderer uses. */
export function registerOf(issue) {
  const s = issue.source;
  if (s.ledger) return "docs/validation/ledger.json";
  return s.file;
}

/**
 * The slice the committed doc renders, and therefore the slice whose change
 * makes docs/issues.md stale. Not the whole file: editing `$comment` should not
 * fail a build over a generated page that never shows it.
 */
export function docPayload(issues) {
  return issues.map((i) => ({
    id: i.id,
    source: i.source,
    status: i.status ?? null,
    severity: i.severity,
    owner: i.owner,
    blockedBy: i.blockedBy ?? [],
    closedBy: i.closedBy ?? null,
    note: i.note ?? null,
  }));
}

/** Stable short hash of the rendered slice; stamped into issues.md. */
export function issuesHash(issues) {
  return createHash("sha256").update(JSON.stringify(docPayload(issues))).digest("hex").slice(0, 12);
}

/** The hash issues.md was built from, or null if there is no doc (or no stamp). */
export function docHash() {
  if (!existsSync(DOC_PATH)) return null;
  const m = readFileSync(DOC_PATH, "utf8").match(/<!-- issues-hash: ([0-9a-f]+) -->/);
  return m ? m[1] : null;
}
