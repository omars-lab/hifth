import { describe, expect, it } from "vitest";
import {
  ADDRESSES,
  LATER_MS,
  MOVED_SHEET_ON,
  addressesFor,
  carryMessage,
  newerSeam,
  sheetOn,
  sheetShows,
  sheetState,
} from "./moved";

const DAY = 24 * 60 * 60 * 1000;
const base = { on: true, native: false, origin: ADDRESSES.old, laterAt: null, now: 1_000 * DAY, addresses: ADDRESSES };

describe("where Hifth lived, and where it lives now", () => {
  it("is the blog address before, and hifth.app/read after", () => {
    expect(ADDRESSES).toEqual({
      old: "https://blog.bytesofpurpose.com",
      next: "https://hifth.app",
      page: "https://hifth.app/read/",
    });
  });

  it("takes stand-in addresses only on a page served over plain http, the way a test serves it", () => {
    const stored = JSON.stringify({ old: "http://127.0.0.1:4180", next: "http://localhost:4180" });
    expect(addressesFor("http:", stored)).toEqual({
      old: "http://127.0.0.1:4180",
      next: "http://localhost:4180",
      page: "http://localhost:4180/",
    });
    const withPage = JSON.stringify({ old: "http://a.test", next: "http://b.test", page: "http://b.test/read/" });
    expect(addressesFor("http:", withPage).page).toBe("http://b.test/read/");
    // On the real sites, served over https, a stored value is never read.
    expect(addressesFor("https:", stored)).toBe(ADDRESSES);
  });

  it("keeps the sheet off on the real sites until the switch is flipped", () => {
    expect(MOVED_SHEET_ON).toBe(false);
    expect(sheetOn(ADDRESSES)).toBe(false);
    expect(sheetOn(addressesFor("http:", JSON.stringify({ old: "http://a.test", next: "http://b.test" })))).toBe(true);
  });

  it("refuses a stand-in that is not a bare web address", () => {
    for (const bad of [
      "not json",
      JSON.stringify({ old: "http://127.0.0.1:4180" }),
      JSON.stringify({ old: "http://127.0.0.1:4180/hifth/", next: "http://localhost:4180" }),
      JSON.stringify({ old: "javascript:alert(1)", next: "http://localhost:4180" }),
      JSON.stringify({ old: "*", next: "http://localhost:4180" }),
      JSON.stringify({ old: "http://a.test", next: "http://b.test", page: "https://elsewhere.test/" }),
      JSON.stringify({ old: "http://a.test", next: "http://b.test", page: "http://b.test/#/carry" }),
    ]) {
      expect(addressesFor("http:", bad)).toEqual(ADDRESSES);
    }
    expect(addressesFor("http:", null)).toEqual(ADDRESSES);
  });
});

describe("when the 'Hifth has moved' sheet shows", () => {
  it("shows at the old address, in a browser, with the switch on", () => {
    expect(sheetShows(base)).toBe(true);
  });

  it("never shows while the switch is off", () => {
    expect(sheetShows({ ...base, on: false })).toBe(false);
  });

  it("never shows in the iPad or Mac app", () => {
    expect(sheetShows({ ...base, native: true })).toBe(false);
  });

  it("never shows at the new address, or anywhere else", () => {
    expect(sheetShows({ ...base, origin: ADDRESSES.next })).toBe(false);
    expect(sheetShows({ ...base, origin: "http://localhost:5173" })).toBe(false);
  });

  it("stays away for a week after 'Later', then comes back", () => {
    expect(sheetShows({ ...base, laterAt: base.now - 1 })).toBe(false);
    expect(sheetShows({ ...base, laterAt: base.now - LATER_MS + 1 })).toBe(false);
    expect(sheetShows({ ...base, laterAt: base.now - LATER_MS })).toBe(true);
  });

  it("offers to carry the marks until they have gone, and to open hifth.app after", () => {
    expect(sheetState(null)).toBe("carry");
    expect(sheetState("5")).toBe("open");
    expect(sheetState("0")).toBe("open");
    expect(sheetState("nonsense")).toBe("carry");
  });
});

describe("the messages the two pages pass", () => {
  const opener = {};
  const stranger = {};

  it("takes a message only from the exact address and window it expects", () => {
    const ready = { origin: ADDRESSES.next, source: opener, data: { type: "hifth-carry-ready" } };
    expect(carryMessage(ready, ADDRESSES.next, opener)).toEqual({ type: "hifth-carry-ready" });
    expect(carryMessage({ ...ready, origin: "https://hifth.app.evil.example" }, ADDRESSES.next, opener)).toBeNull();
    expect(carryMessage({ ...ready, source: stranger }, ADDRESSES.next, opener)).toBeNull();
  });

  it("takes the file only as text, and the count only as a whole number", () => {
    const at = { origin: ADDRESSES.old, source: opener };
    expect(carryMessage({ ...at, data: { type: "hifth-carry", file: "{}" } }, ADDRESSES.old, opener)).toEqual({
      type: "hifth-carry",
      file: "{}",
    });
    expect(carryMessage({ ...at, data: { type: "hifth-carry", file: { a: 1 } } }, ADDRESSES.old, opener)).toBeNull();
    expect(carryMessage({ ...at, data: { type: "hifth-carry-done", added: 3 } }, ADDRESSES.old, opener)).toEqual({
      type: "hifth-carry-done",
      added: 3,
    });
    expect(carryMessage({ ...at, data: { type: "hifth-carry-done", added: -1 } }, ADDRESSES.old, opener)).toBeNull();
    expect(carryMessage({ ...at, data: { type: "something-else" } }, ADDRESSES.old, opener)).toBeNull();
    expect(carryMessage({ ...at, data: "hifth-carry" }, ADDRESSES.old, opener)).toBeNull();
  });

  it("takes the place the reader left off when it is whole, and the marks either way", () => {
    const at = { origin: ADDRESSES.old, source: opener };
    const carry = (seam: unknown) =>
      carryMessage({ ...at, data: { type: "hifth-carry", file: "{}", seam } }, ADDRESSES.old, opener);
    expect(carry({ page: 250, at: 2_000 })).toEqual({ type: "hifth-carry", file: "{}", seam: { page: 250, at: 2_000 } });
    // A place in the wrong shape is dropped; the file still comes across.
    for (const bad of [{ page: 0, at: 1 }, { page: 2.5, at: 1 }, { page: "250", at: 1 }, { page: 250 }, "p250", null])
      expect(carry(bad)).toEqual({ type: "hifth-carry", file: "{}" });
    // Only the two fields are kept, whatever else rides along.
    expect(carry({ page: 3, at: 4, extra: "x" })).toEqual({ type: "hifth-carry", file: "{}", seam: { page: 3, at: 4 } });
  });
});

describe("which place the new address keeps", () => {
  it("keeps whichever moved last, and the carried one when the new address has none", () => {
    const old = { page: 250, at: 2_000 };
    expect(newerSeam(null, old)).toEqual(old);
    expect(newerSeam({ page: 300, at: 5_000 }, old)).toEqual({ page: 300, at: 5_000 });
    expect(newerSeam({ page: 9, at: 1_000 }, old)).toEqual(old);
    expect(newerSeam({ page: 9, at: 1_000 }, undefined)).toEqual({ page: 9, at: 1_000 });
    expect(newerSeam(null, undefined)).toBeNull();
  });
});
