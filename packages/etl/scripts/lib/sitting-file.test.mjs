/**
 * One reading of a built sitting, and the ways a file can be not-a-sitting.
 *
 * The reading was extracted because two callers were about to grow two versions of
 * it, and the failure that makes that expensive is silent: a reader of the header
 * that tolerates a shape the other rejects hands one caller sixteen parts and the
 * other fifteen, and the part that went missing is invisible in both reports. So
 * what these pin down is the boundary — exactly which files come back null, which
 * come back with a fault, and which come back whole.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readSitting } from "./sitting-file.mjs";

let dir;

const write = (name, body) => {
  const path = join(dir, name);
  writeFileSync(path, body);
  return path;
};

/** The two lines a built sitting is read for, in the shape the builder emits them. */
const page = (head, cards) =>
  ["<!doctype html><html><body><script>", `const HEAD = ${JSON.stringify(head)};`, `const CARDS = ${JSON.stringify(cards)};`, "</script></body></html>"].join("\n");

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hifth-sitting-file-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("a whole sitting", () => {
  it("comes back with its header and the marks it asks about", () => {
    const f = write("sit.html", page({ built: "mark-report", part: "2/16", shown: 2 }, [{ id: "1:1" }, { id: "2:7" }]));
    const s = readSitting(f);
    expect(s.head.part).toBe("2/16");
    expect(s.ids).toEqual(["1:1", "2:7"]);
    expect(s.faults).toEqual([]);
  });
});

describe("things that are not a sitting", () => {
  it("a file that is not there is not an error", () => {
    expect(readSitting(join(dir, "gone.html"))).toBe(null);
  });

  it("an ordinary page with no header is not a sitting", () => {
    expect(readSitting(write("other.html", "<!doctype html><p>hello</p>"))).toBe(null);
  });

  it("a header that does not parse is not a sitting", () => {
    expect(readSitting(write("torn.html", "const HEAD = {oops};"))).toBe(null);
  });

  // The one that matters most: the output directory holds other generated pages,
  // and one of them growing a HEAD of its own must not be counted as a part.
  it("a header from something else is not a sitting", () => {
    expect(readSitting(write("else.html", `const HEAD = ${JSON.stringify({ built: "something-else" })};`))).toBe(null);
  });
});

describe("half a sitting", () => {
  it("keeps the header and says the marks cannot be checked", () => {
    const f = write("sit.html", `const HEAD = ${JSON.stringify({ built: "mark-report", part: "1/2" })};`);
    const s = readSitting(f);
    expect(s.head.part).toBe("1/2");
    expect(s.ids).toEqual([]);
    expect(s.faults).toHaveLength(1);
    expect(s.faults[0]).toContain("cannot be checked");
  });

  it("says so too when the card list is there and unreadable", () => {
    const f = write("sit.html", [`const HEAD = ${JSON.stringify({ built: "mark-report" })};`, "const CARDS = [{;}];"].join("\n"));
    const s = readSitting(f);
    expect(s.ids).toEqual([]);
    expect(s.faults[0]).toContain("does not parse");
  });

  // Faults are handed back rather than thrown, because the auditor wants the run to
  // fail and the front door wants to list the other twenty. Only the caller knows.
  it("never throws", () => {
    expect(() => readSitting(write("sit.html", `const HEAD = ${JSON.stringify({ built: "mark-report" })};\nconst CARDS = [{;}];`))).not.toThrow();
  });
});
