import { describe, expect, it } from "vitest";
import { commentaryFor, type PitchSurah } from "./pitch";

// A made-up surah: the shape of the private file, none of its words.
const surah: PitchSurah = {
  surah: 2,
  title: "Title",
  intro: ["first paragraph", "second paragraph"],
  verses: {
    "2:1": { ref: "2:1", key: "quran/hafs-kfqc/2:1", translation: "t1", commentary: ["c1"] },
    "2:255": { ref: "2:255", key: "quran/hafs-kfqc/2:255", translation: "t2", commentary: ["c2"] },
  },
  shard: {},
};

describe("pitch · commentaryFor", () => {
  it("the surah's context leads only the opening verse's note", () => {
    expect(commentaryFor(surah, "quran/hafs-kfqc/2:1")?.showIntro).toBe(true);
    expect(commentaryFor(surah, "quran/hafs-kfqc/2:255")?.showIntro).toBe(false);
  });

  it("a link that asks for the context gets it on any verse (?open=context)", () => {
    const entry = commentaryFor(surah, "quran/hafs-kfqc/2:255", true);
    expect(entry?.showIntro).toBe(true);
    expect(entry?.intro).toEqual(surah.intro);
    expect(entry?.verse.ref).toBe("2:255");
  });

  it("nothing to show without a surah, a selection, or a note for the verse", () => {
    expect(commentaryFor(null, "quran/hafs-kfqc/2:1", true)).toBeNull();
    expect(commentaryFor(surah, null, true)).toBeNull();
    expect(commentaryFor(surah, "quran/hafs-kfqc/2:2", true)).toBeNull();
  });
});
