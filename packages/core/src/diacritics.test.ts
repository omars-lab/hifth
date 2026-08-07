import { describe, expect, it } from "vitest";
import { DIACRITICS, diacriticId, diacriticName, isDiacriticName } from "./diacritics.js";

describe("the mark vocabulary", () => {
  it("carries every name the print draws, and no duplicates", () => {
    // 26 is measured, not chosen: it is the number of distinct data-diacritic
    // values across all 604 pages of the ligature corpus. A duplicate would be
    // worse than a missing name — two ids for one mark, and half the shards
    // would use the other one.
    expect(DIACRITICS).toHaveLength(26);
    expect(new Set(DIACRITICS).size).toBe(26);
  });

  it("keeps the ids a shard was written against", () => {
    // These are the ids in every shipped shard. Reordering DIACRITICS silently
    // re-labels the whole corpus — a fatha becomes a kasra on every page — and
    // nothing else in the build would notice, because the geometry is
    // unchanged and only the integer beside it moved. This test is the notice.
    expect(diacriticId("fatha")).toBe(0);
    expect(diacriticId("kasra")).toBe(1);
    expect(diacriticId("damma")).toBe(2);
    expect(diacriticId("sukun")).toBe(3);
    expect(diacriticId("shadda")).toBe(4);
    expect(diacriticId("small noon")).toBe(25);
  });

  it("says -1 for a name the print has never drawn", () => {
    // Not undefined: the ETL is expected to throw on this, and a number that
    // indexes nothing is louder downstream than a hole would be.
    expect(diacriticId("two dots")).toBe(-1);
    expect(diacriticId("")).toBe(-1);
    expect(isDiacriticName("two dots")).toBe(false);
    expect(isDiacriticName("fatha")).toBe(true);
  });

  it("round-trips a name through its id and back", () => {
    for (const name of DIACRITICS) {
      expect(diacriticName(diacriticId(name))).toBe(name);
    }
  });

  it("says nothing rather than something for an id off the end", () => {
    expect(diacriticName(26)).toBeNull();
    expect(diacriticName(-1)).toBeNull();
  });

  it("excludes the dots on purpose", () => {
    // i'jam distinguishes ب from ت from ث; it is part of the letter, not a
    // mark a reader is told to notice. The corpus draws 105,269 of them under
    // data-dots and this vocabulary deliberately cannot name one.
    for (const dots of ["one dot", "two dots", "three dots"]) {
      expect(isDiacriticName(dots)).toBe(false);
    }
  });
});
