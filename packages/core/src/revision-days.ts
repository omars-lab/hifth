/*
 * The record counted day by day. Kept apart from revision.ts on purpose: only
 * the record's by-day layouts read it, and they load when the record is first
 * opened, so in a file of its own this stays out of what the app loads at start.
 */
import { parseAyahKey } from "./keys.js";
import { toAbsoluteAyah } from "./quran-meta.js";
import { dayOf, editionOf, scopesOf, type DayStamp, type MistakeWhat, type RevisionEvent } from "./revision.js";
import type { EditionId } from "./types.js";

/** One day of the record, counted. */
export interface DayCount {
  readonly day: DayStamp;
  /** Deliberate looks that day, a mistake included; a dragged passage is one. */
  readonly looks: number;
  /** Different verses those looks covered, in any print. */
  readonly verses: number;
  /** The pages opened in the print on the stage, ascending. */
  readonly pages: readonly number[];
  /** The juz touched, ascending. */
  readonly juz: readonly number[];
  /** The day's mistakes, oldest first. */
  readonly mistakes: readonly RevisionEvent[];
  /** How many of them were of each kind; "word" is a word marked with no more said. */
  readonly kinds: Readonly<Record<"word" | MistakeWhat, number>>;
  /** The pages, in the print on the stage, those mistakes fall on, ascending. */
  readonly mistakePages: readonly number[];
}

const ascending = (set: ReadonlySet<number>): number[] => [...set].sort((a, b) => a - b);

/**
 * The record day by day: one row for each day with at least one look, newest
 * first. A day with nothing is left out, so the caller can tell "nothing that
 * day" (inside the record, no row) from "before the record began" (earlier than
 * its `since`), which only the store knows.
 *
 * Pages are counted in one print only, for the reason `comparableEvents` gives;
 * verses and juz belong to the text and are counted across every print. A look
 * that cannot be placed adds to the day's looks and to nothing else.
 */
export function daysOf(events: readonly RevisionEvent[], edition: EditionId): DayCount[] {
  interface Tally {
    looks: number;
    verses: Set<number>;
    pages: Set<number>;
    juz: Set<number>;
    mistakes: RevisionEvent[];
    mistakePages: Set<number>;
  }
  const byDay = new Map<DayStamp, Tally>();
  for (const event of events) {
    const day = dayOf(event);
    let t = byDay.get(day);
    if (!t) {
      t = { looks: 0, verses: new Set(), pages: new Set(), juz: new Set(), mistakes: [], mistakePages: new Set() };
      byDay.set(day, t);
    }
    t.looks++;
    const here = editionOf(event) === edition ? scopesOf(event, "page") : [];
    for (const p of here) t.pages.add(p);
    for (const j of scopesOf(event, "juz")) t.juz.add(j);
    const from = parseAyahKey(event.key);
    const to = event.endKey ? parseAyahKey(event.endKey) : from;
    if (from && to) {
      try {
        let a = toAbsoluteAyah(from.surah, from.ayah);
        let b = toAbsoluteAyah(to.surah, to.ayah);
        if (b < a) [a, b] = [b, a];
        for (let v = a; v <= b; v++) t.verses.add(v);
      } catch {
        // A verse number the book does not have: counted as a look, not as a verse.
      }
    }
    if (event.slip) {
      t.mistakes.push(event);
      for (const p of here) t.mistakePages.add(p);
    }
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([day, t]) => {
      const mistakes = t.mistakes.slice().sort((a, b) => a.at - b.at);
      const kinds = { word: 0, sign: 0, letter: 0, rule: 0, verse: 0 };
      // A kind this build does not know (a record from a newer one) counts as the word.
      for (const m of mistakes) kinds[m.what && m.what in kinds ? m.what : "word"]++;
      return { day, looks: t.looks, verses: t.verses.size, pages: ascending(t.pages), juz: ascending(t.juz), mistakes, kinds, mistakePages: ascending(t.mistakePages) };
    });
}
