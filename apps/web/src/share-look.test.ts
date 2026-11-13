import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_SHARE_LOOK, SHARE_LOOK_KEY, rememberShareLook, savedShareLook, shortAddress } from "./share-look";

afterEach(() => localStorage.clear());

describe("share look", () => {
  it("starts on the preview card and remembers a choice", () => {
    expect(savedShareLook()).toBe(DEFAULT_SHARE_LOOK);
    expect(DEFAULT_SHARE_LOOK).toBe("preview");
    rememberShareLook("tiles");
    expect(savedShareLook()).toBe("tiles");
  });

  it("falls back to the default for a value it does not know", () => {
    localStorage.setItem(SHARE_LOOK_KEY, "neon");
    expect(savedShareLook()).toBe(DEFAULT_SHARE_LOOK);
  });
});

describe("shortAddress", () => {
  it("drops the scheme and keeps a short address whole", () => {
    expect(shortAddress("https://hifth.app/read/#/hafs-kfqc/2:48")).toBe("hifth.app/read/#/hafs-kfqc/2:48");
  });

  it("cuts a long address in the middle, keeping its site and its verse", () => {
    const s = shortAddress("https://blog.bytesofpurpose.com/hifth/#/hafs-kfqc/2:48?open=lookalikes", 30);
    expect(s).toHaveLength(30);
    expect(s.startsWith("blog.bytes")).toBe(true);
    expect(s.endsWith("lookalikes")).toBe(true);
    expect(s).toContain("…");
  });
});
