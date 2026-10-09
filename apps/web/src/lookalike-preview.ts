import { useEffect, useState } from "react";
import type { Edge } from "@hifth/core";

/**
 * What a closed look-alike row shows of the words the two verses share, and
 * where the reader's choice is kept (docs/design/lookalike-rows.md, item 6).
 *
 * A row whose two verses share one stretch had nothing under its name; the
 * shared words, which are exactly where a hafiz slides, showed only once the
 * row was opened. Every way is built and kept here as a setting:
 *
 *   picture  the shared words cut from the printed page, under the row's name
 *   count    how many words they share ("Shares 4 words")
 *   none     the row as it was; the comparison is one tap away
 */
export type LookalikePreview = "picture" | "count" | "none";

/** In settings order. */
export const LOOKALIKE_PREVIEWS: readonly LookalikePreview[] = ["picture", "count", "none"];

/** Versioned: a way that later changes what it does gets a new key. */
export const LOOKALIKE_PREVIEW_KEY = "hifth.lookalike-preview.v1";

const DEFAULT: LookalikePreview = "picture";

function isLookalikePreview(value: unknown): value is LookalikePreview {
  return value === "picture" || value === "count" || value === "none";
}

/** The way this device chose, or the picture when it never chose. */
export function savedLookalikePreview(): LookalikePreview {
  try {
    const stored = localStorage.getItem(LOOKALIKE_PREVIEW_KEY);
    return isLookalikePreview(stored) ? stored : DEFAULT;
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return DEFAULT;
  }
}

const heard = new Set<(choice: LookalikePreview) => void>();

export function rememberLookalikePreview(choice: LookalikePreview): void {
  try {
    localStorage.setItem(LOOKALIKE_PREVIEW_KEY, choice);
  } catch {
    /* nothing to do — see savedLookalikePreview */
  }
  for (const tell of heard) tell(choice);
}

/** The reader's choice, kept current as they change it in settings. */
export function useLookalikePreview(): LookalikePreview {
  const [choice, setChoice] = useState<LookalikePreview>(savedLookalikePreview);
  useEffect(() => {
    heard.add(setChoice);
    return () => {
      heard.delete(setChoice);
    };
  }, []);
  return choice;
}

/** The other verse's shared words, as the print numbers them. */
export interface SharedRun {
  /** Bare `"2:123"`: the verse the words are cut from. */
  readonly key: string;
  /** The page that verse is printed on. */
  readonly page: number;
  readonly from: number;
  readonly to: number;
  /** How many print words the run covers. */
  readonly words: number;
}

/**
 * The run a closed row shows, or null when the pair does not share one stretch
 * (a pair alike loosely, or whose words come more than once, already says so in
 * its own line). It is the other verse's side, because the reader knows their
 * own verse; for a passage, the verse inside it that matches best.
 */
export function sharedRun(edge: Edge): SharedRun | null {
  if (edge.match || !edge.span || !edge.toSpan) return null;
  const [from, to] = edge.toSpan.from;
  if (to < from || edge.span.from[1] < edge.span.from[0]) return null;
  const key = (edge.like?.to ?? edge.to).split("/").pop() as string;
  return { key, page: edge.like?.page ?? edge.page, from, to, words: to - from + 1 };
}
