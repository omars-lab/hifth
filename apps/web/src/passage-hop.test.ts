import { afterEach, describe, expect, it } from "vitest";
import { PASSAGE_HOP_KEY, passageLanding, rememberPassageHop, savedPassageHop } from "./passage-hop";

describe("where a passage row's arrow lands, as the reader set it", () => {
  afterEach(() => localStorage.clear());

  // The owner's pick, 2026-10-12 (lookalike-rows item 17): the arrow lands on
  // the verse the row names as most alike, not the passage's first verse.
  it("lands on the most-alike verse when nobody chose, and keeps the choice made", () => {
    expect(savedPassageHop()).toBe("alike");
    rememberPassageHop("first");
    expect(localStorage.getItem(PASSAGE_HOP_KEY)).toBe("first");
    expect(savedPassageHop()).toBe("first");
  });

  it("a value it does not know falls back to the most-alike verse", () => {
    localStorage.setItem(PASSAGE_HOP_KEY, "nonsense");
    expect(savedPassageHop()).toBe("alike");
  });

  it("a passage lands on its most-alike verse, or its first if the reader chose that", () => {
    const passage = { to: "9:10", like: { to: "9:12", page: 3 } };
    expect(passageLanding(passage, "alike")).toBe("9:12");
    expect(passageLanding(passage, "first")).toBe("9:10");
  });

  it("a single verse lands on itself either way", () => {
    expect(passageLanding({ to: "9:10" }, "alike")).toBe("9:10");
    expect(passageLanding({ to: "9:10" }, "first")).toBe("9:10");
  });
});
