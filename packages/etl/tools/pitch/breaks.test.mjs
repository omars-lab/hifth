import { describe, expect, it } from "vitest";
import { dropRaisedEndings, restoreBreaks, seams, seamPrint } from "./breaks.mjs";

// Made-up words throughout: no held text in the repository.
const NOTE = "The travellers rested by the well on the third day and gave thanks for the water The next morning they set out again.";
const at = (text, words) => seams(text).find((s) => text.slice(s.at - words.length, s.at) === words);

describe("where the capture lost a full stop the printed page has", () => {
  it("puts the stop back and starts the new paragraph the print starts", () => {
    const seam = at(NOTE, "for the water");
    const { blocks, used } = restoreBreaks("9:9", [NOTE], [{ verse: "9:9", print: seamPrint(NOTE, seam.at), kind: "break" }]);
    expect(blocks).toEqual([
      "The travellers rested by the well on the third day and gave thanks for the water.",
      "The next morning they set out again.",
    ]);
    expect(used).toEqual(new Set([0]));
  });

  it("puts the stop back inside the paragraph when the print runs on", () => {
    const seam = at(NOTE, "for the water");
    const { blocks } = restoreBreaks("9:9", [NOTE], [{ verse: "9:9", print: seamPrint(NOTE, seam.at), kind: "stop" }]);
    expect(blocks).toEqual(["The travellers rested by the well on the third day and gave thanks for the water. The next morning they set out again."]);
  });

  it("leaves a seam alone when the list does not name it, or names it under another verse", () => {
    const seam = at(NOTE, "for the water");
    const { blocks, used } = restoreBreaks("9:9", [NOTE], [{ verse: "9:10", print: seamPrint(NOTE, seam.at), kind: "break" }]);
    expect(blocks).toEqual([NOTE]);
    expect(used.size).toBe(0);
  });

  it("puts back the question mark the print ends on, and nothing where the stop survived", () => {
    const asked = "Who will carry the water up the hill Nobody answered.";
    const kept = "The well was dry. The travellers went on.";
    const marks = [
      { verse: "9:9", print: seamPrint(asked, at(asked, "up the hill").at), kind: "break", stop: "?" },
      { verse: "9:9", print: seamPrint(kept, at(kept, "was dry.").at), kind: "break", stop: "" },
    ];
    expect(restoreBreaks("9:9", [asked, kept], marks).blocks).toEqual([
      "Who will carry the water up the hill?",
      "Nobody answered.",
      "The well was dry.",
      "The travellers went on.",
    ]);
  });

  it("offers every space that runs into a capital", () => {
    expect(seams("One. Two three Four (five) Six").map((s) => s.at)).toEqual([4, 14, 26]);
  });

  it("names a seam without carrying the words around it", () => {
    const print = seamPrint(NOTE, at(NOTE, "for the water").at);
    expect(print).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe("vowel endings the print raises above a word", () => {
  it("drops them where the capture set them down as stray letters", () => {
    expect(dropRaisedEndings("an an The well was dry.")).toBe("The well was dry.");
    expect(dropRaisedEndings("They drank (from the well). an The road went on.")).toBe("They drank (from the well). The road went on.");
    expect(dropRaisedEndings("The call ends here. u an u an Although they rested.")).toBe("The call ends here. Although they rested.");
    expect(dropRaisedEndings("Great is the Maker!). u u Great is the Maker!")).toBe("Great is the Maker!). Great is the Maker!");
  });

  it("drops the long-vowel marks of the line above, set down as two or more lone vowels", () => {
    expect(dropRaisedEndings("as when one walks the road; Tr). a u About this road the elder said.")).toBe(
      "as when one walks the road; Tr). About this road the elder said.",
    );
    expect(dropRaisedEndings("The well was dry. i a u Then they left.")).toBe("The well was dry. Then they left.");
  });

  it("keeps a lone article after a stop, as in an abbreviation", () => {
    const note = "Some travellers, e.g. a Bedouin, knew the well. See 4:2. I said so.";
    expect(dropRaisedEndings(note)).toBe(note);
  });

  it("leaves ordinary words alone", () => {
    const note = "It is called “water” in English, and (an old word) an Arab would know. In Egypt it is (ṣalāh) in Islam.";
    expect(dropRaisedEndings(note)).toBe(note);
  });
});
