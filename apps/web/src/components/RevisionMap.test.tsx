import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PageMeta } from "@hifth/core";
import { forgetRecord, recordLook } from "../revision-store";
import { RevisionMap, holdings } from "./RevisionMap";

/*
 * The picture is tested against the real store (fake-indexeddb runs the actual
 * spec) rather than a stubbed `readRecord`, because the one thing this component
 * must never do is show a confident picture of a record it did not really read.
 *
 * `today` is injected on every render. A suite that let the ambient clock decide
 * the warmth bands would pass today and start reporting different colours next
 * month — the same reason `revision.ts` is clockless and the store takes `now`.
 */

const EDITION = "hafs-kfqc";

/** A vendored page carrying one span of ayahs, in the shape the manifest has. */
function page(n: number, surah: number, from: number, to: number): PageMeta {
  const polygons = [];
  for (let ayah = from; ayah <= to; ayah++) {
    polygons.push({
      elementId: `p${n}-${ayah}`,
      number: ayah,
      surah,
      ayah,
      key: `quran/${EDITION}/${surah}:${ayah}`,
    });
  }
  return { edition: EDITION, page: n, viewBox: "0 0 100 100", polygons };
}

/**
 * A stand-in for page 7 — Al-Baqarah 2:38–2:48, which is the run the extractor
 * actually emits for it, and all of it inside hizb 1. A fixture rather than the
 * real manifest, so the inventory these tests reason about is fixed at one page
 * and does not silently change with what is vendored. It earned that: Loop 4b
 * vendored the other 601 and not a line of this file moved.
 */
const PAGE_7 = page(7, 2, 38, 48);

const at = (iso: string) => Date.parse(iso);
const TODAY = "2026-03-20";

function draw(over: Partial<React.ComponentProps<typeof RevisionMap>> = {}) {
  render(
    <RevisionMap
      open
      onClose={() => {}}
      pages={[PAGE_7]}
      edition={EDITION}
      totalPages={604}
      page={7}
      onGoToPage={() => {}}
      today={TODAY}
      {...over}
    />,
  );
}

/**
 * The grid cells, in division order, once the record has been read.
 *
 * `waitFor` rather than a bare query because the sheet reads the store in an
 * effect and says «جارٍ فتح السجلّ…» until it lands — deliberately, so that
 * "still opening" and "opened, and empty" are not the same picture.
 *
 * Queried by `data-state` rather than by role, because a cell is one of two
 * elements now: a division with paper behind it is a `<button>` inside its list
 * item, and an absent one is the bare item (RevisionMap.tsx). Every cell carries
 * the attribute, document order is division order either way, and a query that
 * asked for one role would silently stop counting half the map.
 */
function cells(): Promise<HTMLElement[]> {
  return waitFor(() => {
    // Named, not "the first list": the legend beside it is also a list of cells,
    // and a query that could pick either would pass for the wrong reason.
    const grid = screen.getByRole("list", { name: "خريطة المصحف" });
    const drawn = Array.from(grid.querySelectorAll<HTMLElement>("[data-state]"));
    // `waitFor` retries on a throw, and `querySelectorAll` never throws — it
    // answers "nothing yet" with an empty list. Without this the helper would
    // return `[]` on the first tick and every assertion after it would be made
    // against a grid that had not been drawn.
    if (drawn.length === 0) throw new Error("the grid has not been drawn yet");
    return drawn;
  });
}

beforeEach(async () => {
  await forgetRecord();
});

describe("holdings", () => {
  it("asks the same function the record asks", () => {
    // Not an implementation detail — it is the whole reason `holdings` exists as
    // a pseudo-event rather than as its own page→hizb table. Page 7 sits inside
    // hizb 1 and juz 1, and `scopesOf` is what says so in both directions.
    expect([...holdings([PAGE_7], "hizb").keys()]).toEqual([1]);
    expect([...holdings([PAGE_7], "juz").keys()]).toEqual([1]);
    expect([...holdings([PAGE_7], "page").keys()]).toEqual([7]);
  });

  it("holds both divisions when a page straddles the boundary", () => {
    // Hizb 2 opens at 2:75. A page running 2:70–2:80 is paper for both, and a
    // map that credited only the ayah it happened to look at first would draw a
    // hizb as absent that the reader can in fact reach.
    expect([...holdings([page(13, 2, 70, 80)], "hizb").keys()]).toEqual([1, 2]);
  });

  it("opens a division on the lowest page we hold for it, whatever order it was given", () => {
    // The destination of a tap (revision-record.md ②). Hizb 1 runs from page 1,
    // so three vendored pages of it open at the lowest — and the answer must not
    // depend on the manifest's array order, which nothing in `PageMeta`'s type
    // promises and no gate checks. Fed backwards on purpose: a `first one wins`
    // implementation passes the ascending case and lands a reader at the wrong
    // end of a juz the first time a manifest is written another way.
    const backwards = [page(9, 2, 60, 69), page(7, 2, 38, 48), page(5, 2, 20, 29)];
    expect(holdings(backwards, "hizb").get(1)).toBe(5);
    expect(holdings(backwards, "juz").get(1)).toBe(5);
    // At page scope a division *is* a page, so the cell opens itself.
    expect(holdings(backwards, "page").get(9)).toBe(9);
  });
});

