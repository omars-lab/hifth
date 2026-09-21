import { describe, expect, it } from "vitest";
import { qulVerseUrl } from "./qul";

// `qulVerseUrl` addresses QUL's verse pages by the ayah's ABSOLUTE position in
// the mus'haf, not its number within the surah — so 2:1 is verse 8, not verse 1
// (Al-Fatiha's seven ayat come first). These pin that offset and the one case
// that has no verse page: a key pointing at a word or a range.
describe("qulVerseUrl", () => {
  it("uses the absolute ayah number, counting from the start of the mus'haf", () => {
    expect(qulVerseUrl("quran/hafs-kfqc/1:1")).toBe("https://qul.tarteel.ai/cms/verses/1");
    // Al-Fatiha (7) sits before Al-Baqara, so 2:1 is the 8th ayah overall.
    expect(qulVerseUrl("quran/hafs-kfqc/2:1")).toBe("https://qul.tarteel.ai/cms/verses/8");
    expect(qulVerseUrl("quran/hafs-kfqc/2:255")).toBe("https://qul.tarteel.ai/cms/verses/262");
    // The very last ayah is 6236 of 6236.
    expect(qulVerseUrl("quran/hafs-kfqc/114:6")).toBe("https://qul.tarteel.ai/cms/verses/6236");
  });

  it("does not depend on the edition — the ayah's place in the book is the same", () => {
    expect(qulVerseUrl("quran/qpc-v4/2:1")).toBe("https://qul.tarteel.ai/cms/verses/8");
  });

  it("returns null for a key that is not a bare ayah", () => {
    expect(qulVerseUrl("quran/hafs-kfqc/2:48#w3")).toBeNull();
    expect(qulVerseUrl("quran/hafs-kfqc/2:48#w3-7")).toBeNull();
    expect(qulVerseUrl("root/ktb")).toBeNull();
    expect(qulVerseUrl("")).toBeNull();
  });
});
