/**
 * Confusion jumps: a private record of where your memory jumped while
 * reciting, from one verse to another (docs/design/confusion-jumps.md, build
 * step 1).
 *
 * One record per pair of verses, from and to, holding every time it happened
 * and on which device. Marking the same pair again adds a time; it never makes
 * a second record. The reader, not the app, says when a jump is beaten, and
 * nothing here adds the times up into a score (docs/design/confusion-points.md).
 *
 * Pure and clockless, like notes.ts: every change takes `now`, and a device is
 * whatever id the app hands in.
 */

/** Where a jump starts or lands: a verse, and the word at the seam when known. */
export interface JumpEnd {
  readonly key: string;
  readonly word?: number;
}

export interface JumpTime {
  readonly at: number;
  readonly device: string;
}

export type ConfusionState = "sometimes" | "every-pass" | "beaten" | "dismissed";

export interface Confusion {
  readonly id: string;
  readonly from: JumpEnd;
  /** Null while the reader is not sure yet where they went. */
  readonly to: JumpEnd | null;
  /** Every time it happened, oldest first; never empty. "How many times" is its length. */
  readonly times: readonly JumpTime[];
  readonly state: ConfusionState;
  readonly createdAt: number;
  readonly updatedAt: number;
}

const STATES: readonly ConfusionState[] = ["sometimes", "every-pass", "beaten", "dismissed"];

function freshId(now: number, set: readonly { id: string }[]): string {
  const base = `j${now.toString(36)}`;
  let n = 0;
  let id = base;
  while (set.some((x) => x.id === id)) id = `${base}-${++n}`;
  return id;
}

const samePair = (c: Confusion, from: string, to: string): boolean => c.to !== null && c.from.key === from && c.to.key === to;

function joinTimes(a: readonly JumpTime[], b: readonly JumpTime[]): JumpTime[] {
  const seen = new Map<string, JumpTime>();
  for (const t of [...a, ...b]) seen.set(`${t.at}@${t.device}`, t);
  return [...seen.values()].sort((x, y) => x.at - y.at || x.device.localeCompare(y.device));
}

function end(e: JumpEnd): JumpEnd {
  return e.word === undefined ? { key: e.key } : { key: e.key, word: e.word };
}

/**
 * Mark a jump. The same pair again adds a time to its record, and the seam
 * word becomes the latest one; a jump whose destination is not known yet
 * (`to` null) is always a record of its own until it is filled in.
 */
export function markConfusion(
  set: readonly Confusion[],
  from: JumpEnd,
  to: JumpEnd | null,
  now: number,
  device: string,
): Confusion[] {
  const time = { at: now, device };
  const mine = to ? set.find((c) => samePair(c, from.key, to.key)) : undefined;
  if (mine) {
    return set.map((c) =>
      c === mine
        ? { ...c, from: from.word === undefined ? c.from : end(from), times: joinTimes(c.times, [time]), updatedAt: now }
        : c,
    );
  }
  const made: Confusion = {
    id: freshId(now, set),
    from: end(from),
    to: to ? end(to) : null,
    times: [time],
    state: "sometimes",
    createdAt: now,
    updatedAt: now,
  };
  return [...set, made];
}

/** One more time for a record, without drawing it again. */
export function againConfusion(set: readonly Confusion[], id: string, now: number, device: string): Confusion[] {
  return set.map((c) => (c.id === id ? { ...c, times: joinTimes(c.times, [{ at: now, device }]), updatedAt: now } : c));
}

/**
 * Say where a "not sure yet" jump went. If that pair already has a record, the
 * times join it and the unsure one goes, so one weakness is one record.
 */
export function setDestination(set: readonly Confusion[], id: string, to: JumpEnd, now: number): Confusion[] {
  const mine = set.find((c) => c.id === id);
  if (!mine) return [...set];
  const other = set.find((c) => c !== mine && samePair(c, mine.from.key, to.key));
  if (!other) return set.map((c) => (c === mine ? { ...c, to: end(to), updatedAt: now } : c));
  return set
    .filter((c) => c !== mine)
    .map((c) => (c === other ? { ...c, times: joinTimes(c.times, mine.times), updatedAt: now } : c));
}

