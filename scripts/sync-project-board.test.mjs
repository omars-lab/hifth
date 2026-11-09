// The board copy: which column each backlog item lands in, and what a run changes.
// Made-up items only; nothing here is read from the real backlog.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  columnFor,
  cardForIssue,
  cardForCheck,
  plan,
  idInBody,
  COLUMNS,
  worthRetrying,
} from "../.claude/skills/issues/scripts/sync-project-board.mjs";

const item = (over = {}) => ({ id: "made-up", status: "open", severity: "defect", owner: "agent", blockedBy: [], note: "", text: "", ...over });

test("an item waiting on another lands in Blocked, even when it is the owner's", () => {
  assert.equal(columnFor(item({ owner: "user", blockedBy: ["other"] })), "Blocked");
  assert.equal(columnFor(item({ status: "blocked" })), "Blocked");
});

test("the owner's items wait on Omar; an agent's marked next is Next up; the rest are To do", () => {
  assert.equal(columnFor(item({ owner: "user" })), "Waiting on Omar");
  assert.equal(columnFor(item({ next: true })), "Next up");
  assert.equal(columnFor(item()), "To do");
});

test("every column a card can land in is one the board has", () => {
  const names = COLUMNS.map((c) => c.name);
  for (const c of ["Blocked", "Waiting on Omar", "Next up", "To do", "Done"]) assert.ok(names.includes(c), c);
});

test("a card carries the item's title, its words, where it lives and its id", () => {
  const c = cardForIssue(item({ note: "A note.", text: "The words." }), ["A made-up title", "design/x.md#a"]);
  assert.equal(c.title, "A made-up title");
  assert.match(c.body, /A note\.\n\nThe words\./);
  assert.match(c.body, /github\.com\/omars-lab\/hifth\/blob\/main\/docs\/design\/x\.md#a/);
  assert.match(c.body, /Backlog id: `made-up`/);
  assert.equal(c.kind, "Defect");
});

test("an item with no title found falls back to its id, not a question mark", () => {
  assert.equal(cardForIssue(item(), ["?", "x.md"]).title, "made-up");
});

test("a check by hand waits on Omar and lists its steps", () => {
  const c = cardForCheck({ id: "chk", title: "Look at it", why: "Because.", needs: ["an iPad"], steps: ["open", "look"] });
  assert.equal(c.column, "Waiting on Omar");
  assert.equal(c.kind, "Check by hand");
  assert.match(c.body, /- an iPad/);
  assert.match(c.body, /2\. look/);
});

test("a card added but never labelled (a run cut off) is found by the id in its text, not added twice", () => {
  const c = cardForIssue(item({ id: "cut-off" }), ["Cut off", "x.md"]);
  assert.equal(idInBody(c.body), "cut-off");
  const existing = new Map([["cut-off", { ...c, column: undefined, kind: undefined, labelled: false, item: "i", draft: "d" }]]);
  const p = plan([c], existing);
  assert.equal(p.add.length, 0);
  assert.deepEqual(p.change.map((x) => [x.id, x.unlabelled, x.textChanged]), [["cut-off", true, false]]);
});

test("a run adds the new, changes the moved, finishes the closed, and leaves the rest", () => {
  const same = cardForIssue(item({ id: "same" }), ["Same", "x.md"]);
  const moved = cardForIssue(item({ id: "moved", next: true }), ["Moved", "x.md"]);
  const fresh = cardForIssue(item({ id: "fresh" }), ["Fresh", "x.md"]);
  const existing = new Map([
    ["same", { ...same, item: "i1", draft: "d1" }],
    ["moved", { ...moved, column: "To do", item: "i2", draft: "d2" }],
    ["gone", { id: "gone", title: "Gone", body: "", column: "To do", kind: "Defect", item: "i3", draft: "d3" }],
    ["old", { id: "old", title: "Old", body: "", column: "Done", kind: "Defect", item: "i4", draft: "d4" }],
  ]);
  const p = plan([same, moved, fresh], existing);
  assert.deepEqual(p.add.map((c) => c.id), ["fresh"]);
  assert.deepEqual(p.change.map((c) => c.id), ["moved"]);
  assert.equal(p.change[0].textChanged, false);
  assert.deepEqual(p.done.map((c) => c.id), ["gone"]);
});

test("a GitHub server error or a cut-off reply is tried again; a real error is not", () => {
  assert.equal(worthRetrying("gh: HTTP 502: Bad Gateway"), true);
  assert.equal(worthRetrying("gh: HTTP 504"), true);
  assert.equal(worthRetrying("unexpected end of JSON input"), true);
  assert.equal(worthRetrying("gh: Could not resolve to a ProjectV2 (NOT_FOUND)"), false);
  assert.equal(worthRetrying("HTTP 401: Bad credentials"), false);
});
