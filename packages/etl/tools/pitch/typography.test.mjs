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

  it("closes up a space the capture left doubled, or before a comma, semicolon or closing stop", () => {
    expect(setTypography("the old  road")).toBe("the old road");
    expect(setTypography("the hills ; the plain , the sea")).toBe("the hills; the plain, the sea");
    expect(setTypography("as the river (Ab) .")).toBe("as the river (Ab).");
  });

  it("keeps the book's own space between an ellipsis and the mark after it", () => {
    expect(setTypography("rain . . . , and wind … , then . . . .")).toBe("rain . . . , and wind … , then . . . .");
  });

  it("reads a lone chapter and verse the capture wrote with a semicolon as the colon the book prints", () => {
    expect(setTypography("see 12;30; and (40;8) or 9;4.")).toBe("see 12:30; and (40:8) or 9:4.");
  });

  it("leaves a semicolon in a list of verses, or after a number that is not a surah, alone", () => {
    expect(setTypography("see 2:10; 20; 30 and 4:5;6")).toBe("see 2:10; 20; 30 and 4:5;6");
    expect(setTypography("in 1200;30 and 115;2")).toBe("in 1200;30 and 115;2");
  });

  it("puts back the space the capture lost after a semicolon before the next citation", () => {
    expect(setTypography("see 3:12;40:7 and 5:6")).toBe("see 3:12; 40:7 and 5:6");
  });

  it("closes up a space the capture put after a colon, in a reference listed after another", () => {
    expect(setTypography("see 4:1–2; 9:3; 12: 30, and")).toBe("see 4:1–2; 9:3; 12:30, and");
    // Not in prose, where a number and a colon start a list.
    expect(setTypography("in 12: 30 men")).toBe("in 12: 30 men");
  });

  it("leaves text with nothing to set unchanged", () => {
    expect(setTypography("“Already” curly, 4:2–5.")).toBe("“Already” curly, 4:2–5.");
  });
});
