import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  bookmarkChangedAt,
  confusionChangedAt,
  dropUnwritten,
  fromPins,
  isMistake,
  joinRemovals,
  mergeBookmarkFile,
  mergeConfusions,
  mergeConfusionsFile,
  mergeNotesFile,
  pinsOf,
  touchBookmark,
  touchConfusion,
  trackRemovals,
  type Bookmark,
  type Confusion,
  type Note,
  type Removal,
  type ScopedNote,
} from "@hifth/core";
import {
  loadNotes,
  readBookmarkSet,
  readConfusionSet,
  readDevice,
  readSeam,
  writeAllNotes,
  writeBookmarks,
  writeConfusions,
  writeSeam,
  type Device,
  type HeldNotes,
} from "./bookmark-store";
import { stepOnto, type CommitHow, type Recorder } from "./mark-history";

/**
 * The reader's bookmarks, held for the app: loaded from the phone once, and every
 * change written back whole (the storage model's "written all at once").
 *
 * Every change goes through `commit`, which takes the next set from one of the
 * core rules and says one line about it. When the phone refuses the write the
 * line is replaced by `notSaved`, so a reader is never told a bookmark was
 * dropped that will not be there tomorrow.
 *
 * `record` hears each change as the set before and after, for Undo
 * (mark-history.ts); `restore` puts a set back without being heard.
 */
export function useBookmarks(
  announce: (line: string) => void,
  notSaved: string,
  record?: Recorder,
): {
  bookmarks: readonly Bookmark[];
  /** The bookmarks the reader took away, by id and time, for the copy to carry (removals.ts, ㉒). */
  removed: readonly Removal[];
  /** True once the bookmarks saved in this browser have been read in. */
  loaded: boolean;
  commit: (next: Bookmark[], said: string, how?: CommitHow) => void;
  /**
   * Merge in a copy's bookmarks and the ones it says were taken away; how many
   * arrived. Undo does not hear it. `say` gives the line to announce once it is
   * saved, from how many arrived.
   */
  loadFile: (
    fileBookmarks: readonly Bookmark[],
    fileRemoved?: readonly Removal[],
    say?: (added: number) => string,
  ) => number;
  /** Undo or Redo: go to `set` from `leaving`, changing only what that step changed (stepOnto). */
  restore: (set: unknown, said: string, leaving?: unknown) => void;
  /** Settles once every write asked for so far has reached disk. */
  saved: () => Promise<unknown>;
} {
  const [held, setHeld] = useState<HeldSet<Bookmark>>(NOTHING);
  const [loaded, setLoaded] = useState(false);
  const latest = useRef<HeldSet<Bookmark>>(NOTHING);
  const setBookmarks = useCallback(
    (next: HeldSet<Bookmark> | ((now: HeldSet<Bookmark>) => HeldSet<Bookmark>)) => {
      latest.current = typeof next === "function" ? next(latest.current) : next;
      setHeld(latest.current);
    },
    [],
  );

  // Writes go one after another, and the first waits for the read. Each opens
  // the store on its own, and two opened close together (a drop, then the
  // rename a moment later) could otherwise finish in either order — and the
  // older set, landing last, would quietly put the old name back.
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    let live = true;
    const read = readBookmarkSet().then((got) => {
      if (!live) return;
      const set = got.bookmarks;
      // A drop made in the moment before the read landed is kept, not overwritten.
      setBookmarks((now) => ({
        marks: now.marks.length === 0 ? set : [...set, ...now.marks.filter((b) => !set.some((s) => s.id === b.id))],
        removed: joinRemovals(got.removed, now.removed),
      }));
      setLoaded(true);
    });
    queue.current = read;
    return () => {
      live = false;
    };
  }, [setBookmarks]);

  const write = useCallback(
    (next: HeldSet<Bookmark>, said: string) => {
      setBookmarks(next);
      // The set written is the one held when its turn comes, not the one at the
      // commit: a commit made before the read landed did not yet hold what was read.
      queue.current = queue.current
        .then(() => writeBookmarks([...latest.current.marks], latest.current.removed))
        .then((ok) => {
          if (!ok) announce(notSaved);
          else if (said) announce(said);
        });
    },
    [announce, notSaved, setBookmarks],
  );
  // Undo hears the bookmarks alone; the list of what was taken away is worked
  // out afresh at each change and each Undo, as the notes' is.
  const commit = useCallback(
    (next: Bookmark[], said: string, how?: CommitHow) => {
      const tracked = trackSet(latest.current, next, Date.now(), bookmarkChangedAt, touchBookmark);
      if (!how?.unrecorded) record?.(latest.current.marks, tracked.marks, said);
      write(tracked, said);
    },
    [record, write],
  );
  const restore = useCallback(
    (set: unknown, said: string, leaving?: unknown) => {
      const to = set as readonly Bookmark[];
      const next = leaving ? stepOnto(latest.current.marks, to, leaving as readonly Bookmark[]) : to;
      write(trackSet(latest.current, next, Date.now(), bookmarkChangedAt, touchBookmark), said);
    },
    [write],
  );
  const loadFile = useCallback(
    (fileBookmarks: readonly Bookmark[], fileRemoved: readonly Removal[] = [], say?: (added: number) => string) => {
      const now = latest.current;
      const merged = mergeBookmarkFile(now.marks, now.removed, fileBookmarks, fileRemoved);
      write({ marks: merged.bookmarks, removed: merged.removed }, say?.(merged.added) ?? "");
      return merged.added;
    },
    [write],
  );

  return {
    bookmarks: held.marks,
    removed: held.removed,
    loaded,
    commit,
    loadFile,
    restore,
    saved: () => queue.current,
  };
}

