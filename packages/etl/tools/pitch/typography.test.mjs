import { describe, expect, it } from "vitest";
import { setTypography } from "./typography.mjs";

// Made-up notes: the shape of the commentary, none of its words.
const S = ""; // a slanted run opens
const E = ""; // and closes

describe("setTypography", () => {
  it("prints a verse range with an en dash, as the book does", () => {
    expect(setTypography("see 4:2-5 and 7:10-12; also 3, 9-11")).toBe("see 4:2–5 and 7:10–12; also 3, 9–11");
  });

  it("leaves a hyphen between words alone", () => {
    expect(setTypography("the well-kept road, the n-r-d root")).toBe("the well-kept road, the n-r-d root");
  });

  it("curls double quotes, opening after a space or a bracket and closing after a word or a stop", () => {
    expect(setTypography('He said "go home." Then ("rest") came.')).toBe("He said “go home.” Then (“rest”) came.");
    expect(setTypography('"Begin," it said.')).toBe("“Begin,” it said.");
  });

  it("curls an apostrophe inside or after a word as a closing mark", () => {
    expect(setTypography("the town's well, the towns' wells")).toBe("the town’s well, the towns’ wells");
  });

  it("curls a single quote that opens a quotation", () => {
    expect(setTypography("he wrote 'come.' and left")).toBe("he wrote ‘come.’ and left");
    expect(setTypography("“a ‘b’ c”")).toBe("“a ‘b’ c”");
  });

  it("reads the slant's marks as part of the line, a quote opening one and closing after one", () => {
    expect(setTypography(`as in "${S}the rain${E}" and ${S}"wind"${E}`)).toBe(`as in “${S}the rain${E}” and ${S}“wind”${E}`);
  });

  it("leaves a quote mark between two letters for a hand-read fix, since it is a misread letter, not a quote", () => {
    expect(setTypography('the word abc"n here')).toBe('the word abc"n here');
  });

  it("leaves text with nothing to set unchanged", () => {
    expect(setTypography("“Already” curly, 4:2–5.")).toBe("“Already” curly, 4:2–5.");
  });
});