export function setConfusionState(set: readonly Confusion[], id: string, state: ConfusionState, now: number): Confusion[] {
  return set.map((c) => (c.id === id ? { ...c, state, updatedAt: now } : c));
}

export function removeConfusion(set: readonly Confusion[], id: string): Confusion[] {
  return set.filter((c) => c.id !== id);
}

/** Put back a record just deleted (the Undo after Delete). */
export function restoreConfusion(set: readonly Confusion[], record: Confusion): Confusion[] {
  return set.some((c) => c.id === record.id) ? [...set] : [...set, record];
}

/** Take away the latest time; a record left with none is removed. */
export function removeLastTime(set: readonly Confusion[], id: string, now: number): Confusion[] {
  const out: Confusion[] = [];
  for (const c of set) {
    if (c.id !== id) out.push(c);
    else if (c.times.length > 1) out.push({ ...c, times: c.times.slice(0, -1), updatedAt: now });
  }
  return out;
}

/** What the mark by a verse's number shows. */
export interface ConfusionMark {
  /** How many different verses you have jumped to from here. */
  readonly count: number;
  /** Jumps from here not yet given a destination: marked, but not counted. */
  readonly unsure: number;
  /** True when every jump from here is one you have said is beaten. */
  readonly beaten: boolean;
}

/** The mark for each verse a jump starts from. A dismissed jump leaves no mark. */
export function confusionMarks(set: readonly Confusion[]): Map<string, ConfusionMark> {
  const by = new Map<string, Confusion[]>();
  for (const c of set) {
    if (c.state === "dismissed") continue;
    const list = by.get(c.from.key) ?? [];
    list.push(c);
    by.set(c.from.key, list);
  }
  const marks = new Map<string, ConfusionMark>();
  for (const [key, list] of by) marks.set(key, markOf(list));
  return marks;
}

function markOf(list: readonly Confusion[]): ConfusionMark {
  const to = new Set(list.flatMap((c) => (c.to ? [c.to.key] : [])));
  return {
    count: to.size,
    unsure: list.filter((c) => c.to === null).length,
    beaten: list.every((c) => c.state === "beaten"),
  };
}

/**
 * The next wasl after the word you left from (design question 3, answer A):
 * the first pause sign after it, inside the same verse, with a real word
 * after it, since that is where you stop, start again, and carry on into the
 * wrong verse. `last` is the verse's last index on the page and `isSign` says
 * which indices are signs rather than words.
 *
 * "A word after it" is what leaves out the two signs that are not pauses. In
 * this print the hizb star stands before a verse's first word, so it is never
 * after a seam, and the prostration sign after its last word, so nothing
 * follows it; measured over the mus'haf on 2026-10-03, those are 199 and the
 * 15 prostration verses, against 4,272 signs between words. No verse runs
 * across a page break, so the page's words are the whole verse.
 *
 * Null when the verse ends first: then the verse number is the place, and it
 * already has its mark.
 */
export function nextWasl(seam: number, last: number, isSign: (index: number) => boolean): number | null {
  for (let i = seam + 1; i < last; i++) {
    if (!isSign(i)) continue;
    for (let j = i + 1; j <= last; j++) if (!isSign(j)) return i;
    return null;
  }
  return null;
}

/** A mark at a pause sign: the verse it is in, the sign's index, and what it shows. */
export interface WaslMark extends ConfusionMark {
  readonly key: string;
  readonly index: number;
}

/**
 * The marks at the next wasl, one per sign that some jump's seam reaches,
 * counted the way the verse number's mark is. A jump with no seam word (marked
 * from a verse's menu) has no wasl; `waslOf` finds the sign for a seam, or
 * null when there is none.
 */
