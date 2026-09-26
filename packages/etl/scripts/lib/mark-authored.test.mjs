/**
 * Reading a person's placements back by who the mark is, not where it sat in a walk.
 *
 * The failure this guards against is quiet: a fresh extract renumbers a page, the
 * stored `page:k` id now points at a different mark, and an afternoon of hand
 * placements lands on the wrong letters without anything erroring. So the tests
 * below drive the resolver on marks whose index has moved out from under the id
 * and check that it still finds the mark by who it is — and refuses when the mark
 * that index now names is a different one.
 */
import { describe, expect, it } from "vitest";
import { authoredIdOf, authoredPlacements, matchLiveMark } from "./mark-authored.mjs";

/** A live mark as `marksOf` returns one — only the fields the resolver reads. */
const mark = (k, name, box, { surah = 2, aya = 5, idx = 3, nth = 1, of = 1 } = {}) => ({
  page: 19,
  k,
  name,
  box,
  surah,
  aya,
  idx,
  nth,
  of,
});

/** A settled ruling row as `settle-mark-report.mjs` writes one. */
const settled = (id, name, box, rect, { fault = true } = {}) => ({
  id,
  page: 19,
  name,
  box,
  fault,
  settled: rect,
});

describe("a mark's stable identity", () => {
  it("is the word, the name and the rank — not the page index", () => {
    expect(authoredIdOf(mark(7, "fatha", [1, 2, 6, 3], { surah: 2, aya: 255, idx: 4, nth: 2, of: 2 }))).toBe(
      "2:255:4/fatha#2of2",
    );
  });

  it("separates two same-named marks on one letter by their rank", () => {
    const first = authoredIdOf(mark(0, "fatha", [10, 2, 6, 3], { nth: 1, of: 2 }));
    const second = authoredIdOf(mark(1, "fatha", [3, 2, 6, 3], { nth: 2, of: 2 }));
    expect(first).not.toBe(second);
  });

  it("separates the same letter drawn twice in one word by which ligature it is", () => {
    // A word with two hamzas: each is its own solo ligature carrying one fatha,
    // so both fathas are "first of one" and only the ligature tells them apart.
    const onFirstHamza = { ...mark(9, "fatha", [294, 55, 7, 4]), lig: { text: "ء" }, ligNo: 1 };
    const onSecondHamza = { ...mark(12, "fatha", [267, 57, 6, 3]), lig: { text: "ء" }, ligNo: 2 };
    expect(authoredIdOf(onFirstHamza)).not.toBe(authoredIdOf(onSecondHamza));
  });
});

describe("finding the live mark a ruling is about", () => {
  it("finds it by its raw rectangle even after the index has drifted", () => {
    // Settled as 19:2, but a re-extract has since made it index 5 on the page.
    const marks = [
      mark(4, "kasra", [50, 9, 6, 3]),
      mark(5, "fatha", [20, 4, 6, 3]),
    ];
    const hit = matchLiveMark(marks, settled("19:2", "fatha", [20, 4, 6, 3], [20.4, 3.1, 6, 3.6]));
    expect(hit).toBe(marks[1]);
  });

  it("refuses when the stored index now names a mark of a different name and no box matches", () => {
    const marks = [mark(0, "kasra", [99, 9, 6, 3]), mark(1, "damma", [88, 9, 6, 3])];
    expect(matchLiveMark(marks, settled("19:1", "fatha", [20, 4, 6, 3], [20, 4, 6, 3]))).toBeNull();
  });

  it("falls back to the stored index when the name still agrees and no raw box is unique", () => {
    // Two fatha at the same box: the raw match is ambiguous, so the index decides.
    const marks = [mark(0, "fatha", [20, 4, 6, 3]), mark(1, "fatha", [20, 4, 6, 3])];
    const hit = matchLiveMark(marks, settled("19:1", "fatha", [20, 4, 6, 3], [21, 5, 6, 3]));
    expect(hit).toBe(marks[1]);
  });
});

describe("distilling committed rulings into one override table", () => {
  const marksForPage = () => [
    mark(0, "fatha", [20, 4, 6, 3], { idx: 1, nth: 1, of: 1 }),
    mark(1, "kasra", [40, 9, 6, 3], { idx: 2, nth: 1, of: 1 }),
  ];

  it("keeps only faulted, placed rows and keys them by identity", () => {
    const { placements, unresolved } = authoredPlacements(
      [
        {
          from: "a.settled.json",
          settledAt: "2026-08-14T00:00:00Z",
          settledMarks: [
            settled("19:0", "fatha", [20, 4, 6, 3], [20.4, 3.1, 6, 3.6]),
            settled("19:1", "kasra", [40, 9, 6, 3], null, { fault: false }), // untouched
          ],
        },
      ],
      marksForPage,
    );
    expect(unresolved).toEqual([]);
    expect([...placements.keys()]).toEqual(["2:5:1/fatha#1of1"]);
    expect(placements.get("2:5:1/fatha#1of1").rect).toEqual([20.4, 3.1, 6, 3.6]);
  });

  it("lets the later sitting win when a mark is placed twice", () => {
    const { placements } = authoredPlacements(
      [
        {
          from: "old.settled.json",
          settledAt: "2026-08-14T00:00:00Z",
          settledMarks: [settled("19:0", "fatha", [20, 4, 6, 3], [1, 1, 6, 3])],
        },
        {
          from: "new.settled.json",
          settledAt: "2026-08-20T00:00:00Z",
          settledMarks: [settled("19:0", "fatha", [20, 4, 6, 3], [2, 2, 6, 3])],
        },
      ],
      marksForPage,
    );
    expect(placements.get("2:5:1/fatha#1of1").rect).toEqual([2, 2, 6, 3]);
    expect(placements.get("2:5:1/fatha#1of1").from).toBe("new.settled.json");
  });

  it("surfaces an unresolvable placement rather than dropping it", () => {
    const { placements, unresolved } = authoredPlacements(
      [
        {
          from: "b.settled.json",
          settledAt: "2026-08-14T00:00:00Z",
          settledMarks: [settled("19:9", "sukun", [77, 7, 6, 3], [77, 7, 6, 3])],
        },
      ],
      marksForPage,
    );
    expect(placements.size).toBe(0);
    expect(unresolved).toEqual([{ from: "b.settled.json", id: "19:9", name: "sukun", page: 19 }]);
  });
});