describe("RevisionMap", () => {
  it("draws absent as a different kind of thing from cold, not a paler one", async () => {
    // The finding this whole component is shaped around, held here against a
    // one-page fixture: if the pages a reader cannot reach look like pages they
    // neglected, the picture says they have abandoned the Qur'an. Absent and cold must
    // differ in state, not in opacity — and the difference has to reach a screen
    // reader, who cannot see either treatment.
    draw();
    const grid = await cells();
    expect(grid).toHaveLength(60);

    const hizb1 = grid[0]!;
    expect(hizb1.getAttribute("data-state")).toBe("cold");
    expect(hizb1.getAttribute("aria-label")).toBe("الحزب ١ · لم يُفتح");

    const hizb2 = grid[1]!;
    expect(hizb2.getAttribute("data-state")).toBe("absent");
    expect(hizb2.getAttribute("aria-label")).toBe("الحزب ٢ · غير متوفّر في هذه النسخة");
  });

  it("draws each cell's number, absent ones included, in the scope's own digits", async () => {
    // The number is what ends the counting-from-a-corner a grid of identical
    // squares forces. A hizb number takes the Arabic-Indic digits of the Arabic
    // chrome; an absent cell shows its number too, so an unheld division can
    // still be found by eye. The glyph is `aria-hidden` — the cell's aria-label
    // already says the number in a sentence — so it is read off `textContent`.
    draw();
    const grid = await cells();
    expect(grid[0]!.textContent).toBe("١"); // hizb 1, present
    expect(grid[1]!.textContent).toBe("٢"); // hizb 2, absent, still numbered
    expect(grid[11]!.textContent).toBe("١٢"); // two Arabic-Indic digits
  });

  it("numbers page-scope cells in Latin, the way a page number is read off the corner", async () => {
    // `pageN`'s rule, applied to the cell: a page number is Latin in both
    // languages because it is read off the printed page's corner, unlike a hizb
    // or juz number which follows the chrome. Page 7 is the one the fixture holds.
    draw({ openAt: "page" });
    const grid = await cells();
    expect(grid[6]!.getAttribute("data-state")).toBe("cold");
    expect(grid[6]!.textContent).toBe("7");
  });

  it("counts the inventory, not the book", async () => {
    // PageSlider's precedent, one division coarser: the grid spans the print and
    // the count says how much of it is actually here.
    //
    // «حزبًا», not «حزب», and this line used to say the latter. The counted noun
    // agrees with «٦٠» — the total — not with the one hizb this build happens to
    // hold, and 11–99 takes the singular accusative. The old string special-cased
    // `have === 1` and produced «من ٦٠ حزب», which is the wrong word in the only
    // build that would ever show it. Worth a hafiz's glance, but the totals here
    // are 604, 60 and 30 and all three now read the same way they always did.
    draw();
    expect(await screen.findByText("المتوفّر ١ من ٦٠ حزبًا")).toBeTruthy();
  });

  it("says how old the record is, so an emptied one is not a damning one", async () => {
    // iOS deletes script-writable storage after seven days without interaction —
    // i.e. exactly when a hafiz has been away. Without this line an emptied
    // record reads as "you have revised nothing", said to someone about their
    // own worship. `since` is stamped when the store is opened, so a wiped record
    // is visibly a *young* record.
    await recordLook({ key: `quran/${EDITION}/2:30`, page: 7 }, at("2026-03-18T12:00:00Z"));
    draw();
    expect(await screen.findByText("يُسجَّل منذ ٢٠٢٦-٠٣-١٨")).toBeTruthy();
  });

  it("warms a division by when it was last opened, and says the number out loud", async () => {
    await recordLook({ key: `quran/${EDITION}/2:30`, page: 7 }, at("2026-03-18T12:00:00Z"));
    draw();
    const grid = await cells();
    await waitFor(() => {
      expect(grid[0]!.getAttribute("data-state")).toBe("seen");
    });
    // Two days back — the second band, not the first, and the count is in the
    // label because the ramp is not available to a screen reader.
    expect(grid[0]!.getAttribute("data-warmth")).toBe("3");
    expect(grid[0]!.getAttribute("aria-label")).toBe("الحزب ١ · فُتح قبل ٢ يومًا");
  });

  it("marks where the reader is standing without overwriting what the cell says", async () => {
    draw();
    const grid = await cells();
    expect(grid[0]!.getAttribute("data-here")).toBe("true");
    // Still cold: "here" is a second fact about the cell, not a replacement one.
    expect(grid[0]!.getAttribute("data-state")).toBe("cold");
    expect(grid[1]!.getAttribute("data-here")).toBe(null);
  });

  it("says the tap is not a claim about revision", async () => {
    draw();
    expect(
      await screen.findByText("النقر دليل على أنّك فتحت الآية، لا على أنّك راجعتها."),
    ).toBeTruthy();
  });

  it("draws nothing at all when it is closed", () => {
    draw({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the division when its cell is pressed, and gets out of the way", async () => {
    // revision-record.md ②. The map is the only surface that shows the whole
    // mus'haf at once, and it was the one picture you could not touch. A press
    // lands on the division's first vendored page, says which division it was —
    // the reader pressed a *hizb* and arrives on a *page*, and a landing that
    // only named the page would leave them to work out whether it is the right
    // one — and closes the sheet, because the reader asked to be somewhere else.
    const went = vi.fn();
    const closed = vi.fn();
    draw({ onGoToPage: went, onClose: closed });
    const grid = await cells();
    fireEvent.click(grid[0]!);
    expect(went).toHaveBeenCalledWith(7, "الحزب ١ · صفحة 7");
    expect(closed).toHaveBeenCalled();
  });

  it("says nothing extra at page scope, where the cell and the landing are one fact", async () => {
    // `goToPage`'s own wording is «صفحة 7», which is already exactly right. A
    // sentence built here would read «صفحة 7 · صفحة 7».
    const went = vi.fn();
    draw({ onGoToPage: went });
    await cells();
    fireEvent.click(screen.getByRole("radio", { name: "صفحة" }));
    const pages = await cells();
    fireEvent.click(pages[6]!);
    expect(went).toHaveBeenCalledWith(7, undefined);
  });

  it("offers no control on a cell with no paper behind it", async () => {
    // The distinction this component is built around, restated in the cursor: an
    // affordance that refuses is worse than one that was never offered, and a
    // button over an absent division is the app promising a page it does not
    // have. Hizb 1 is a button; hizb 2 is a list item and nothing more.
    const went = vi.fn();
    draw({ onGoToPage: went });
    const grid = await cells();
    expect(grid[0]!.tagName).toBe("BUTTON");
    expect(grid[1]!.tagName).toBe("LI");
    fireEvent.click(grid[1]!);
    expect(went).not.toHaveBeenCalled();
  });

  it("is one tab stop, not six hundred and four", async () => {
    // A button per cell would be 604 tab stops inside a dialog that traps Tab —
    // a keyboard reader pressing Tab for a minute to get past a picture. So the
    // grid is a roving tabindex, and the cursor starts on the division the
    // reader is already in rather than at the top of the book.
    draw();
    await cells();
    fireEvent.click(screen.getByRole("radio", { name: "صفحة" }));
    const pages = await cells();
    const stops = pages.filter((cell) => cell.getAttribute("tabindex") === "0");
    expect(stops).toHaveLength(1);
    // Page 7 is where the stage is, and the only page this fixture vendors.
    expect(stops[0]!.getAttribute("aria-label")).toBe("صفحة 7 · لم يُفتح");
  });

  it("steps the cursor through the book with the arrows, skipping paper we do not have", async () => {
    // Three vendored pages, none adjacent, so «the next cell» and «the next
    // division we hold» are different answers — which is the case an arrow key
    // written as `id + 1` gets wrong. Left, because the grid is `dir="rtl"` and
    // the book runs leftward.
    draw({ pages: [page(5, 2, 20, 29), PAGE_7, page(19, 2, 130, 141)], page: 5 });
    await cells();
    fireEvent.click(screen.getByRole("radio", { name: "صفحة" }));
    const grid = screen.getByRole("list", { name: "خريطة المصحف" });
    const stop = () =>
      grid.querySelector<HTMLElement>('[tabindex="0"]')!.getAttribute("aria-label");

    expect(stop()).toBe("صفحة 5 · لم يُفتح");
    fireEvent.keyDown(grid, { key: "ArrowLeft" });
    expect(stop()).toBe("صفحة 7 · لم يُفتح");
    fireEvent.keyDown(grid, { key: "ArrowLeft" });
    expect(stop()).toBe("صفحة 19 · لم يُفتح");
    // The end of the inventory, not the end of the print: there is nowhere
    // further to go, so the cursor stays where it is rather than sliding onto a
    // cell that cannot be pressed.
    fireEvent.keyDown(grid, { key: "ArrowLeft" });
    expect(stop()).toBe("صفحة 19 · لم يُفتح");
    fireEvent.keyDown(grid, { key: "Home" });
    expect(stop()).toBe("صفحة 5 · لم يُفتح");
    fireEvent.keyDown(grid, { key: "End" });
    expect(stop()).toBe("صفحة 19 · لم يُفتح");
  });

  it("puts the cursor back where the reader is when the scope changes", async () => {
    // Hizb 47 and juz 47 are different places. A cursor carried across would sit
    // somewhere the reader never put it, and the next arrow key would move from
    // there.
    draw({ pages: [PAGE_7, page(19, 2, 130, 141)], page: 19 });
    await cells();
    const grid = screen.getByRole("list", { name: "خريطة المصحف" });
    fireEvent.keyDown(grid, { key: "Home" });
    expect(grid.querySelector('[tabindex="0"]')!.getAttribute("aria-label")).toBe(
      "الحزب ١ · لم يُفتح",
    );
    fireEvent.click(screen.getByRole("radio", { name: "صفحة" }));
    await cells();
    // Page 19 — where the stage is — and not page 7, which is where the cursor
    // had been moved at the other scope.
    expect(
      screen
        .getByRole("list", { name: "خريطة المصحف" })
        .querySelector('[tabindex="0"]')!
        .getAttribute("aria-label"),
    ).toBe("صفحة 19 · لم يُفتح");
  });

  /*
   * Two prints, one record — `docs/design/revision-record.md` ③.
   *
   * A record outlives the build that wrote it, so this is not a hypothetical the
   * day a second edition is vendored: the looks already in IndexedDB carry the
   * old print's page numbers, and page 7 of the Madani mus'haf is not page 7 of
   * an IndoPak one. One fixture, one foreign look, and the two scopes have to
   * disagree about it — which is the whole content of the fix.
   *
   * 2:30 is chosen so the foreign look lands inside hizb 1 and juz 1, the
   * divisions this build *does* hold paper for. A foreign ayah in an absent
   * division would render `absent` at every scope and the test would pass
   * without the fix.
   */
  const FOREIGN = { key: "quran/hafs-indopak/2:30", page: 7 };

  it("does not colour this print's page with another print's look", async () => {
    await recordLook(FOREIGN, at("2026-03-18T12:00:00Z"));
    draw();
    await cells();
    fireEvent.click(screen.getByRole("radio", { name: "صفحة" }));

    const pages = await cells();
    expect(pages).toHaveLength(604);
    // Page 7 is the one page this build holds, so it is `cold` or `seen` — never
    // `absent`. Which means "cold" here is a real assertion and not the absent
    // branch quietly answering for it.
    expect(pages[6]!.getAttribute("data-state")).toBe("cold");
    // «صفحة 7», not «الصفحة ٧». The mixed numerals in this one grid are on
    // purpose: a page number is the figure a reader reads off the printed
    // mus'haf's corner and types back into the jumper, so it stays Latin in
    // every language — `i18n.test.tsx` asserts exactly that, against a sweep
    // that would "fix" it. Hizb and juz are not printed anywhere, so they take
    // the language's own digits.
    expect(pages[6]!.getAttribute("aria-label")).toBe("صفحة 7 · لم يُفتح");
  });

  it("does colour this reader's juz with it, because a juz is the same in every print", async () => {
    // The other half, and the one a filter written in a hurry would break. Juz
    // and hizb divide the text, not the paper; dropping these looks would show a
    // hafiz less revision than they did.
    await recordLook(FOREIGN, at("2026-03-18T12:00:00Z"));
    draw();
    const grid = await cells();
    await waitFor(() => {
      expect(grid[0]!.getAttribute("data-state")).toBe("seen");
    });
    expect(grid[0]!.getAttribute("aria-label")).toBe("الحزب ١ · فُتح قبل ٢ يومًا");
  });
  it("keeps the pin shelf to juz scope, where a pack is the unit on screen", async () => {
    draw();
    // Opens at hizb: the shelf is not there, because "keep this hizb" is an
    // offer the store cannot honour — a pack is a juz.
    await waitFor(() => expect(screen.getByRole("radio", { name: "حزب" })).toBeTruthy());
    expect(screen.queryByRole("heading", { name: "المحفوظ في هذا الجهاز" })).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "جزء" }));
    expect(await screen.findByRole("heading", { name: "المحفوظ في هذا الجهاز" })).toBeTruthy();
  });

  it("opens at the scope its caller asked for", async () => {
    // The swept-pack notice's action. Landing at hizb would leave the reader one
    // press from the thing the strip sent them for, on a sheet where the shelf
    // it named is not rendered at all.
    draw({ openAt: "juz" });
    expect(await screen.findByRole("heading", { name: "المحفوظ في هذا الجهاز" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "جزء" })).toHaveAttribute("aria-checked", "true");
  });
});
