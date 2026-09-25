import { useCallback, useEffect, useState } from "react";
import type { Bookmark } from "@hifth/core";
import { readBookmarks, writeBookmarks } from "./bookmark-store";

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
