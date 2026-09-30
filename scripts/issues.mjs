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
 * with a section headed exactly SECTION_HEADING, and performance.md's whole body is
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
import { join, posix } from "node:path";
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

// U+2460..U+2473 for ①–⑳, then U+3251..U+325F for ㉑–㉟. The list is written out
// rather than built from a code-point range so that a marker nobody can type is
// never silently legal — and it runs past whatever the largest register
// currently uses, because the failure when it does not is a gate saying
// "docs/performance.md has no ⑯ row" about a row that is plainly there, which reads
// as a doc bug and is not one. Extended to ㉟ on 2026-08-17, when the mark
// registration document reached ⑳ and hit exactly that wall: the twenty circled
// digits are one Unicode block and the next fifteen are a different one, so the
// ceiling was the block boundary rather than any decision anybody made. Extended
// again to ㊿ on 2026-09-03, when that same document reached ㉟ and hit the next
// block boundary: U+325F ㉟ is the end of its block and U+32B1 ㊱ starts another,
// so ㊱–㊿ are written out here for the same headroom-past-the-largest-register
// reason, and for the same reason they are listed rather than ranged.
const MARKERS = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚㉛㉜㉝㉞㉟㊱㊲㊳㊴㊵㊶㊷㊸㊹㊺㊻㊼㊽㊾㊿";
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

  // performance.md is itself the register; a design doc holds one section of many.
  let from = 0;
  let to = lines.length;
  if (!file.endsWith("performance.md")) {
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
    items.set(m[1], { title: planTitleAt(lines, i), line: i + 1 });
  }
  return items;
}

/**
 * The title of the follow-up that starts at `lines[at]`. These are paragraphs,
 * not headings, so the title has to be recovered. Most follow-ups open with a
 * bolded name — sometimes struck through, which is how PLAN.md says "closed" —
 * and that name is the title. The three that do not get their first clause
 * instead, cut at the first em-dash, parenthesis or full stop, whichever the
 * prose reaches first.
 */
export function planTitleAt(lines, at) {
  let text = lines[at].replace(/^\d+\.\s+/, "");
  // A bolded name that wraps onto the item's next, indented lines is still one name.
  for (let i = at + 1; (text.match(/\*\*/g) ?? []).length % 2 === 1; i++) {
    if (i >= lines.length || !/^\s+\S/.test(lines[i])) break;
    text += ` ${lines[i].trim()}`;
  }
  const bold = text.match(/\*\*(.+?)\*\*/);
  const raw = bold ? bold[1] : text.replace(/\s*[—(].*$/, "");
  return raw
    .replace(/~~|\*\*/g, "")
    .replace(/\.\s.*$/, "")
    .replace(/\.$/, "")
    .trim();
}

/**
 * The text of the item whose heading is `lines[at]`: everything up to the next
 * heading of the same level or higher, or up to a rule on a line of its own,
 * which closes a section (whatever a page puts after it, such as a note on how
 * the page is rebuilt, is not the item's). Deeper headings stay, since they
 * belong to it.
 *
 * docs/backlog.md copies this text in full so the page reads on its own; see
 * scripts/backlog.test.mjs for where it must stop.
 */
export function bodyAfter(lines, at) {
  const out = [];
  for (let i = at + 1; i < lines.length; i++) {
    if (/^#{1,3} /.test(lines[i]) || /^---+\s*$/.test(lines[i])) break;
    out.push(lines[i]);
  }
  while (out.length && out.at(-1).trim() === "") out.pop();
  while (out.length && out[0].trim() === "") out.shift();
  return out.join("\n");
}

/**
 * The text of the PLAN.md follow-up that starts at `lines[at]`: its numbered
 * line without the number, and every indented or blank line after it, stopping
 * at the next number or heading. The list indent is taken off so the text reads
 * as paragraphs wherever it is copied.
 */
export function planBodyAt(lines, at) {
  const out = [lines[at].replace(/^\d+\.\s+/, "")];
  for (let i = at + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^\d+\.\s/.test(l) || /^#{1,3} /.test(l)) break;
    if (l.trim() !== "" && !/^\s/.test(l)) break;
    out.push(l.replace(/^ {1,3}/, ""));
  }
  while (out.length && out.at(-1).trim() === "") out.pop();
  return out.join("\n");
}

/**
 * Rewrites the relative links in `md`, written in `fromFile`, so they resolve
 * from a page in docs/. Addresses with a scheme and site-absolute paths are left
 * alone; a bare `#anchor` becomes an anchor on the page it came from.
 */
export function rebaseLinks(md, fromFile) {
  const dir = posix.dirname(fromFile);
  return md.replace(/(!?\[[^\]]*\]\()([^)\s]+)(\))/g, (all, open, target, close) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("/")) return all;
    if (target.startsWith("#")) return `${open}${posix.relative("docs", fromFile)}${target}${close}`;
    return `${open}${posix.relative("docs", posix.join(dir, target))}${close}`;
  });
}