export function waslMarks(
  set: readonly Confusion[],
  waslOf: (key: string, seam: number) => number | null,
): WaslMark[] {
  const by = new Map<string, { key: string; index: number; list: Confusion[] }>();
  for (const c of set) {
    if (c.state === "dismissed" || c.from.word === undefined) continue;
    const index = waslOf(c.from.key, c.from.word);
    if (index === null) continue;
    const id = `${c.from.key}@${index}`;
    const at = by.get(id) ?? { key: c.from.key, index, list: [] };
    at.list.push(c);
    by.set(id, at);
  }
  return [...by.values()]
    .map(({ key, index, list }) => ({ key, index, ...markOf(list) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.index - b.index));
}

/** A saved arrow on the page: from one place in a verse, to every verse gone to from there. */
export interface JumpArrow {
  readonly key: string;
  /** The word you left at, or null when the jump was marked without one: the page starts it at the verse's first word. */
  readonly word: number | null;
  /** Where you went, the most often first; `to` is null for the jumps not named yet, joined into one. */
  readonly ends: readonly { readonly to: string | null; readonly times: number }[];
  /** Every jump from here is beaten, so the arrow is drawn grey. */
  readonly beaten: boolean;
}

/**
 * The arrows a page draws for the saved jumps (confusion-jumps, "The arrow
 * itself"): one from each place you left, carrying a label for each verse you
 * went to from there and, past once, how many times. Jumps from the same word
 * share one arrow, so marking a jump again never draws a second one.
 * Dismissed jumps are left out, as everywhere.
 */
export function jumpArrows(set: readonly Confusion[]): JumpArrow[] {
  const by = new Map<string, { key: string; word: number | null; list: Confusion[] }>();
  for (const c of set) {
    if (c.state === "dismissed") continue;
    const word = c.from.word ?? null;
    const id = `${c.from.key}@${word ?? ""}`;
    const at = by.get(id) ?? { key: c.from.key, word, list: [] };
    at.list.push(c);
    by.set(id, at);
  }
  return [...by.values()]
    .map(({ key, word, list }) => {
      const times = new Map<string | null, number>();
      for (const c of list) {
        const to = c.to?.key ?? null;
        times.set(to, (times.get(to) ?? 0) + c.times.length);
      }
      const ends = [...times]
        .map(([to, n]) => ({ to, times: n }))
        // The named before the not-named-yet, then the most often first.
        .sort((a, b) => Number(a.to === null) - Number(b.to === null) || b.times - a.times || ((a.to ?? "") < (b.to ?? "") ? -1 : 1));
      return { key, word, ends, beaten: list.every((c) => c.state === "beaten") };
    })
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : (a.word ?? 0) - (b.word ?? 0)));
}

/**
 * How saved arrows are shown, on trial (confusion-jumps, question 4): they
 * stay on the page, faint, or show only while you are asking for them, which
 * is while the Jump tool is on, or for the one verse whose list is open.
 */
export type ArrowShowing = "stays" | "asked";

export function arrowsShown(
  arrows: readonly JumpArrow[],
  showing: ArrowShowing,
  now: { toolOn: boolean; open: string | null },
): readonly JumpArrow[] {
  if (showing === "stays" || now.toolOn) return arrows;
  return now.open === null ? [] : arrows.filter((a) => a.key === now.open);
}

const lastAt = (c: Confusion) => c.times[c.times.length - 1]?.at ?? 0;
const oftenFirst = (a: Confusion, b: Confusion) =>
  b.times.length - a.times.length || lastAt(b) - lastAt(a) || (a.id < b.id ? -1 : 1);

/** The jumps from one verse, the most often first, then the latest. */
export function confusionsFrom(set: readonly Confusion[], key: string): Confusion[] {
  return set.filter((c) => c.from.key === key).sort(oftenFirst);
}

