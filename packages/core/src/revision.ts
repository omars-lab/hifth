/**
 * The revision record — what a hafiz has *opened*, rolled up by day and by scope.
 *
 * The honest name for this is not "what you revised". A tap is evidence that
 * someone looked at an ayah; it is not evidence that they recited it, and the
 * distance between those two is the whole reason this module is careful about
 * which taps it will accept (see `RevisionEvent`). The UI says so once, out loud,
 * because a heatmap titled "revision" over a log of glances is the same class of
 * defect this codebase has already paid for twice: an interface stating something
 * the data cannot back.
 *
 * Pure, framework-free, and **clockless**: nothing here reads the current time.
 * `rollUp` and `lastSeen` are functions of their input alone, so a day-boundary
 * test is arithmetic rather than a mocked global.
 *
 * ## Why the timezone rides on the event
 *
 * "Which day was that?" is a question about the clock the reader was living
 * under, not the one they are living under now. A hafiz who revises at 23:40 and
 * again at 00:20 has revised on two days; one who revises the night the clocks go
 * back has an hour that happens twice. Passing a single offset in at read time —
 * the obvious API — silently mis-files every event recorded on the other side of
 * a DST change or a flight. So each event carries the UTC offset in force when it
 * was recorded, and `dayOf` is decided entirely by the event.
 *
 * ## Scopes
 *
 * `page` and `juz`, and deliberately **not `hizb`**: hizb boundaries do not exist
 * anywhere in this repo, and the tempting derivation — half a juz — is wrong,
 * because a hizb is its own text division and does not fall at a juz's arithmetic
 * midpoint. A heatmap labelled «الحزب ١٢» over the wrong ayahs would be the
 * mutashabihat off-by-one all over again, and nothing here would catch it. Hizb
 * arrives when real boundaries are vendored, not before.
 *
 * Page ids are **only comparable within one edition** — page 7 of the Madani
 * print is not page 7 of anything else. Juz ids are comparable everywhere, being
 * a division of the text rather than of the paper. Callers holding more than one
 * edition's events must partition before rolling up by page; `editionOf` is here
 * for that.
 */

import { parseAyahKey } from "./keys.js";
import { juzOf } from "./quran-meta.js";
import type { EditionId } from "./types.js";

/** The divisions of the book this record can colour. */
export type RevisionScope = "page" | "juz";

/** A local calendar day, `YYYY-MM-DD`. Sorts lexicographically. */
export type DayStamp = string;

/**
 * One deliberate look at the book.
 *
 * "One" is load-bearing. A marquee across twelve ayahs is a single look at a
 * passage, not twelve revisions, so it is one event with an `endKey` — counting
 * it twelve times would let one gesture outweigh a page read carefully.
 *
 * What must *not* become an event, and why:
 *
 *   - **Toggling a selection off.** `handleSelect` fires on the second tap of the
 *     same ayah too. That tap means "dismiss", and recording it as a second look
 *     doubles the score of every ayah the reader changed their mind about.
 *   - **Arriving by a hop.** The app moved them; the ayah they were studying is
 *     the *source*. Crediting the destination would draw a heatmap of wherever
 *     the corpus happens to point.
 *   - **Arriving by a share link.** Someone else chose that ayah.
 *
 * Record all of those evenly and the result maps app usage, not revision — and
 * the two diverge precisely where the record was meant to be useful.
 */
export interface RevisionEvent {
  /** Canonical ayah key of the look, or of the first ayah of a passage. */
  readonly key: string;
  /** Last ayah of a passage. Absent for a single ayah. */
  readonly endKey?: string;
  /** The page it was read on, in the edition it was read in. */
  readonly page: number;
  /** Epoch milliseconds. */
  readonly at: number;
  /**
   * Minutes to add to UTC to get the reader's local clock at `at` — i.e.
   * `-new Date().getTimezoneOffset()`. Positive east of Greenwich.
   */
  readonly tz: number;
}

/** The local calendar day an event belongs to. */
export function dayOf(event: RevisionEvent): DayStamp {
  const shifted = new Date(event.at + event.tz * 60_000);
  const y = String(shifted.getUTCFullYear()).padStart(4, "0");
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The edition an event was recorded in, or null if its key is not an ayah key. */
export function editionOf(event: RevisionEvent): EditionId | null {
  return parseAyahKey(event.key)?.edition ?? null;
}

/**
 * Every scope id this one event touches, ascending.
 *
 * A page always yields exactly one id: a marquee is drawn on one page's stage, so
 * a passage cannot straddle two. A juz can straddle — a page may sit across a juz
 * boundary — and when it does the event credits **both**, because the reader did
 * in fact look at both. Empty when the keys are unparseable, so a corrupt record
 * degrades to a gap in the picture rather than to a wrong colour.
 */
export function scopesOf(event: RevisionEvent, scope: RevisionScope): readonly number[] {
  if (scope === "page") {
    return Number.isInteger(event.page) && event.page > 0 ? [event.page] : [];
  }
  const from = parseAyahKey(event.key);
  if (!from) return [];
  const to = event.endKey ? parseAyahKey(event.endKey) : from;
  let first: number;
  let last: number;
  try {
    first = juzOf(from.surah, from.ayah);
    last = to ? juzOf(to.surah, to.ayah) : first;
  } catch {
    // An ayah number past the end of its surah is not a juz we can name. Same
    // rule as an unparseable key: leave a gap, never guess.
    return [];
  }
  if (last < first) [first, last] = [last, first];
  const out: number[] = [];
  for (let j = first; j <= last; j++) out.push(j);
  return out;
}

/**
 * Day → scope id → how many looks landed there.
 *
 * One event contributes 1 to each scope it touches, once. Events whose scope
 * cannot be determined are dropped rather than bucketed under a placeholder — a
 * heatmap with a hole in it is recoverable; one with a wrong square is not.
 */
export function rollUp(
  events: readonly RevisionEvent[],
  scope: RevisionScope,
): Map<DayStamp, Map<number, number>> {
  const byDay = new Map<DayStamp, Map<number, number>>();
  for (const event of events) {
    const ids = scopesOf(event, scope);
    if (ids.length === 0) continue;
    const day = dayOf(event);
    let counts = byDay.get(day);
    if (!counts) {
      counts = new Map<number, number>();
      byDay.set(day, counts);
    }
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return byDay;
}

/**
 * Scope id → the most recent day it was opened.
 *
 * This is the half of the record that answers the question the feature exists
 * for — *what have I not touched in weeks* — so it is deliberately separate from
 * `rollUp`: the answer does not depend on how many times something was opened,
 * only on when it last was.
 */
export function lastSeen(
  events: readonly RevisionEvent[],
  scope: RevisionScope,
): Map<number, DayStamp> {
  const seen = new Map<number, DayStamp>();
  for (const event of events) {
    const day = dayOf(event);
    for (const id of scopesOf(event, scope)) {
      const prev = seen.get(id);
      if (prev === undefined || day > prev) seen.set(id, day);
    }
  }
  return seen;
}

/**
 * Whole days from `from` to `to`, negative if `to` is earlier.
 *
 * Calendar days, not elapsed hours: yesterday evening to this morning is 1, the
 * same way a reader counts it. Both stamps are read as UTC midnights, which is
 * safe precisely because `dayOf` has already resolved the local clock — the
 * offset is spent once, at record time, and never again.
 */
export function daysBetween(from: DayStamp, to: DayStamp): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return Math.round((b - a) / 86_400_000);
}
