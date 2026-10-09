import { describe, expect, it, vi } from "vitest";
import { revealBy, revealRow } from "./reveal";

// Made-up edges, in pixels down the screen: a list showing 100 to 500.
const PORT = { top: 100, bottom: 500 };

describe("revealBy", () => {
  it("leaves a row that is already wholly in view where it is", () => {
    expect(revealBy({ top: 120, bottom: 480 }, PORT)).toBe(0);
  });

  it("moves a row that runs past the foot up just far enough to show it whole", () => {
    expect(revealBy({ top: 300, bottom: 620 }, PORT)).toBe(120);
  });

  it("lines up the top of a row too tall to show whole, so its name is in view", () => {
    expect(revealBy({ top: 300, bottom: 900 }, PORT)).toBe(200);
  });

  it("brings down a row whose top is above the list's edge", () => {
    expect(revealBy({ top: 40, bottom: 200 }, PORT)).toBe(-60);
  });
});

describe("revealRow", () => {
  const at = (top: number, bottom: number) => () => ({ top, bottom }) as DOMRect;

  // A list whose title is pinned over its rows: on a phone the title rides
  // inside the scrolling sheet, so a row lined up with the sheet's top edge
  // sat under the title (walking a phone, 2026-10-09).
  function list(pinned: boolean) {
    document.body.innerHTML = `
      <div id="sheet" style="overflow-y: auto">
        <header style="position: ${pinned ? "sticky" : "static"}">Title</header>
        <ul><li id="row"><div id="compare"></div></li></ul>
      </div>`;
    const sheet = document.getElementById("sheet")!;
    sheet.getBoundingClientRect = at(100, 500);
    document.querySelector("header")!.getBoundingClientRect = at(90, 160);
    document.getElementById("row")!.getBoundingClientRect = at(300, 900);
    const scrollBy = vi.fn();
    sheet.scrollBy = scrollBy;
    revealRow(document.getElementById("compare")!);
    return scrollBy.mock.calls[0]?.[0] as ScrollToOptions | undefined;
  }

  it("lines a tall row up under a pinned title, not under the sheet's edge", () => {
    expect(list(true)).toMatchObject({ top: 140 });
  });

  it("lines it up with the sheet's edge when the title scrolls away with the rows", () => {
    expect(list(false)).toMatchObject({ top: 200 });
  });
});
