import { describe, expect, it } from "vitest";
import { splitCitations } from "./citations";

const cited = (text: string) =>
  splitCitations(text).flatMap((part) => (typeof part === "string" ? [] : [part]));

describe("verse citations in the commentary prose", () => {
  it("finds a plain citation, a range, and a note-lettered one", () => {
    expect(cited("see 1:6c, and 5:15–16; cf. 2:255.")).toEqual([
      { text: "1:6c", surah: 1, ayah: 6 },
      { text: "5:15–16", surah: 5, ayah: 15 },
      { text: "2:255", surah: 2, ayah: 255 },
    ]);
  });

  it("keeps every word of the prose, in order, around the links", () => {
    const parts = splitCitations("See also 5:15–16: There has come");
    expect(parts.map((p) => (typeof p === "string" ? p : p.text)).join("")).toBe(
      "See also 5:15–16: There has come",
    );
  });

  it("leaves a number that is not a verse as text", () => {
    // No surah 0 or 115; al-Fātiḥah has no eighth verse.
    expect(cited("at 0:3, 115:2 and 1:8")).toEqual([]);
  });

  it("returns the text whole when nothing is cited", () => {
    expect(splitCitations("no verses here")).toEqual(["no verses here"]);
  });
});
