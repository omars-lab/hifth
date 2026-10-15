import { describe, expect, it } from "vitest";
import { spokenName } from "./spoken-name";

describe("a button's spoken name holds the word it shows", () => {
  it("keeps a name that already says the word, whatever its case or marks", () => {
    expect(spokenName("Listen to Verse 3", "Listen", " · ")).toBe("Listen to Verse 3");
    expect(spokenName("Jump: say where it took you", "Jump…", " · ")).toBe("Jump: say where it took you");
    expect(spokenName("open it on the site", "On the site", " · ")).toBe("open it on the site");
  });

  it("leads with the word when the name never says it", () => {
    expect(spokenName("Listen to Verse 3", "Offline", " · ")).toBe("Offline · Listen to Verse 3");
    expect(spokenName("كلمة أخرى", "كلمة ثالثة", "، ")).toBe("كلمة ثالثة، كلمة أخرى");
  });

  it("leaves the name alone when no word is shown", () => {
    expect(spokenName("Listen to Verse 3", undefined, " · ")).toBe("Listen to Verse 3");
    expect(spokenName("Listen to Verse 3", "", " · ")).toBe("Listen to Verse 3");
  });
});
