/**
 * boundary-juz (open decision, docs/decisions/page-bar.md §"Which juz does a
 * boundary page belong to?"): a handful of pages carry the end of one juz and the
 * start of the next. When such a page is shown — in the bar's readout, on the page
 * itself — which juz number does it wear?
 *
 * The difference is *seen*, not merely policy: the reader looks at the number on the
 * page and it is either the juz that is ending, the juz that is opening, or both. So
 * the three options are built as interchangeable rules and mounted live on the
 * decision page (docs/design/page-bar-options.html), each rendering the actual label
 * it would print on the four real boundary pages. The winning rule graduates into the
 * app's page readout; the losers are deleted.
 *
 * Every `labelFor` is a **standalone, self-contained** function — it reads only its
 * argument — so the same compiled source runs in the app, the unit test, and the
 * decision page.
 */

/** What a rule needs to know about one page to label it. */
export interface BoundaryContext {
  /** The juz that *opens* on this page, if any — the marker's juz. `null` if none opens here. */
  readonly beginsHere: number | null;
  /** The lowest juz with any ayah on the page — the juz already running onto it. */
  readonly running: number;
}

/** A label to print, and which juz it names (for colouring or linking). */
export interface BoundaryLabel {
  /** The text shown on the page or in the readout. */
  readonly text: string;
  /** The juz the label names — one entry, or two when it shows both. */
  readonly juz: readonly number[];
}

/** A · the page wears the juz that *begins* on it (today's readout). */
export function labelBeginsHere(ctx: BoundaryContext): BoundaryLabel {
  const j = ctx.beginsHere === null ? ctx.running : ctx.beginsHere;
  return { text: String(j), juz: [j] };
}

/** B · the page wears the juz already *running* onto it — the earlier number. */
export function labelRunning(ctx: BoundaryContext): BoundaryLabel {
  return { text: String(ctx.running), juz: [ctx.running] };
}

/** C · the page wears *both* — the juz ending and the juz opening, shown as a hand-off. */
export function labelBoth(ctx: BoundaryContext): BoundaryLabel {
  if (ctx.beginsHere !== null && ctx.beginsHere !== ctx.running) {
    return { text: ctx.running + " → " + ctx.beginsHere, juz: [ctx.running, ctx.beginsHere] };
  }
  return { text: String(ctx.running), juz: [ctx.running] };
}

/** A rule plus how it presents itself, for the bar and the decision page. */
export interface BoundaryJuzRule {
  readonly id: "A" | "B" | "C";
  readonly label: string;
  labelFor(ctx: BoundaryContext): BoundaryLabel;
}

export const beginsHereRule: BoundaryJuzRule = {
  id: "A",
  label: "The juz that begins on the page",
  labelFor: labelBeginsHere,
};

export const runningRule: BoundaryJuzRule = {
  id: "B",
  label: "The juz already running onto the page",
  labelFor: labelRunning,
};

export const bothRule: BoundaryJuzRule = {
  id: "C",
  label: "Both, shown as a hand-off",
  labelFor: labelBoth,
};

/** All three, in the order the decision page draws them. */
export const BOUNDARY_JUZ_RULES: readonly BoundaryJuzRule[] = [
  beginsHereRule,
  runningRule,
  bothRule,
];
