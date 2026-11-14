import { useEffect, useState } from "react";

/**
 * How a reader drops and lifts a bookmark by hand (decision bookmark-fold ②).
 * The owner, on the app's page (2026-11-07): "how do I interact with the
 * bookmark? how do I pull it down? pull it up?" Until then a bookmark was clicks
 * only: a click on the top outer corner dropped one, a click on a ribbon opened
 * it. Built four ways, kept here as a setting:
 *
 *   both    pull a new ribbon down out of the corner, push one back up to lift
 *           it, and the corner sits a little further folded so it is found
 *           (the default)
 *   pull    the pulling and pushing, with the corner as small as before
 *   corner  clicks only, with the clearer corner
 *   clicks  clicks only, as before
 *
 * The clicks keep working in every way: a press that does not move is a click.
 */
export type BookmarkHand = "both" | "pull" | "corner" | "clicks";

/** In settings order. */
export const BOOKMARK_HANDS: readonly BookmarkHand[] = ["both", "pull", "corner", "clicks"];

/** Versioned: a way that later changes what it does gets a new key. */
export const BOOKMARK_HAND_KEY = "hifth.bookmark.hand.v1";

const DEFAULT: BookmarkHand = "both";

function isBookmarkHand(value: unknown): value is BookmarkHand {
  return value === "both" || value === "pull" || value === "corner" || value === "clicks";
}

/** The way this device chose, or the default when it never chose. */
export function savedBookmarkHand(): BookmarkHand {
  try {
    const stored = localStorage.getItem(BOOKMARK_HAND_KEY);
    return isBookmarkHand(stored) ? stored : DEFAULT;
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return DEFAULT;
  }
}

const heard = new Set<(choice: BookmarkHand) => void>();

export function rememberBookmarkHand(choice: BookmarkHand): void {
  try {
    localStorage.setItem(BOOKMARK_HAND_KEY, choice);
  } catch {
    /* nothing to do — see savedBookmarkHand */
  }
  for (const tell of heard) tell(choice);
}

/** The reader's choice, kept current as they change it in settings. */
export function useBookmarkHand(): BookmarkHand {
  const [choice, setChoice] = useState<BookmarkHand>(savedBookmarkHand);
  useEffect(() => {
    heard.add(setChoice);
    return () => {
      heard.delete(setChoice);
    };
  }, []);
  return choice;
}

/** Whether ribbons are pulled down and pushed up by hand in this way. */
export const pullsByHand = (hand: BookmarkHand): boolean => hand === "both" || hand === "pull";

/** Whether the corner rests a little further folded, so it is found. */
export const clearCorner = (hand: BookmarkHand): boolean => hand === "both" || hand === "corner";

/** How far, in pixels, a press may wander and still be a click. */
export const PULL_SLOP = 6;

/** How far down the corner must be pulled before letting go drops a bookmark. */
export const PULL_TO_DROP = 36;

/** How far up a ribbon `length` pixels long must be pushed before letting go lifts it. */
export const pushToLift = (length: number): number => Math.max(12, length / 2);

export type PullVerdict = "click" | "drop" | "lift" | "back";

/**
 * What letting go does, after a press on the corner or a ribbon that moved
 * `dx` across and `dy` down (up is negative). A press that hardly moved is a
 * click; a pull that went far enough drops or lifts; anything short of that
 * goes back where it was.
 */
export function pullVerdict(on: "corner" | "ribbon", dx: number, dy: number, length = 0): PullVerdict {
  if (Math.hypot(dx, dy) <= PULL_SLOP) return "click";
  if (on === "corner") return dy >= PULL_TO_DROP ? "drop" : "back";
  return -dy >= pushToLift(length) ? "lift" : "back";
}

/**
 * How much of the ribbon shows while it is being pulled or pushed: for the
 * corner, how far a new ribbon has come down (no further than `most`); for a
 * ribbon, what share of its length is still hanging, from 1 (all) to 0.
 */
export function pullReach(on: "corner" | "ribbon", dy: number, length = 0, most = 120): number {
  if (on === "corner") return Math.min(Math.max(dy, 0), most);
  if (length <= 0) return 1;
  return Math.min(Math.max(1 + dy / length, 0), 1);
}
