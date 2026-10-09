import { useEffect, useState } from "react";

/**
 * How many related verses a note lists before the reader asks for more, and
 * where the reader's choice is kept.
 *
 * A note can point to more verses than its first few cards. Both ways of
 * reaching the rest were built (docs/design/knowledge-graph-commentary.md,
 * item 41); the line is the default, and the other stays here as a setting
 * rather than being thrown away:
 *
 *   line  the first few, then a line that says how many more and shows them
 *   all   every related verse at once
 *
 * Its own module, free of CSS, so the e2e tier imports the key rather than
 * retyping it — the discipline `card-edge.ts` keeps.
 */
export type RelatedList = "line" | "all";

/** In settings order. */
export const RELATED_LISTS: readonly RelatedList[] = ["line", "all"];

/** Versioned: a way that later changes what it does gets a new key. */
export const RELATED_LIST_KEY = "hifth.related.list.v1";

function isRelatedList(value: unknown): value is RelatedList {
  return value === "line" || value === "all";
}

/** The way this device chose, or the line when it never chose. */
export function savedRelatedList(): RelatedList {
  try {
    const stored = localStorage.getItem(RELATED_LIST_KEY);
    return isRelatedList(stored) ? stored : "line";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "line";
  }
}

const heard = new Set<(choice: RelatedList) => void>();

export function rememberRelatedList(choice: RelatedList): void {
  try {
    localStorage.setItem(RELATED_LIST_KEY, choice);
  } catch {
    /* nothing to do — see savedRelatedList */
  }
  for (const tell of heard) tell(choice);
}

/** The reader's choice, kept current as they change it in settings. */
export function useRelatedList(): RelatedList {
  const [choice, setChoice] = useState<RelatedList>(savedRelatedList);
  useEffect(() => {
    heard.add(setChoice);
    return () => {
      heard.delete(setChoice);
    };
  }, []);
  return choice;
}
