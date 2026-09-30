/**
 * The waiting-on-you note: it must find a record's recommendation in each of
 * the three ways records write one, and draw a made-up backlog with the
 * recommendation called out, the first picture shown and the rest folded.
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { firstSentence, leftoverShots, recommendationFrom, renderWaiting } from "./waiting.mjs";

test("recommendationFrom reads a bold lead and its continuation lines", () => {
  const md = ["# A record", "", "**Recommendation, for now:** C. It is the", "only one that works.", "", "More."].join("\n");
  assert.equal(recommendationFrom(md), "C. It is the only one that works.");
});

test("recommendationFrom reads a bold lead inside a list item and stops at the next item", () => {
  const md = ["- **Recommended:** keep today's stroke,", "  as it is.", "- **Why now:** because."].join("\n");
  assert.equal(recommendationFrom(md), "Keep today's stroke, as it is.");
});

test("recommendationFrom reads an option heading that ends in 'recommended'", () => {
  const md = ["## Options", "", "### C — one pass", "", "### D — counted passes — recommended", "", "Body."].join("\n");
  assert.equal(recommendationFrom(md), "D — counted passes");
});

test("recommendationFrom says nothing when a record makes no recommendation", () => {
  assert.equal(recommendationFrom("# A record\n\nWe have not decided what to recommend.\n"), null);
});

test("firstSentence drops a leading bold title and stops at the first full stop", () => {
  assert.equal(firstSentence("**Title.** One thing happens. Then another."), "One thing happens.");
  assert.equal(firstSentence("x".repeat(300), 20), `${"x".repeat(19)}…`);
});

const p = {
  decisions: [
    {
      id: "pen",
      question: "Which pen should mark the verse?",
      options: [
        { id: "A", label: "The amber one" },
        { id: "B", label: "The grey one" },
      ],
      artifact: "https://example.test/docs/design/pen.html",
      doc: "docs/decisions/pen.md",
    },
    { id: "bare", question: "Is this one drawn yet?", options: [], doc: "docs/decisions/bare.md" },
  ],
  checks: [
    { id: "hold", title: "Hold the phone", blocks: ["loop-7"], why: "Only a hand can tell. More words.", needs: ["A phone"], steps: ["Hold it"] },
  ],
  issues: [
    { id: "q1", owner: "user", status: "open", text: "**Q1.** Should it snap? It might." },
    { id: "q2", owner: "user", status: "blocked", text: "Waiting on a licence. Later." },
    { id: "q3", owner: "someone", status: "open", text: "Not yours." },
  ],
};
const shots = {
  pen: {
    shots: [
      { file: "pen-0.png", caption: "The top of the page" },
      { file: "pen-1.png", caption: "What does each pen look like?" },
    ],
  },
};
const out = renderWaiting({
  p,
  shots,
  recs: { pen: "A. It reads at a glance." },
  link: (i) => [i.id.toUpperCase(), `issues.md#${i.id}`],
  hash: "abc123",
});

test("renderWaiting stamps the note and counts only the owner's items", () => {
  assert.match(out, /%% waiting-hash: abc123 %%/);
  assert.match(out, /\*\*2 choices\*\*.*\*\*1 checks\*\*.*\*\*1 questions\*\*.*\*\*1 items\*\*/);
  assert.doesNotMatch(out, /Q3/);
});

test("renderWaiting calls out the recommendation and links the page and the record", () => {
  assert.match(out, /> \[!tip\] Recommended\n> A\. It reads at a glance\./);
  assert.match(out, /\[open the options page\]\(https:\/\/example\.test\/docs\/design\/pen\.html\)/);
  assert.match(out, /\[read the record\]\(decisions\/pen\.md\)/);
});

test("renderWaiting shows the first picture and folds the rest", () => {
  assert.match(out, /^!\[The top of the page\]\(waiting-on-you\/pen-0\.png\)$/m);
  assert.match(out, /> \[!example\]- 1 more picture from the page\n> \*\*What does each pen look like\?\*\*/);
  assert.match(out, /^> !\[What does each pen look like\?\]\(waiting-on-you\/pen-1\.png\)$/m);
});

test("renderWaiting says how to get pictures for a decision that has none", () => {
  const bare = out.slice(out.indexOf("### Is this one drawn yet?"));
  assert.match(bare, /No pictures yet: run `make waiting-shots`/);
  assert.doesNotMatch(bare.slice(0, bare.indexOf("\n## ")), /\[!tip\]/);
});

test("renderWaiting folds a check's steps and lists each question in one line", () => {
  assert.match(out, /### Hold the phone\n\nOnly a hand can tell\.\n\n> \[!note\]- What you need, and the steps/);
  assert.match(out, /> Run it with `make validate CHECK=hold`\./);
  assert.match(out, /^- \*\*\[Q1\]\(issues\.md#q1\)\*\* — Should it snap\?$/m);
  assert.match(out, /stuck until something outside the code happens\? — 1\n[\s\S]*^- \*\*\[Q2\]\(issues\.md#q2\)\*\* — Waiting on a licence\.$/m);
});

test("leftoverShots names pictures of a decision that is no longer open", () => {
  const shots = { a: { shots: [{ file: "a-0.png", caption: "top" }] }, gone: { shots: [{ file: "gone-0.png", caption: "top" }] } };
  const files = ["a-0.png", "gone-0.png", "stray-3.png"];
  assert.deepEqual(leftoverShots(shots, ["a"], files), [
    "gone — pictured, but no longer an open decision",
    "stray-3.png — on disk, but not in the picture list",
  ]);
});

test("leftoverShots is quiet when the pictures match the open decisions", () => {
  const shots = { a: { shots: [{ file: "a-0.png", caption: "top" }, { file: "a-1.png", caption: "s" }] } };
  assert.deepEqual(leftoverShots(shots, ["a", "b"], ["a-0.png", "a-1.png"]), []);
});
