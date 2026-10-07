import { describe, expect, it } from "vitest";
import { splitSigla } from "./sigla";

// Made-up initials and prose: the book's own key is held, and stays out of the code.
const KNOWN = new Set(["Xy", "Q", "Ṭz"]);
const found = (text: string) =>
  splitSigla(text, KNOWN).flatMap((part) => (typeof part === "string" ? [] : [part.sig]));

describe("a commentator's initials in the commentary prose", () => {
  it("finds every known initial in a bracket, however they are separated", () => {
    expect(found("Some say so (Xy, Ṭz); others not (Q).")).toEqual(["Xy", "Ṭz", "Q"]);
    expect(found("as the word has it (kalimah; Q, Xy)")).toEqual(["Q", "Xy"]);
    expect(found("(Xy; see 2:255; 3:7)")).toEqual(["Xy"]);
  });

  it("keeps every word of the prose, in order, around the initials", () => {
    const text = "Some say so (Xy,  Ṭz; see v. 4); others not.";
    expect(splitSigla(text, KNOWN).map((p) => (typeof p === "string" ? p : p.text)).join("")).toBe(text);
  });

  it("leaves initials the key does not have, and capitals outside brackets, as text", () => {
    expect(found("(XY, Zz) and Q said it, as Xy did")).toEqual([]);
    expect(found("(Q said so)")).toEqual([]);
  });

  it("matches the initials however their accents were typed", () => {
    expect(found("(Ṭz)")).toEqual(["Ṭz"]);
  });

  it("tells which initials share a bracket, so a tap on one can name them all", () => {
    const brackets = splitSigla("Some say so (Xy, Ṭz); others not (Q).", KNOWN).flatMap((part) =>
      typeof part === "string" ? [] : [part.bracket],
    );
    expect(brackets[0]).toBe(brackets[1]);
    expect(brackets[2]).not.toBe(brackets[0]);
  });

  it("is the prose untouched when there is no key", () => {
    expect(splitSigla("(Xy, Q)", new Set())).toEqual(["(Xy, Q)"]);
  });
});
