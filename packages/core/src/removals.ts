/**
 * The marks a reader took away, remembered so they stay away (sign-in step 21a,
 * docs/design/sign-in.md, "your marks follow you").
 *
 * Loading a copy of the marks never deletes: a note only in the copy arrives.
 * That was right while a copy was a file the reader chose to load. Once each
 * device fetches the one copy kept on hifth.app, merges it and sends it back,
 * it is wrong: a note deleted on the iPad is still on the iPhone, and the next
 * merge would put it back on the iPad. So each device remembers what it took
 * away and when, the copy carries that list, and a merge takes a mark away when
 * its removal is newer than the mark's own last change. A mark written in on
 * another device after it was deleted here is still wanted, and stays.
 *
 * Pure and clockless, like the rest of the core: every change takes `now`.
 * Only ids and times are kept, never what the mark said.
 */

export interface Removal {
  readonly id: string;
  readonly at: number;
}

/**
 * How long a removal is remembered. A device left in a drawer for longer than
 * this can bring a note back when it is next used; that is the price of a
 * list that does not grow for ever, and a year is longer than anyone leaves a
 * device they read from.
 */
export const REMOVAL_KEEP_MS = 365 * 24 * 60 * 60 * 1000;

/** A removal as read from a file: an id and a time, and nothing else. */
export function isRemoval(x: unknown): x is Removal {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const r = x as Record<string, unknown>;
  return (
    Object.keys(r).every((k) => k === "id" || k === "at") &&
    typeof r.id === "string" &&
    r.id.length > 0 &&
    typeof r.at === "number" &&
    Number.isFinite(r.at)
  );
}

/** Two lists put together: one removal per id, the later one, in id order so the copy never wobbles. */
export function joinRemovals(a: readonly Removal[], b: readonly Removal[]): Removal[] {
  const byId = new Map<string, Removal>();
  for (const r of [...a, ...b]) {
    const have = byId.get(r.id);
    if (!have || r.at > have.at) byId.set(r.id, { id: r.id, at: r.at });
  }
  return [...byId.values()].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}

/** The marks a removal does not take away: a mark changed after its removal stays. */
export function dropRemoved<T extends { readonly id: string }>(
  set: readonly T[],
  removed: readonly Removal[],
  changedAt: (x: T) => number,
): T[] {
  const at = new Map(removed.map((r) => [r.id, r.at]));
  return set.filter((x) => {
    const gone = at.get(x.id);
    return gone === undefined || changedAt(x) > gone;
  });
}

/**
 * What the device remembers after a change from `before` to `after`. A mark
 * that went is remembered from `now`. A mark that is there again (Undo put it
 * back) is forgotten as removed, and if it is no newer than its removal it is
 * stamped as changed now with `touch`: another device may already hold the
 * removal, and without the stamp the next merge would take it away again.
 * Removals older than `REMOVAL_KEEP_MS` are forgotten.
 */
export function trackRemovals<T extends { readonly id: string }>(
  removed: readonly Removal[],
  before: readonly T[],
  after: readonly T[],
  now: number,
  changedAt: (x: T) => number,
  touch: (x: T, now: number) => T,
): { removed: Removal[]; after: T[] } {
  const there = new Set(after.map((x) => x.id));
  const went = before.filter((x) => !there.has(x.id)).map((x) => ({ id: x.id, at: now }));
  const was = new Map(removed.map((r) => [r.id, r.at]));
  const back = after.map((x) => {
    const at = was.get(x.id);
    return at !== undefined && changedAt(x) <= at ? touch(x, now) : x;
  });
  const kept = joinRemovals(removed, went).filter((r) => !there.has(r.id) && now - r.at <= REMOVAL_KEEP_MS);
  return { removed: kept, after: back };
}