/** One kind of mark as held: the marks, and the ones taken away (removals.ts). */
interface HeldSet<T> {
  readonly marks: readonly T[];
  readonly removed: readonly Removal[];
}

const NOTHING: HeldSet<never> = { marks: [], removed: [] };

/** The set after a change, with what it took away remembered and what it put back stamped newer. */
function trackSet<T extends { readonly id: string }>(
  from: HeldSet<T>,
  next: readonly T[],
  now: number,
  changedAt: (x: T) => number,
  touch: (x: T, now: number) => T,
): HeldSet<T> {
  const got = trackRemovals(from.removed, from.marks, next, now, changedAt, touch);
  return { marks: got.after, removed: got.removed };
}

/**
 * How long a page has to stay open before the seam moves to it. Long enough that
 * a quick jump to glance at another ayah and back leaves the seam where the
 * reading is; short enough that turning onward carries it along.
 */
export const SEAM_DWELL_MS = 6000;

/**
 * The seam: the one red ribbon that marks where the reader left off. Nobody
 * places it — it follows the last page the reader stayed on (`SEAM_DWELL_MS`),
 * and is written to the phone each time it moves.
 *
 * `waitForTurn`: the app was opened with no address, so the first page shown is
 * the one it opens on by itself, not one the reader chose. Staying there does not
 * move the seam until the reader has gone to another page at least once.
 * Otherwise a first open shows a "Left off" mark on a page nobody read, and every
 * launch (which opens there too) would take the reader's place away after a few
 * seconds. Found walking a fresh install as the store's reviewer would, 2026-11-17.
 */
