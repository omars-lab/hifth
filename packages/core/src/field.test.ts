import { describe, expect, it } from "vitest";
import { DEFAULT_FIELD, FIELDS, isFieldId, parseField } from "./field.js";

describe("field · the table", () => {
  it("has no duplicates and a default that is one of its own members", () => {
    expect(new Set(FIELDS).size).toBe(FIELDS.length);
    expect(FIELDS).toContain(DEFAULT_FIELD);
  });

  it("ids are link-safe — they travel in a URL untouched", () => {
    // Anything needing percent-encoding would make the same field serialize two
    // ways, and a link is only stable if it has one spelling.
    for (const id of FIELDS) expect(encodeURIComponent(id)).toBe(id);
  });

  it("isFieldId accepts every member and nothing else", () => {
    for (const id of FIELDS) expect(isFieldId(id)).toBe(true);
    for (const no of ["", "SUNK", "sunk ", "paper", "tan;rm", "__proto__"]) {
      expect(isFieldId(no), no).toBe(false);
    }
  });
});

describe("field · parseField never refuses", () => {
  it("returns the named field", () => {
    for (const id of FIELDS) expect(parseField(id)).toBe(id);
  });

  it("falls back for absent, empty and unknown values", () => {
    // The whole reason this is not a `| null`: every caller of this function is
    // about to paint a surface, and there is no such thing as painting nothing.
    expect(parseField(null)).toBe(DEFAULT_FIELD);
    expect(parseField(undefined)).toBe(DEFAULT_FIELD);
    expect(parseField("")).toBe(DEFAULT_FIELD);
    expect(parseField("neon")).toBe(DEFAULT_FIELD);
    expect(parseField("Tan")).toBe(DEFAULT_FIELD);
  });

  it("a retired field opens on the winner instead of failing", () => {
    // `sunk`, `linen` and `slate` were candidates while the desk was an open
    // question; `tan` won and they were removed. Any link written during that
    // window still names an ayah, and that is the part worth keeping — this is
    // exactly the case the tolerant parse exists for, and the reason retiring an
    // id is a safe move while retiring a `w=` or `via=` value would not be.
    for (const gone of ["sunk", "linen", "slate"]) {
      expect(parseField(gone), gone).toBe(DEFAULT_FIELD);
    }
  });
});
