import { useEffect, useState } from "react";

/**
 * How the red "where you left off" ribbon is told apart from the bookmarks a
 * reader drops (decision bookmark-fold, open question ①). The owner, on the
 * app's page: "these bookmarks are confusing with the red one" — both were
 * drawn as ribbons, and nothing said which was which.
 *
 *   label    the red ribbon keeps its place down the fold and says "Left off"
 *            in a small label at its head (the default)
 *   mark     the red ribbon becomes a small red mark at the head of the fold,
 *            so it no longer looks like a ribbon at all
 *   tabs     the bookmarks become small tabs with their names on them, so only
 *            the red one is a ribbon
 *   ribbons  both stay ribbons, as before
 *
 * Its own module, free of CSS, so the e2e tier imports the key rather than
 * retyping it — the discipline `ribbon-length.ts` keeps.
 */
export type LeftOffLook = "label" | "mark" | "tabs" | "ribbons";

/** In settings order. */
export const LEFT_OFF_LOOKS: readonly LeftOffLook[] = ["label", "mark", "tabs", "ribbons"];

/** Versioned: a way that later changes what it does gets a new key. */
export const LEFT_OFF_LOOK_KEY = "hifth.left-off-look.v1";

const DEFAULT: LeftOffLook = "label";

function isLeftOffLook(value: unknown): value is LeftOffLook {
  return value === "label" || value === "mark" || value === "tabs" || value === "ribbons";
}

/** The way this device chose, or the label when it never chose. */
export function savedLeftOffLook(): LeftOffLook {
  try {
    const stored = localStorage.getItem(LEFT_OFF_LOOK_KEY);
    return isLeftOffLook(stored) ? stored : DEFAULT;
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return DEFAULT;
  }
}

const heard = new Set<(choice: LeftOffLook) => void>();

export function rememberLeftOffLook(choice: LeftOffLook): void {
  try {
    localStorage.setItem(LEFT_OFF_LOOK_KEY, choice);
  } catch {
    /* nothing to do — see savedLeftOffLook */
  }
  for (const tell of heard) tell(choice);
}

/** The reader's choice, kept current as they change it in settings. */
export function useLeftOffLook(): LeftOffLook {
  const [choice, setChoice] = useState<LeftOffLook>(savedLeftOffLook);
  useEffect(() => {
    heard.add(setChoice);
    return () => {
      heard.delete(setChoice);
    };
  }, []);
  return choice;
}

/**
 * How far the "Left off" label slides along the red ribbon to stay on the
 * screen, in screen pixels. Centred on the ribbon when there is room; where the
 * page runs to the screen's edge, as on a phone (walking it at 390 wide,
 * 2026-11-13, a centred label hung half off and read "off"), it slides inward
 * until it is `margin` inside — but never off the ribbon itself, so it always
 * touches it: at most half its width, plus half the ribbon's, either way.
 */
export function labelNudge(seamCentre: number, labelWidth: number, screenWidth: number, seamWidth = 0, margin = 4): number {
  const half = labelWidth / 2;
  const reach = half + seamWidth / 2;
  const fromLeft = margin - (seamCentre - half);
  const fromRight = screenWidth - margin - (seamCentre + half);
  const want = fromLeft > 0 ? fromLeft : fromRight < 0 ? fromRight : 0;
  return Math.max(-reach, Math.min(reach, want));
}