/** An item's full text, read from the page that owns it. */
export function itemText(issue) {
  const s = issue.source;
  if (!s?.file) return "";
  const lines = readFileSync(join(ROOT, s.file), "utf8").split("\n");
  if (s.file.endsWith("PLAN.md")) {
    const it = planItems()?.get(s.item);
    return it ? rebaseLinks(planBodyAt(lines, it.line - 1), s.file) : "";
  }
  const it = sectionItems(s.file)?.get(s.item);
  return it ? rebaseLinks(bodyAfter(lines, it.line - 1), s.file) : "";
}

/**
 * A GitHub heading anchor for a register item's own heading, so a reader lands
 * on the item and not merely on the file.
 *
 * Transcribed from what GitHub actually emits, because guessing gets it wrong.
 * Checked against the rendered anchors on the published copy of
 * page-turning.md, where `### ⑧ Dead CSS: the page fade-in never runs ·
 * **confirmed**` carries the id
 *
 *     -dead-css-the-page-fade-in-never-runs--confirmed
 *
 * Three things that reads out, none of them obvious:
 *   - the circled marker is DROPPED. It is Unicode category No, and github's
 *     slugger keeps only letters and decimal digits — so an anchor built on
 *     `\p{N}` (which includes No) keeps the marker and matches nothing.
 *   - stripping happens IN PLACE and spaces are hyphenated afterwards, so the
 *     space the marker left behind becomes a *leading* hyphen, and the ` · `
 *     separator becomes a double one. Trimming or collapsing breaks both.
 *   - the hyphen in "fade-in" survives; only the added ones come from spaces.
 *
 * This lives here rather than in a renderer because two pages now link the same
 * items, and three lines of Unicode-class trivia reproduced in two files is a
 * pair that agrees today and silently stops agreeing the day GitHub changes.
 */
export const anchor = (heading) =>
  heading
    .toLowerCase()
    .replace(/[^\p{L}\p{Nd}_\- ]/gu, "")
    .replace(/ /g, "-");

/**
 * Builds the title-and-href resolver every rendered page uses: given an entry,
 * where does a reader go to read the thing itself, and what is it called?
 *
 * The title is never stored in issues.json — it is read out of the owning
 * document at build time, which is the whole discipline of the catalog. Pass
 * the ledger's checks keyed by id so a check's title comes from the ledger
 * rather than from its bare identifier.
 *
 * Hrefs are relative to `docs/`, because every page that calls this is written
 * there. Each register file is parsed once per build however many entries point
 * into it.
 */
export function linker(ledgerById = new Map()) {
  const sections = new Map();
  const items = (file) => {
    if (!sections.has(file)) sections.set(file, sectionItems(file));
    return sections.get(file);
  };
  const plan = planItems() ?? new Map();

  return function link(i) {
    const s = i.source;
    if (s.ledger) {
      return [ledgerById.get(s.ledger)?.title ?? s.ledger, `validation/ledger.json`];
    }
    const rel = s.file.replace(/^docs\//, "");
    if (s.file.endsWith("PLAN.md")) {
      return [plan.get(s.item)?.title ?? "?", `${rel}#open-follow-ups`];
    }
    const it = items(s.file)?.get(s.item);
    // Reassembled verbatim, separator and asterisks included: the anchor is a
    // function of the whole heading line, and ` · ` is what produces the double
    // hyphen before the status. Passing the parts joined by single spaces would
    // build an anchor that is right in every character except that one.
    const heading = `${s.item} ${it?.title ?? ""} · **${it?.status ?? ""}**`;
    return [it?.title ?? "?", `${rel}#${anchor(heading)}`];
  };
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
