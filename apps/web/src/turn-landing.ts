import { useEffect, useState } from "react";

/**
 * Where a page turn lands on a page taller than the screen, and where the
 * reader's choice is kept.
 *
 * Held upright, a large iPad opens a verse's page a little bigger than the
 * screen, so a hafiz reads down to its foot and turns. A turn kept the same
 * lines in view, so the next page opened on its lower half and they slid it
 * down to start at the top (docs/PLAN.md, items 75 and 97). The owner chose on
 * 2026-10-13; the other way stays a setting:
 *
 *   top   at the size the page opened at, a turn forward lands at the top of
 *         the next page and a turn back at the foot of the one before (the
 *         default). A page the reader zoomed in on still keeps the same lines.
 *   same  every turn keeps the same lines in view, at any size
 */
export type TurnLanding = "top" | "same";

/** In settings order. */
export const TURN_LANDINGS: readonly TurnLanding[] = ["top", "same"];

/** Versioned: a way that later changes what it does gets a new key. */
export const TURN_LANDING_KEY = "hifth.turn-landing.v1";

function isTurnLanding(value: unknown): value is TurnLanding {
  return value === "top" || value === "same";
}

/** The way this device chose, or the top of the page when it never chose. */
export function savedTurnLanding(): TurnLanding {
  try {
    const stored = localStorage.getItem(TURN_LANDING_KEY);
    return isTurnLanding(stored) ? stored : "top";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "top";
  }
}

/**
 * Where the incoming page's top edge should sit for this turn: "top" or
 * "foot" of the page, or null to keep the reader's view as it is.
 *
 * `z` is the size the page is drawn at now and `opened` the size it opened at;
 * they differ once the reader zooms, and then the turn keeps the same lines.
 * Page numbers rise as the mus'haf is read, so a higher page is a turn forward.
 */
export function turnLandsAt(
  from: number,
  to: number,
  z: number,
  opened: number | null,
  choice: TurnLanding,
): "top" | "foot" | null {
  if (choice !== "top" || from === to || opened === null) return null;
  if (Math.abs(z - opened) > 0.005) return null;
  return to > from ? "top" : "foot";
}

const heard = new Set<(choice: TurnLanding) => void>();

export function rememberTurnLanding(choice: TurnLanding): void {
  try {
    localStorage.setItem(TURN_LANDING_KEY, choice);
  } catch {
    /* nothing to do — see savedTurnLanding */
  }
  for (const tell of heard) tell(choice);
}

/** The reader's choice, kept current as they change it in settings. */
export function useTurnLanding(): TurnLanding {
  const [choice, setChoice] = useState<TurnLanding>(savedTurnLanding);
  useEffect(() => {
    heard.add(setChoice);
    return () => {
      heard.delete(setChoice);
    };
  }, []);
  return choice;
}
