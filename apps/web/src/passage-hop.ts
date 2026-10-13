import { useEffect, useState } from "react";
import type { Edge } from "@hifth/core";

/**
 * Where a passage row's arrow lands, and where the reader's choice is kept.
 *
 * A passage row names the verse inside the passage that is most alike (15:30's
 * row for 38:72 to 38:75 says "most alike: 38:73"), but its arrow landed on the
 * passage's first verse, so a hafiz had to find the alike verse themselves
 * (docs/design/lookalike-rows.md, item 17). The owner chose on 2026-10-12;
 * the other way stays a setting:
 *
 *   alike  the arrow lands on the verse the row names as most alike (the default)
 *   first  it lands on the passage's first verse, where the outside list points
 */
export type PassageHop = "alike" | "first";

/** In settings order. */
export const PASSAGE_HOPS: readonly PassageHop[] = ["alike", "first"];

/** Versioned: a way that later changes what it does gets a new key. */
export const PASSAGE_HOP_KEY = "hifth.passage-hop.v1";

function isPassageHop(value: unknown): value is PassageHop {
  return value === "alike" || value === "first";
}

/** The way this device chose, or the most-alike verse when it never chose. */
export function savedPassageHop(): PassageHop {
  try {
    const stored = localStorage.getItem(PASSAGE_HOP_KEY);
    return isPassageHop(stored) ? stored : "alike";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "alike";
  }
}

/** The verse a look-alike's arrow lands on, the way the reader chose. */
export function passageLanding(edge: Pick<Edge, "to" | "like">, choice: PassageHop): string {
  return choice === "alike" && edge.like ? edge.like.to : edge.to;
}

const heard = new Set<(choice: PassageHop) => void>();

export function rememberPassageHop(choice: PassageHop): void {
  try {
    localStorage.setItem(PASSAGE_HOP_KEY, choice);
  } catch {
    /* nothing to do — see savedPassageHop */
  }
  for (const tell of heard) tell(choice);
}

/** The reader's choice, kept current as they change it in settings. */
export function usePassageHop(): PassageHop {
  const [choice, setChoice] = useState<PassageHop>(savedPassageHop);
  useEffect(() => {
    heard.add(setChoice);
    return () => {
      heard.delete(setChoice);
    };
  }, []);
  return choice;
}
