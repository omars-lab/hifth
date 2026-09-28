/**
 * The parameter page is the one list of every link the app answers to.
 *
 * Owner, 2026-09-28: "see if we need a swagger spec of all the urls we support
 * … along with query params" and "keep our swagger spec in sync with our imp via
 * relevant hooks". Nothing after the `#` reaches a server, so a server spec does
 * not fit (docs/design/app-links.md); the page that already lists every key is
 * the spec. What it lacked: examples anyone could copy and trust, and the one
 * setting read before the `#`. Both are now checked on every commit.
 */
import { describe, expect, it } from "vitest";
import { exampleProblems, searchSettingProblems } from "../../../scripts/lib/link-catalog.mjs";
import { parseHash, serializeState } from "../../core/dist/index.js";

const doc = (rows, keys = ["w", "field"]) =>
  [
    "| Key | Shape | What it does | If the value is wrong | Failure mode |",
    "| --- | --- | --- | --- | --- |",
    ...keys.map((k) => `| \`${k}\` | x | x | x | reject |`),
    "",
    "| Link | The app | What you see |",
    "| --- | --- | --- |",
    ...rows,
  ].join("\n");

const check = (md) => exampleProblems(md, { parseHash, serializeState });

describe("the examples on the parameter page", () => {
  it("accepts examples that do what they say", () => {
    const md = doc([
      "| `#/hafs-kfqc/2:48?w=3-7` | opens | a word span |",
      "| `#/hafs-kfqc/2:48?w=abc` | refuses | nothing |",
      "| `#/hafs-kfqc/2:48?field=neon` | opens as `#/hafs-kfqc/2:48` | the default desk |",
    ]);
    expect(check(md)).toEqual([]);
  });

  it("refuses an example that says it opens when the app refuses it", () => {
    const md = doc(["| `#/hafs-kfqc/2:48?w=abc` | opens | x |", "| `#/hafs-kfqc/p1?field=tan` | opens | x |"]);
    expect(check(md).join("\n")).toMatch(/w=abc.*the app refuses it/);
  });

  it("refuses an example that says it is refused when the app opens it", () => {
    const md = doc(["| `#/hafs-kfqc/2:48?w=3` | refuses | x |", "| `#/hafs-kfqc/p1?field=tan` | opens | x |"]);
    expect(check(md).join("\n")).toMatch(/w=3.*the app opens it/);
  });

  it("refuses an example the app would write back differently", () => {
    const md = doc(["| `#/hafs-kfqc/2:48?field=tan&w=3` | opens | x |"]);
    expect(check(md).join("\n")).toMatch(/writes it back as `#\/hafs-kfqc\/2:48\?w=3&field=tan`/);
  });

  it("wants at least one example for every key", () => {
    const md = doc(["| `#/hafs-kfqc/2:48?w=3` | opens | x |"]);
    expect(check(md).join("\n")).toMatch(/`field` has no example/);
  });
});

describe("settings read before the #", () => {
  const md = ["| Setting | Shape | What it does | If the value is wrong |", "| --- | --- | --- | --- |", "| `phonebar` | `a` | x | x |"].join("\n");

  it("accepts a setting the code reads and the page lists", () => {
    const src = { "a.tsx": 'new URLSearchParams(search).get("phonebar")' };
    expect(searchSettingProblems(md, src)).toEqual([]);
  });

  it("refuses a setting the code reads that the page does not list", () => {
    const src = { "a.tsx": 'new URLSearchParams(search).get("phonebar"); new URLSearchParams(s).get("debug")' };
    expect(searchSettingProblems(md, src).join("\n")).toMatch(/a\.tsx reads `\?debug=`/);
  });

  it("refuses a listed setting nothing reads", () => {
    expect(searchSettingProblems(md, {}).join("\n")).toMatch(/`phonebar`.*nothing reads it/);
  });
});
