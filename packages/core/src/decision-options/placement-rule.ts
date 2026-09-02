/**
 * mark-placement (open decision, docs/decisions/mark-placement.md): every mark's
 * rectangle ships sitting a little off the letter it belongs to, in the same
 * direction on nearly every line. Six options correct it by different amounts —
 * from leaving it alone, through lining each page or each line up, to putting each
 * mark on its own found ink. Which one ships?
 *
 * The difference is *seen*: the reader watches a rectangle sit on, or off, the
 * letter. A still picture of one option cannot show the *move* from today onto the
 * correction, and it is the move — how far every box on the page slides, and where
 * it lands — that separates the options a reader cares about from the ones that
 * look the same standing still. So the six options are built as interchangeable
 * placement rules and mounted **live** on the decision page
 * (docs/design/mark-placement.html): one shared page of the mus'haf, and a switch
 * that re-places every rectangle in front of the reader. The winning rule
 * graduates into how the app places its rectangles; the losers are deleted.
 *
 * Each `place*` is a **standalone, self-contained** function — it reads only its
 * arguments and touches no module-scope symbol — so the very same compiled source
 * that the unit test runs is inlined by the page builder into the reader's browser,
 * and is the source the app would adopt. That is what makes "one component, used
 * live and in code" literally true rather than a claim about two copies kept in
 * step by hand.
 *
 * The corrections themselves are *measured*, not computed here: each rectangle
 * carries, alongside where it ships (`b`), the offset every grain of correction
 * would move it by (`o`). A rule's whole job is to pick which measured offset to
 * apply — so this module is the part a reader is choosing between, and nothing
 * about the measurement is re-litigated by swapping one rule for another.
 */

/** A grain of correction — how finely the page is lined up. */
export type Grain = "shipped" | "page" | "line" | "tilt" | "curve" | "mark";

/** A rectangle as it ships, plus where each grain of correction would move it. */
export interface PlaceableRect {
  /** Where the rectangle ships: `[x, y, width, height]`. */
  readonly b: readonly [number, number, number, number];
  /** The offset each grain would move it by: `o[grain] = [dx, dy]`. `shipped` moves nothing. */
  readonly o: { readonly [grain: string]: readonly [number, number] | undefined };
}

/** A placed rectangle: `[x, y, width, height]`, ready to draw. */
export type PlacedRect = [number, number, number, number];

/**
 * Move a rectangle by a grain's measured offset. `shipped` — and any grain the
 * rectangle carries no offset for — leaves it exactly where it is.
 */
export function placeBy(b: readonly [number, number, number, number], off: readonly [number, number] | undefined): PlacedRect {
  if (!off) return [b[0], b[1], b[2], b[3]];
  return [b[0] + off[0], b[1] + off[1], b[2], b[3]];
}

/** Place a mark under a rule: apply the rule's grain (marks always follow the grain). */
export function placeMark(rect: PlaceableRect, grain: Grain): PlacedRect {
  if (grain === "shipped") return [rect.b[0], rect.b[1], rect.b[2], rect.b[3]];
  return placeBy(rect.b, rect.o[grain]);
}

/**
 * Place a word under a rule. Most rules move words with their marks; option G
 * (`wordsStay`) leaves every word on the fit it ships with and corrects the marks
 * only, which is the whole difference between F and G.
 */
export function placeWord(rect: PlaceableRect, grain: Grain, wordsStay: boolean): PlacedRect {
  if (wordsStay || grain === "shipped") return [rect.b[0], rect.b[1], rect.b[2], rect.b[3]];
  return placeBy(rect.b, rect.o[grain]);
}

/** A placement rule plus how it presents itself, for the app and the decision page. */
export interface PlacementRule {
  readonly id: "A" | "B" | "F" | "G" | "I" | "H";
  /** The grain of correction marks follow. */
  readonly grain: Grain;
  /** Only option G: words keep the fit they ship with instead of following the grain. */
  readonly wordsStay: boolean;
  /** A short name for the switch on the decision page. */
  readonly label: string;
}

export const leaveAsIsRule: PlacementRule = {
  id: "A",
  grain: "shipped",
  wordsStay: false,
  label: "Leave the rectangles where they are",
};

export const perPageRule: PlacementRule = {
  id: "B",
  grain: "page",
  wordsStay: false,
  label: "Line each page up as a whole",
};

export const perLineTiltRule: PlacementRule = {
  id: "F",
  grain: "tilt",
  wordsStay: false,
  label: "Line each line up, and let it tilt",
};

export const marksOnlyRule: PlacementRule = {
  id: "G",
  grain: "tilt",
  wordsStay: true,
  label: "Line the marks up, leave the words",
};

export const perLineBendRule: PlacementRule = {
  id: "I",
  grain: "curve",
  wordsStay: false,
  label: "Line each line up, and let it bend",
};

export const onOwnInkRule: PlacementRule = {
  id: "H",
  grain: "mark",
  wordsStay: false,
  label: "Put each mark on its own ink",
};

/** All six, in the order the decision page draws them. */
export const PLACEMENT_RULES: readonly PlacementRule[] = [
  leaveAsIsRule,
  perPageRule,
  perLineTiltRule,
  marksOnlyRule,
  perLineBendRule,
  onOwnInkRule,
];
