import { useEffect, useState } from "react";
import type { CompareWay } from "@hifth/core";

/**
 * How two look-alike verses that share words in more than one place are
 * compared, and where the reader's choice is kept.
 *
 * About 150 look-alike rows share a run of words that comes more than once, so
 * no single place can be marked. Both ways of opening them were built
 * (docs/design/knowledge-graph-commentary.md, item 49); the default marks every
 * stretch, and the other stays here as a setting:
 *
 *   every  every stretch of two words or more the two share is washed
 *   plain  both verses as printed, side by side, nothing marked
 *
 * Rows whose words have only a loose likeness open plain either way; rows with
 * one shared stretch keep their single mark either way.
 */
export type LookalikeCompare = CompareWay;

/** In settings order. */
export const LOOKALIKE_COMPARES: readonly LookalikeCompare[] = ["every", "plain"];

/** Versioned: a way that later changes what it does gets a new key. */
export const LOOKALIKE_COMPARE_KEY = "hifth.lookalike-compare.v1";

function isLookalikeCompare(value: unknown): value is LookalikeCompare {
  return value === "every" || value === "plain";
}

/** The way this device chose, or every stretch marked when it never chose. */
export function savedLookalikeCompare(): LookalikeCompare {
  try {
    const stored = localStorage.getItem(LOOKALIKE_COMPARE_KEY);
    return isLookalikeCompare(stored) ? stored : "every";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "every";
  }
}

const heard = new Set<(choice: LookalikeCompare) => void>();

export function rememberLookalikeCompare(choice: LookalikeCompare): void {
  try {
    localStorage.setItem(LOOKALIKE_COMPARE_KEY, choice);
  } catch {
    /* nothing to do — see savedLookalikeCompare */
  }
  for (const tell of heard) tell(choice);
}

/** The reader's choice, kept current as they change it in settings. */
export function useLookalikeCompare(): LookalikeCompare {
  const [choice, setChoice] = useState<LookalikeCompare>(savedLookalikeCompare);
  useEffect(() => {
    heard.add(setChoice);
    return () => {
      heard.delete(setChoice);
    };
  }, []);
  return choice;
}
