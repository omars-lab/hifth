/**
 * The field guide leads with the short version of each check.
 *
 * The owner opened the guide on 2026-09-28 and called it "a huge wall of text":
 * every check printed every reason, file path and follow-up, the finished
 * checks included — 166 KB. They asked for a simple guide that still covers
 * everything. So each check now opens as a plain question, why it matters, what
 * you need, how long, when it is done and one short line per step; the full
 * runbook is still there, folded; finished checks fold into one list; and a
 * picture of the order replaces the paragraphs that described it.
 */
import { describe, expect, it } from "vitest";
import { briefProblems, diagramKey, overviewDiagram } from "../../../scripts/validation-ledger.mjs";
import { card, guidePage } from "../../../scripts/lib/validation-render.mjs";

const step = (n, extra = {}) => ({
  id: `s${n}`,
  do: `A long instruction number ${n}, full of reasons and file paths nobody needs on first read.`,
  expect: `What you see after step ${n}.`,
  why: `Why step ${n} matters.`,
  ...extra,
});

const pending = (extra = {}) => ({
  id: "phone-check",
  title: "Old title in house words",
  why: "The long why.",
  how: "The long how.",
  owner: "user",
  status: "pending",
  tunes: ["something"],
  runbook: { needs: ["A phone."], steps: [step(1, { short: "Open it." }), step(2, { short: "Tap start." })] },
  brief: {
    label: "Phone check",
    ask: "Does it stay smooth on a real phone?",
    what: "Only a real phone can say.",
    need: "A phone.",
    time: "3 minutes",
    done: "The results are recorded.",
    unlocks: "The first public version",
  },
  ...extra,
});

const done = {
  id: "old-check",
  title: "A check already done",
  why: "w",
  how: "h",
  owner: "user",
  status: "done",
  tunes: ["t"],
  verifiedOn: "2026-08-01",
  result: "Passed on an iPhone.",
  runbook: { steps: [step(1)] },
};

describe("what a check for a person must carry", () => {
  it("a pending check with its short version is fine", () => {
    expect(briefProblems(pending())).toEqual([]);
  });

  it("refuses a pending check with no short version", () => {
    const { brief, ...rest } = pending();
    void brief;
    expect(briefProblems(rest).join("\n")).toMatch(/no "brief"/);
  });

  it("refuses a short version missing a part", () => {
    const c = pending();
    delete c.brief.done;
    expect(briefProblems(c).join("\n")).toMatch(/brief.done/);
  });

  it("refuses a step with no short line, or one that is not short", () => {
    const c = pending();
    delete c.runbook.steps[0].short;
    c.runbook.steps[1].short = "x".repeat(200);
    const problems = briefProblems(c).join("\n");
    expect(problems).toMatch(/steps\[0\] has no "short"/);
    expect(problems).toMatch(/steps\[1\].*200 characters/);
  });

  it("asks nothing of a finished check", () => {
    expect(briefProblems(done)).toEqual([]);
  });
});

describe("a check's card", () => {
  const html = card(pending(), { diagrams: {} });
  const [visible, folded] = html.split("<details");

  it("opens with the plain question, and the short parts in view", () => {
    expect(visible).toContain("Does it stay smooth on a real phone?");
    for (const text of ["Only a real phone can say.", "A phone.", "3 minutes", "The results are recorded.", "Open it.", "Tap start."]) {
      expect(visible).toContain(text);
    }
  });

  it("keeps the full instructions, folded", () => {
    expect(visible).not.toContain("A long instruction number 1");
    expect(folded).toContain("A long instruction number 1");
    expect(folded).toContain("Why step 2 matters.");
  });

  it("draws a check's diagram when it has one, and says so loudly when it is not drawn", () => {
    const src = "flowchart TD\n  A --> B";
    const c = pending();
    c.brief.diagram = src;
    expect(card(c, { diagrams: { [diagramKey(src)]: "<svg id='x'></svg>" } })).toContain("<svg id='x'></svg>");
    expect(card(c, { diagrams: {} })).toMatch(/not drawn yet/);
  });
});

describe("the whole guide", () => {
  const html = guidePage([pending(), done], "abc123", {});

  it("folds the finished checks into one list at the end", () => {
    const at = html.indexOf('class="finished"');
    expect(at).toBeGreaterThan(html.indexOf("Does it stay smooth"));
    expect(html.slice(at)).toContain("A check already done");
    expect(html.slice(at)).toContain("Passed on an iPhone.");
    expect(html.slice(0, at)).not.toContain("A check already done");
  });

  it("marks each fold as something to tap, not plain grey text", () => {
    // A flex summary loses the browser's own arrow; the first render showed
    // "Full instructions" as a line nobody would think to tap.
    expect(html).toMatch(/details\.more > summary::before[^{]*\{ content: "▸"/);
  });

  it("opens with a list of what is left: each check, how long, what you need", () => {
    const top = html.slice(0, html.indexOf("<article"));
    expect(top).toContain('href="#phone-check"');
    expect(top).toContain("3 minutes");
    expect(top).toContain("A phone.");
  });

  it("draws what each check unlocks, and which must come first", () => {
    const a = pending();
    const b = pending({ id: "second", brief: { ...pending().brief, label: "Second", after: ["phone-check"] } });
    const src = overviewDiagram([a, b, done]);
    expect(src).toMatch(/^flowchart/);
    expect(src).toContain("Phone check");
    expect(src).toContain("The first public version");
    expect(src).toMatch(/phone_check\b.*-->.*\bsecond\b/);
    expect(src).not.toContain("A check already done");
  });
});
