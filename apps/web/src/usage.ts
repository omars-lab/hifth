/**
 * The owner's own count of how often each part of the app is used
 * (docs/design/feature-usage.md). Pure: the names, and the roll-up the info
 * panel draws. The device half, which keeps the counts, is `usage-store.ts`.
 *
 * A count names a feature and nothing else. Which verse was open, what a note
 * said, which commentary was read: none of it is here, and none of it may be.
 * Which verses a hafiz opens is the revision record's to keep, with its own care.
 */

/*
 * Its own day helpers, on purpose, rather than the revision record's: the two
 * records are kept apart, and the privacy check holds each to its own list of
 * who may reach it. A borrowed helper would put this file on the revision
 * record's list.
 */

/** A calendar day, `YYYY-MM-DD`, in the reader's own time zone. */
export type DayStamp = string;

/** The reader's local calendar day at `now`. */
export function dayAt(now: number): DayStamp {
  const d = new Date(now);
  const y = String(d.getFullYear()).padStart(4, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Whole days from `from` to `to`. */
export function daysBetween(from: DayStamp, to: DayStamp): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** The pens, by the names the tools row already uses. */
export const USE_PENS = ["note", "highlight", "bookmark", "sign", "word", "mistake", "crop", "jump"] as const;

/**
 * Every feature the app counts, in the order the info panel lists ties. A new
 * one is a line here, a name in the messages, and one place in the app that
 * says it was used.
 */
export const USE_FEATURES = [
  "turn-page",
  "lookalikes",
  "commentary",
  "roots",
  "listen",
  "share",
  "go-to",
  "zoom",
  "verse-menu",
  "word-parts",
  "opened-map",
  "tajweed-key",
  "edition",
  "info-panel",
  ...USE_PENS.map((p) => `pen-${p}` as const),
] as const;

export type UseFeature = (typeof USE_FEATURES)[number];

const KNOWN: ReadonlySet<string> = new Set(USE_FEATURES);

export function isUseFeature(name: string): name is UseFeature {
  return KNOWN.has(name);
}

/** One day's counts, as the device keeps them. */
export interface UseDay {
  readonly day: DayStamp;
  readonly counts: Readonly<Record<string, number>>;
}

/** How many days the info panel's little strip reaches back, today included. */
export const RECENT_DAYS = 14;

export interface UseRow {
  readonly feature: UseFeature;
  readonly total: number;
  /** The last day it was used, or null for never. */
  readonly lastDay: DayStamp | null;
  /** Uses per day over the last `RECENT_DAYS`, oldest first, today last. */
  readonly recent: readonly number[];
}

/** Every feature with its totals, most used first; ties keep the list order. */
export function rollUpUse(days: readonly UseDay[], today: DayStamp): UseRow[] {
  const rows = USE_FEATURES.map((feature) => {
    let total = 0;
    let lastDay: DayStamp | null = null;
    const recent = new Array<number>(RECENT_DAYS).fill(0);
    for (const d of days) {
      const n = d.counts[feature] ?? 0;
      if (n <= 0) continue;
      total += n;
      if (lastDay === null || d.day > lastDay) lastDay = d.day;
      const ago = daysBetween(d.day, today);
      if (ago >= 0 && ago < RECENT_DAYS) recent[RECENT_DAYS - 1 - ago]! += n;
    }
    return { feature, total, lastDay, recent };
  });
  // Array sort is stable, so equal totals stay in list order.
  return rows.sort((a, b) => b.total - a.total);
}