/**
 * Every jump the reader holds, in the same order, for the page map's list:
 * the "before I start, what do I keep getting wrong?" glance. A dismissed
 * jump is one the reader asked to stop seeing, so it is left out.
 */
export function allConfusions(set: readonly Confusion[]): Confusion[] {
  return set.filter((c) => c.state !== "dismissed").sort(oftenFirst);
}

/**
 * Load jumps from a saved file into what the device holds. Loading never
 * deletes. The same pair from two devices is one record whose times are both
 * lists joined (the same time on the same device once); the state, and the
 * seam word, are the ones changed last.
 *
 * Records are matched by their verses, not their ids: two devices can mark
 * two different jumps in the same moment and make the same id, and those must
 * stay two records. A "not sure yet" record has no pair, so it matches only
 * itself (same id, same verse).
 */
export function mergeConfusions(held: readonly Confusion[], loaded: readonly Confusion[]): Confusion[] {
  const out = [...held];
  for (const x of loaded) {
    const i = out.findIndex((c) =>
      x.to === null ? c.to === null && c.id === x.id && c.from.key === x.from.key : samePair(c, x.from.key, x.to.key),
    );
    if (i < 0) {
      out.push(out.some((c) => c.id === x.id) ? { ...x, id: freshId(x.createdAt, [...out, ...loaded]) } : x);
      continue;
    }
    const mine = out[i]!;
    const later = x.updatedAt > mine.updatedAt ? x : mine;
    out[i] = {
      ...later,
      id: mine.id,
      times: joinTimes(mine.times, x.times),
      createdAt: Math.min(mine.createdAt, x.createdAt),
      updatedAt: Math.max(mine.updatedAt, x.updatedAt),
    };
  }
  return out;
}

const isEnd = (e: unknown): e is JumpEnd => {
  if (typeof e !== "object" || e === null) return false;
  const { key, word } = e as Record<string, unknown>;
  return typeof key === "string" && (word === undefined || (Number.isInteger(word) && (word as number) >= 0));
};

/** Whether a value read from a saved file is a jump record. */
export function isConfusion(v: unknown): v is Confusion {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    isEnd(c.from) &&
    (c.to === null || isEnd(c.to)) &&
    Array.isArray(c.times) &&
    c.times.length > 0 &&
    c.times.every(
      (t: unknown) =>
        typeof t === "object" && t !== null && typeof (t as JumpTime).at === "number" && typeof (t as JumpTime).device === "string",
    ) &&
    STATES.includes(c.state as ConfusionState) &&
    typeof c.createdAt === "number" &&
    typeof c.updatedAt === "number"
  );
}

/** A small, steady number from a string, so the same seam always waves the same way. */
function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const num = (n: number): string => String(Math.round(n * 10) / 10);

/**
 * The wavy arrow's line from `a` to `b`, as SVG path data: a row of gentle
 * curves either side of the straight line, about one every `step` units. The
 * same seed always gives the same line, and two seams differ a little in how
 * high they wave and which way they start, so a page of arrows does not look
 * stamped. The arrowhead is drawn by the page, not here.
 */
export function squiggle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  seed: string,
  step = 14,
  height = 4,
): string {
  const h = seedOf(seed);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const waves = Math.max(3, Math.round(len / step));
  const amp = height * (0.75 + (h % 64) / 128);
  const flip = h & 64 ? 1 : -1;
  // The unit sideways from the line.
  const nx = -dy / len;
  const ny = dx / len;
  const parts = [`M${num(a.x)} ${num(a.y)}`];
  for (let i = 0; i < waves; i++) {
    const mid = (i + 0.5) / waves;
    const to = (i + 1) / waves;
    const side = (i % 2 === 0 ? 1 : -1) * flip * amp * 2;
    parts.push(
      `Q${num(a.x + dx * mid + nx * side)} ${num(a.y + dy * mid + ny * side)} ${num(a.x + dx * to)} ${num(a.y + dy * to)}`,
    );
  }
  return parts.join(" ");
}
