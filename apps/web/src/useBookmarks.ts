import { useCallback, useEffect, useState } from "react";
import type { Bookmark } from "@hifth/core";
import { readBookmarks, readSeam, writeBookmarks, writeSeam } from "./bookmark-store";

/**
 * The reader's bookmarks, held for the app: loaded from the phone once, and every
 * change written back whole (the storage model's "written all at once").
 *
 * Every change goes through `commit`, which takes the next set from one of the
 * core rules and says one line about it. When the phone refuses the write the
 * line is replaced by `notSaved`, so a reader is never told a bookmark was
 * dropped that will not be there tomorrow.
 */
export function useBookmarks(
  announce: (line: string) => void,
  notSaved: string,
): {
  bookmarks: readonly Bookmark[];
  commit: (next: Bookmark[], said: string) => void;
} {
  const [bookmarks, setBookmarks] = useState<readonly Bookmark[]>([]);

  useEffect(() => {
    let live = true;
    void readBookmarks().then((set) => {
      if (!live) return;
      // A drop made in the moment before the read landed is kept, not overwritten.
      setBookmarks((now) => (now.length === 0 ? set : [...set, ...now.filter((b) => !set.some((s) => s.id === b.id))]));
    });
    return () => {
      live = false;
    };
  }, []);

  const commit = useCallback(
    (next: Bookmark[], said: string) => {
      setBookmarks(next);
      void writeBookmarks(next).then((ok) => announce(ok ? said : notSaved));
    },
    [announce, notSaved],
  );

  return { bookmarks, commit };
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
 */
export function useSeam(page: number | null): number | null {
  const [seam, setSeam] = useState<number | null>(null);

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
    const timer = setTimeout(() => {
      setSeam(page);
      void writeSeam({ page, at: Date.now() });
    }, SEAM_DWELL_MS);
    return () => clearTimeout(timer);
  }, [page]);

  return seam;
}