export function useSeam(page: number | null, { waitForTurn = false } = {}): number | null {
  const [seam, setSeam] = useState<number | null>(null);
  const opening = useRef<number | null>(null);
  const left = useRef(false);

  useEffect(() => {
    let live = true;
    void readSeam().then((s) => {
      // A move made before the read landed wins over what was stored.
      if (live && s) setSeam((now) => now ?? s.page);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (page === null) return;
    opening.current ??= page;
    if (page !== opening.current) left.current = true;
    if (waitForTurn && !left.current) return;
    const timer = setTimeout(() => {
      setSeam(page);
      void writeSeam({ page, at: Date.now() });
    }, SEAM_DWELL_MS);
    return () => clearTimeout(timer);
  }, [page, waitForTurn]);

  return seam;
}

/**
 * The reader's notes, held like the bookmarks: read once, every change written
 * back whole, one write after another. `said` may be empty, for a change that
 * needs no spoken line of its own (the box opening on a fresh pin).
 *
 * The device keeps notes that gather verses (docs/design/scoped-notes.md), but
 * until the note tool and the note list know them, the page still draws one pin
 * per pinned verse and the app still changes notes through those pins. So
 * `notes` is the pins and the marked mistakes, and `commit` takes a changed set
 * of them back into the notes the device keeps.
 */
export function useNotes(
  announce: (line: string) => void,
  notSaved: string,
  record?: Recorder,
): {
  notes: readonly Note[];
  scoped: readonly ScopedNote[];
  /** The notes the reader took away, by id and time, for the copy to carry (removals.ts). */
  removed: readonly Removal[];
  /** True once the saved notes have been read in; nothing is written before. */
  loaded: boolean;
  commit: (next: Note[], said: string, how?: CommitHow) => void;
  /** Replace the notes that gather verses outright, as joining a note and its Undo do. */
  commitScoped: (next: readonly ScopedNote[], said: string, how?: CommitHow) => void;
  loadFile: (fileNotes: readonly Note[], fileScoped: readonly ScopedNote[], fileRemoved?: readonly Removal[]) => number;
  /** Undo or Redo: go to `held` from `leaving`, changing only what that step changed (stepOnto). */
  restore: (held: unknown, said: string, leaving?: unknown) => void;
  /** Settles once every write asked for so far has reached disk. */
  saved: () => Promise<unknown>;
} {
  const [held, setHeld] = useState<Held>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  // The latest notes, for the write: a write queued before the read landed
  // must still write what the reader has now, not what they had then.
  const latest = useRef<Held>(EMPTY);
  // What the device held when it was read, or null when it could not be read
  // (or not yet): nothing is written without it, so a failed read can never
  // overwrite the backup with an empty set.
  const stored = useRef<HeldNotes | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const hold = useCallback((next: Held) => {
    latest.current = next;
    setHeld(next);
  }, []);

  useEffect(() => {
    let live = true;
    const read = loadNotes().then((got) => {
      if (!live || !got) return;
      stored.current = got;
      // Notes made before the read landed are kept beside what was read. A note
      // left open and never written when the app last closed is not.
      const now = latest.current;
      const kept = dropUnwritten(got.scoped);
      hold({
        scoped: [...kept, ...now.scoped.filter((n) => !got.scoped.some((s) => s.id === n.id))],
        mistakes: [...got.mistakes, ...now.mistakes.filter((n) => !got.mistakes.some((s) => s.id === n.id))],
        removed: joinRemovals(got.removed, now.removed),
      });
      setLoaded(true);
    });
    queue.current = read;
    return () => {
      live = false;
    };
  }, [hold]);

  const save = useCallback(
    (said: string) => {
      queue.current = queue.current
        .then(() => {
          const from = stored.current;
          if (!from) return false;
          const now = latest.current;
          return writeAllNotes([...from.backup, ...now.mistakes], now.scoped, now.removed);
        })
        .then((ok) => {
          if (!ok) announce(notSaved);
          else if (said) announce(said);
        });
    },
    [announce, notSaved],
  );

  // Undo hears the notes as a whole, before and after: the notes that gather
  // verses and the mistakes together, so taking a change back is one write.
  // It never hears the list of what was taken away: `restore` works that out
  // afresh, and a list that grew under a change that changed nothing (a pin
  // dropped and closed empty) would otherwise leave an Undo that does nothing.
  const change = useCallback(
    (next: Marks, said: string, how?: CommitHow) => {
      const tracked = track(latest.current, next, Date.now());
      if (!how?.unrecorded) record?.(marksOf(latest.current), marksOf(tracked), said, how?.opens);
      hold(tracked);
      save(said);
    },
    [hold, record, save],
  );

  const commit = useCallback(
    (next: Note[], said: string, how?: CommitHow) =>
      change(
        {
          scoped: fromPins(
            latest.current.scoped,
            next.filter((n) => !isMistake(n)),
            Date.now(),
          ),
          mistakes: next.filter(isMistake),
        },
        said,
        how,
      ),
    [change],
  );

  const commitScoped = useCallback(
    (next: readonly ScopedNote[], said: string, how?: CommitHow) =>
      change({ scoped: [...next], mistakes: latest.current.mistakes }, said, how),
    [change],
  );

  // Undo and Redo put back the notes they held, but the list of what was taken
  // away is worked out from what the device holds now, never taken from the
  // snapshot: a deletion the snapshot predates still happened, and a note Undo
  // brings back must be stamped newer than its deletion.
  const restore = useCallback(
    (held: unknown, said: string, leaving?: unknown) => {
      const to = held as Marks;
      const from = leaving as Marks | undefined;
      const now = latest.current;
      const next: Marks = from
        ? { scoped: stepOnto(now.scoped, to.scoped, from.scoped), mistakes: stepOnto(now.mistakes, to.mistakes, from.mistakes) }
        : to;
      hold(track(now, next, Date.now()));
      save(said);
    },
    [hold, save],
  );

  const loadFile = useCallback(
    (fileNotes: readonly Note[], fileScoped: readonly ScopedNote[], fileRemoved: readonly Removal[] = []) => {
      const now = latest.current;
      const merged = mergeNotesFile(now.scoped, now.mistakes, fileNotes, fileScoped, now.removed, fileRemoved);
      hold({ scoped: merged.scoped, mistakes: merged.mistakes, removed: merged.removed });
      save("");
      return merged.added;
    },
    [hold, save],
  );

  const notes = useMemo(() => [...pinsOf(held.scoped), ...held.mistakes], [held]);
  return {
    notes,
    scoped: held.scoped,
    removed: held.removed,
    loaded,
    commit,
    commitScoped,
    loadFile,
    restore,
    saved: () => queue.current,
  };
}

interface Held {
  readonly scoped: ScopedNote[];
  readonly mistakes: Note[];
  readonly removed: Removal[];
}

/** The notes themselves, without the list of what was taken away. */
type Marks = Pick<Held, "scoped" | "mistakes">;

const marksOf = (h: Held): Marks => ({ scoped: h.scoped, mistakes: h.mistakes });

const EMPTY: Held = { scoped: [], mistakes: [], removed: [] };

/**
 * The notes after a change, with what the change took away remembered and a
 * note it put back stamped newer than its removal (removals.ts). A note that
 * gathers verses counts as changed when it was last edited or used; a mistake
 * when it was last edited.
 */
function track(from: Held, next: Marks, now: number): Held {
  const scoped = trackRemovals(
    from.removed,
    from.scoped,
    next.scoped,
    now,
    (n) => Math.max(n.updatedAt, n.usedAt),
    (n, at) => ({ ...n, usedAt: at }),
  );
  const mistakes = trackRemovals(
    scoped.removed,
    from.mistakes,
    next.mistakes,
    now,
    (n) => n.updatedAt,
    (n, at) => ({ ...n, updatedAt: at }),
  );
  return { scoped: scoped.after, mistakes: mistakes.after, removed: mistakes.removed };
}

/**
 * The reader's confusion jumps (docs/design/confusion-jumps.md), held like the
 * notes: read once, every change written back whole, one write after another,
 * and nothing written until the read has landed, so a failed read never
 * overwrites what the device holds. `device` is this install's id, for the
 * time a jump is marked; null until it is read, or when there is no store.
 */
export function useConfusions(
  announce: (line: string) => void,
  notSaved: string,
  record?: Recorder,
): {
  confusions: readonly Confusion[];
  /** The jumps the reader took away, by id and time, for the copy to carry (removals.ts, ㉒). */
  removed: readonly Removal[];
  device: Device | null;
  /** True once the saved jumps have been read in; nothing is written before. */
  loaded: boolean;
  /** True once the read has finished, whether it found the store or not. */
  ready: boolean;
  commit: (next: readonly Confusion[], said: string, how?: CommitHow) => void;
  loadFile: (fileJumps: readonly Confusion[], fileRemoved?: readonly Removal[]) => number;
  /** Undo or Redo: go to `jumps` from `leaving`, changing only what that step changed (stepOnto). */
  restore: (jumps: unknown, said: string, leaving?: unknown) => void;
  /** Settles once every write asked for so far has reached disk. */
  saved: () => Promise<unknown>;
} {
  const [held, setHeld] = useState<HeldSet<Confusion>>(NOTHING);
  const [device, setDevice] = useState<Device | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const latest = useRef<HeldSet<Confusion>>(NOTHING);
  const read = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const hold = useCallback((next: HeldSet<Confusion>) => {
    latest.current = next;
    setHeld(next);
  }, []);

  useEffect(() => {
    let live = true;
    void readDevice(typeof navigator === "undefined" ? "" : navigator.userAgent).then((d) => {
      if (live) setDevice(d);
    });
    queue.current = readConfusionSet().then((got) => {
      if (!live) return;
      setReady(true);
      if (!got) return;
      read.current = true;
      // Jumps marked before the read landed are kept beside what was read.
      const now = latest.current;
      hold({ marks: mergeConfusions(got.confusions, now.marks), removed: joinRemovals(got.removed, now.removed) });
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [hold]);

  const save = useCallback(
    (said: string) => {
      queue.current = queue.current
        .then(() => (read.current ? writeConfusions(latest.current.marks, latest.current.removed) : false))
        .then((ok) => {
          if (!ok) announce(notSaved);
          else if (said) announce(said);
        });
    },
    [announce, notSaved],
  );

  // As with the bookmarks, Undo hears the jumps alone.
  const commit = useCallback(
    (next: readonly Confusion[], said: string, how?: CommitHow) => {
      const tracked = trackSet(latest.current, next, Date.now(), confusionChangedAt, touchConfusion);
      if (!how?.unrecorded) record?.(latest.current.marks, tracked.marks, said);
      hold(tracked);
      save(said);
    },
    [hold, record, save],
  );
  const restore = useCallback(
    (jumps: unknown, said: string, leaving?: unknown) => {
      const to = jumps as readonly Confusion[];
      const next = leaving ? stepOnto(latest.current.marks, to, leaving as readonly Confusion[]) : to;
      hold(trackSet(latest.current, next, Date.now(), confusionChangedAt, touchConfusion));
      save(said);
    },
    [hold, save],
  );

  const loadFile = useCallback(
    (fileJumps: readonly Confusion[], fileRemoved: readonly Removal[] = []) => {
      const now = latest.current;
      const merged = mergeConfusionsFile(now.marks, now.removed, fileJumps, fileRemoved);
      hold({ marks: merged.confusions, removed: merged.removed });
      save("");
      return merged.added;
    },
    [hold, save],
  );

  return {
    confusions: held.marks,
    removed: held.removed,
    device,
    loaded,
    ready,
    commit,
    loadFile,
    restore,
    saved: () => queue.current,
  };
}
