import { useEffect, useState } from "react";
import type { PassageRows } from "@hifth/core";

/**
 * What a look-alike list does with a passage row when a verse inside the
 * passage is listed on its own too, and where the reader's choice is kept.
 *
 * About 40 verses list both, mostly in the Moses and Iblis stories, so a hafiz
 * sees two or three rows for one memory (docs/design/knowledge-graph-commentary.md,
 * item 47). All three ways are built and kept here as a setting; until the owner
 * picks, the list stays as it was:
 *
 *   both   every row where it was
 *   group  the verses inside the passage sit, indented, right under it
 *   drop   the passage row is left out; its verses keep their own rows
 */
export type { PassageRows };

/** In settings order. */
export const PASSAGE_ROWS: readonly PassageRows[] = ["both", "group", "drop"];

/** Versioned: a way that later changes what it does gets a new key. */
export const PASSAGE_ROWS_KEY = "hifth.passage-rows.v1";

function isPassageRows(value: unknown): value is PassageRows {
  return value === "both" || value === "group" || value === "drop";
}

/** The way this device chose, or both rows when it never chose. */
export function savedPassageRows(): PassageRows {
  try {
    const stored = localStorage.getItem(PASSAGE_ROWS_KEY);
    return isPassageRows(stored) ? stored : "both";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "both";
  }
}

const heard = new Set<(choice: PassageRows) => void>();

export function rememberPassageRows(choice: PassageRows): void {
  try {
    localStorage.setItem(PASSAGE_ROWS_KEY, choice);
  } catch {
    /* nothing to do — see savedPassageRows */
  }
  for (const tell of heard) tell(choice);
}

/** The reader's choice, kept current as they change it in settings. */
export function usePassageRows(): PassageRows {
  const [choice, setChoice] = useState<PassageRows>(savedPassageRows);
  useEffect(() => {
    heard.add(setChoice);
    return () => {
      heard.delete(setChoice);
    };
  }, []);
  return choice;
}
