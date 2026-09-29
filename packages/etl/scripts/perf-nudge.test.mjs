/**
 * The performance reminder: after a build, a push, the size check or the
 * start-up check, tell the session to run the optimizing-performance skill —
 * but only when there is something to act on, and only once per finding.
 */
import { describe, expect, it } from "vitest";
import { findings, isWatched, measuredGz, NEAR_KB } from "../../../scripts/lib/perf-nudge.mjs";

const CAP = 175 * 1024;

describe("which commands the reminder watches", () => {
  it.each([
    "make build",
    "pnpm -s exec vite build",
    "pnpm gate:budget",
    "make site",
    "make lighthouse",
    "git -C /x push -q -u origin b",
    "make budget-update",
  ])("watches %s", (cmd) => expect(isWatched(cmd)).toBe(true));

  it.each(["git status", "ls apps/web", "pnpm -s exec playwright test x", "git commit -m 'build the page'"])(
    "ignores %s",
    (cmd) => expect(isWatched(cmd)).toBe(false),
  );
});

describe("reading a size the command just printed", () => {
  it("reads the OK and FAIL lines, and nothing else", () => {
    expect(measuredGz("gate:budget — OK (160.5 KB gz / 175 KB budget, +0.1 KB)")).toBe(Math.round(160.5 * 1024));
    expect(measuredGz("gate:budget — FAIL: 180.2 KB gz > 175 KB budget")).toBe(Math.round(180.2 * 1024));
    expect(measuredGz("built in 3s")).toBeNull();
  });
});

describe("what it finds", () => {
  it("says nothing with plenty of room and clean output", () => {
    expect(findings({ totalGz: 150 * 1024, capGz: CAP, output: "gate:budget — OK" })).toEqual([]);
  });

  it("speaks up when the code is within the margin of the cap", () => {
    const f = findings({ totalGz: CAP - (NEAR_KB - 1) * 1024, capGz: CAP, output: "" });
    expect(f.map((x) => x.key)).toEqual(["near-cap"]);
    expect(f[0].say).toMatch(/KB of room left/);
  });

  it("speaks up when the size check fails", () => {
    const f = findings({ totalGz: 150 * 1024, capGz: CAP, output: "gate:budget — FAIL: 180.2 KB gz is over" });
    expect(f.map((x) => x.key)).toContain("budget-fail");
  });

  it("speaks up when the start-up check misses 2.5 s", () => {
    const out = "interactive failure for maxNumericValue assertion\n expected: <=2500\n found: 2553";
    expect(findings({ totalGz: 150 * 1024, capGz: CAP, output: out }).map((x) => x.key)).toContain("startup-slow");
  });

  it("keys a near-cap finding by the size, so the same size is not repeated but a new one is", () => {
    const at = (kb) => findings({ totalGz: CAP - kb * 1024, capGz: CAP, output: "" })[0];
    expect(`${at(10).key}:${at(10).seen}`).toBe(`${at(10).key}:${at(10).seen}`);
    expect(at(10).seen).not.toBe(at(5).seen);
  });
});
