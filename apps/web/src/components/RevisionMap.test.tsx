import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { PageMeta } from "@hifth/core";
import { forgetRecord, recordLook } from "../revision-store";
import { RevisionMap, coverage } from "./RevisionMap";

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
 */
function cells(): Promise<HTMLElement[]> {
  return waitFor(() => {
    // Named, not "the first list": the legend beside it is also a list of cells,
    // and a query that could pick either would pass for the wrong reason.
    const grid = screen.getByRole("list", { name: "خريطة المصحف" });
    return within(grid).getAllByRole("listitem");
  });
}

beforeEach(async () => {
  await forgetRecord();
});

describe("coverage", () => {
  it("asks the same function the record asks", () => {
    // Not an implementation detail — it is the whole reason `coverage` exists as
    // a pseudo-event rather than as its own page→hizb table. Page 7 sits inside
    // hizb 1 and juz 1, and `scopesOf` is what says so in both directions.
    expect([...coverage([PAGE_7], "hizb")]).toEqual([1]);
    expect([...coverage([PAGE_7], "juz")]).toEqual([1]);
    expect([...coverage([PAGE_7], "page")]).toEqual([7]);
  });

  it("holds both divisions when a page straddles the boundary", () => {
    // Hizb 2 opens at 2:75. A page running 2:70–2:80 is paper for both, and a
    // map that credited only the ayah it happened to look at first would draw a
    // hizb as absent that the reader can in fact reach.
    expect([...coverage([page(13, 2, 70, 80)], "hizb")]).toEqual([1, 2]);
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
});
