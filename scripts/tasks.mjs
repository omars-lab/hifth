/**
 * Shared reader for docs/tasks.md — the one page that answers "whose turn is
 * it?" across all four registers at once.
 *
 * The builder and the gate both read this, for the same reason issues.mjs
 * exists: a page that says one thing when it is built and another when it is
 * checked is worse than no page, because the disagreement is silent.
 *
 * Nothing here holds a title or a reason. Every one of those is read out of the
 * register that owns the item, at build time, exactly as docs/issues.md does —
 * this file only decides which items belong on the page and in what order.
 *
 * WHY THIS IS A SEPARATE PAGE FROM docs/issues.md, which also claims to hold
 * everything unfinished. They are the same facts cut two different ways, and
 * the cut is the whole product:
 *
 *   issues.md sorts worst-first, and answers "what is most wrong?"
 *   tasks.md  sorts by owner, and answers "what is waiting on me?"
 *
 * Someone deciding what to fix next reads the first. Someone with an hour and a
 * phone reads the second, and until this page existed they had to know that
 * three open decisions live in one register, nine human-only checks in another,
 * and the rest in a third. Two of those three appear nowhere in issues.md by
 * title, so the reader had no way to see them at all.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";
import { readIssues, PLAN_PATH } from "./issues.mjs";
import { readDecisions } from "./decisions.mjs";
import { readLedger } from "./validation-ledger.mjs";

export const DOC_PATH = join(ROOT, "docs", "tasks.md");

/** Closed in the issue catalog's vocabulary — the three words that owe nothing. */
const CLOSED = ["answered", "fixed", "done"];

/**
 * The loops PLAN.md's status table does not call complete.
 *
 * Parsed rather than stored because the table is the roadmap of record and says
 * so in its own prose; a second copy of a loop's status is the exact failure
 * every register in this repo is shaped to avoid. The scan starts at the header
 * row and stops at the first line that is not a table row, so the follow-ups
 * below it are never swept in.
 */
export function loops() {
  const lines = readFileSync(PLAN_PATH, "utf8").split("\n");
  const head = lines.findIndex((l) => l.startsWith("| Loop | Status |"));
  if (head === -1) return [];
  const out = [];
  for (let i = head + 2; i < lines.length; i++) {
    if (!lines[i].startsWith("|")) break;
    const c = lines[i]
      .split("|")
      .slice(1, -1)
      .map((s) => s.trim());
    if (c.length < 4) continue;
    // "complete" is done; "complete-with-deferral" is not, and neither is "in
    // flight" or "gated on ...". Keeping the deferrals visible is the point —
    // they are precisely the rows somebody still owes something on.
    //
    // The cut is at the first space or bracket, and only the token before it is
    // compared. Several rows annotate their status in place — loop 5 reads
    // "complete (a word run now searches, ...)" and loop 6b reads
    // "complete-with-deferral (the 8-day half is a user check)" — so comparing
    // the whole cell files every annotated row as unfinished, and comparing a
    // prefix files the deferrals as done. Both failures are silent.
    if (c[1].split(/[\s(]/)[0] === "complete") continue;
    out.push({ loop: c[0], status: c[1], exit: c[2], record: c[3] });
  }
  return out;
}

/** Everything the page renders, in the order it renders it. */
export function payload() {
  const issues = readIssues();
  const openIssues = issues.filter(
    (i) => !i.source.ledger && !CLOSED.includes(i.status ?? ""),
  );
  return {
    decisions: readDecisions()
      .filter((d) => d.status === "open")
      .map((d) => ({
        id: d.id,
        question: d.question,
        options: (d.options ?? []).length,
        page: d.page,
        artifact: d.artifact,
        doc: d.doc,
      })),
    checks: (readLedger().checks ?? [])
      .filter((c) => c.status === "pending")
      .map((c) => ({ id: c.id, title: c.title, owner: c.owner, blocks: c.blocks ?? [] })),
    // Ledger-backed rows are dropped above rather than here: they are the same
    // nine checks the section before already lists, by their real titles, with
    // the command that runs them. Listing them twice would make the page look
    // like it holds nine more things than it does.
    issues: openIssues.map((i) => ({
      id: i.id,
      source: i.source,
      status: i.status,
      severity: i.severity,
      owner: i.owner,
      blockedBy: i.blockedBy ?? [],
    })),
    loops: loops(),
  };
}

/** Stable short hash of the rendered slice; stamped into tasks.md. */
export function tasksHash() {
  return createHash("sha256").update(JSON.stringify(payload())).digest("hex").slice(0, 12);
}

/** The hash tasks.md was built from, or null if there is no doc (or no stamp). */
export function docHash() {
  try {
    const m = readFileSync(DOC_PATH, "utf8").match(/<!-- tasks-hash: ([0-9a-f]+) -->/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}
