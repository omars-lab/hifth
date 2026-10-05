import { describe, expect, it } from "vitest";
import { joinPageBreaks } from "./blocks.mjs";

// Made-up words throughout: no held text in the repository. Each "tail" is long
// enough to be a real repeat, the way the capture repeats a paragraph that runs
// over the foot of a printed page.
const TAIL = "The second paragraph tells of the long road home, and of the well the travellers found on the third day, which";
const WHOLE = "The second paragraph tells of the long road home, and of the well the travellers found on the third day, which gave them water. After that they rested.";

describe("a note that runs over the foot of a printed page", () => {
  it("reads the repeated paragraph once, in full, where the page break cut it", () => {
    expect(joinPageBreaks([`The first paragraph opens the note. ${TAIL}`, `${WHOLE} The note ends here.`])).toEqual([
      `The first paragraph opens the note. ${WHOLE} The note ends here.`,
    ]);
  });

  it("keeps a full stop the repeat lost, and leaves off the stray numbers at the foot of the page", () => {
    const first = "The first paragraph opens the note. The travellers were held to account for every step they took on the way.";
    const again = "The travellers were held to account for every step they took on the way After that they rested.";
    expect(joinPageBreaks([first, again])).toEqual([
      "The first paragraph opens the note. The travellers were held to account for every step they took on the way. After that they rested.",
    ]);
    const junk = "The first paragraph opens the note. The travellers were held to account for every step they took on 4 56 69 40:4c 56";
    const fixed = "The travellers were held to account for every step they took on the way home. After that they rested.";
    expect(joinPageBreaks([junk, fixed])).toEqual([
      "The first paragraph opens the note. The travellers were held to account for every step they took on the way home. After that they rested.",
    ]);
  });

  it("drops a paragraph that only repeats one already shown", () => {
    expect(joinPageBreaks([`One. ${WHOLE}`, WHOLE, "Three."])).toEqual([`One. ${WHOLE}`, "Three."]);
  });

  it("leaves a note alone when nothing repeats, even if two paragraphs share a few words", () => {
    const note = ["God is the Maker of all.", "God is the Maker of the heavens, the text says again later.", "Short."];
    expect(joinPageBreaks(note)).toEqual(note);
  });
});
