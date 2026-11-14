/**
 * When the list behind a jump mark offers to mark a jump beaten
 * (docs/design/confusion-points.md ⑤; owner, 2026-11-08: "a quiet
 * suggestion, yours to accept").
 *
 * Whether a jump is beaten is the reader's to say: the app sees the times a
 * jump was marked, not the recitations where it did not happen, so silence
 * could mean "I beat it" or "I stopped marking". So the app never sets it. A
 * jump not made in a long while carries one quiet line in its row offering
 * Beaten, and nothing changes until the reader presses it. How long "a long
 * while" is, or whether to offer at all, is a setting:
 *
 *   six-weeks     the default, the design's own example
 *   three-months  for a reader who revises a juz less often
 *   never         no offer; Beaten stays a button like the others
 *
 * Its own module, free of React and CSS, so the e2e tier imports the key rather
 * than retyping it — the discipline `drawer-tools.ts` keeps.
 */

export type BeatenOffer = "six-weeks" | "three-months" | "never";

/** In settings order. */
export const BEATEN_OFFERS: readonly BeatenOffer[] = ["six-weeks", "three-months", "never"];

/** Versioned: an option that later changes what it does gets a new key. */
export const BEATEN_OFFER_KEY = "hifth.jumps.beaten-offer.v1";

const DAY = 24 * 60 * 60 * 1000;

/** How long a jump must have gone unmade before the offer shows. */
const WAIT: Record<Exclude<BeatenOffer, "never">, number> = {
  "six-weeks": 42 * DAY,
  "three-months": 91 * DAY,
};

function isBeatenOffer(value: unknown): value is BeatenOffer {
  return value === "six-weeks" || value === "three-months" || value === "never";
}

/** The option this device chose, or six weeks when it never chose. */
export function savedBeatenOffer(): BeatenOffer {
  try {
    const stored = localStorage.getItem(BEATEN_OFFER_KEY);
    return isBeatenOffer(stored) ? stored : "six-weeks";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "six-weeks";
  }
}

export function rememberBeatenOffer(choice: BeatenOffer): void {
  try {
    localStorage.setItem(BEATEN_OFFER_KEY, choice);
  } catch {
    /* nothing to do — see savedBeatenOffer */
  }
}

/**
 * Whether a row offers Beaten: it says where the jump went, is not beaten
 * already, and was last made at least the chosen while ago.
 */
export function offersBeaten(
  row: { to: string | null; beaten: boolean; lastAt: number },
  now: number,
  choice: BeatenOffer,
): boolean {
  if (choice === "never" || row.to === null || row.beaten) return false;
  return now - row.lastAt >= WAIT[choice];
}
