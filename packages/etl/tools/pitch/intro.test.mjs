import { describe, expect, it } from "vitest";
import { cleanIntro } from "./intro.mjs";

// Made-up words throughout: no held text in the repository. `OPENING` stands
// for the book's translation of the opening verse, which the capture repeats
// at the foot of every surah's introduction, as the print does above the verses.
const OPENING = "By the Name of the Maker, the Kind, the Good.";

describe("a surah's introduction, as the note shows it", () => {
  it("leaves off the opening verse the print sets under the introduction", () => {
    expect(cleanIntro(["This surah came early.", "By the Name of the Maker, the Kind, the Good"], OPENING)).toEqual([
      "This surah came early.",
    ]);
  });

  it("drops a broken-off end of a word, which is all some captures kept", () => {
    expect(cleanIntro(["ly."], OPENING)).toEqual([]);
    expect(cleanIntro(["ly.", OPENING], OPENING)).toEqual([]);
  });

  it("marks an introduction that begins partway through as an excerpt", () => {
    expect(cleanIntro(["Finally, the three stories meet.", OPENING], OPENING)).toEqual([
      "… Finally, the three stories meet.",
    ]);
    expect(cleanIntro(["of the people of the town, who stayed.", "A new paragraph."], OPENING)).toEqual([
      "… of the people of the town, who stayed.",
      "A new paragraph.",
    ]);
  });

  it("keeps a short quoted line inside an introduction, and a whole one as it is", () => {
    const whole = ["This surah is from the early years.", "“Yes.”", "And so it ends."];
    expect(cleanIntro(whole, OPENING)).toEqual(whole);
  });

  it("is empty when there is nothing but the opening verse", () => {
    expect(cleanIntro([OPENING], OPENING)).toEqual([]);
  });
});
