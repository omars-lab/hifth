import type { ReactNode, Ref } from "react";
import { spreadOf } from "@hifth/core";
import { useT } from "../i18n";
import styles from "./PageSpread.module.css";

interface PageSpreadProps {
  /**
   * Is the spread on? False renders `children` alone, with no wrapper of any
   * kind — the phone layout is not "the spread with one panel hidden".
   *
   * L3 owns this because it owns the media query, and because the decision is a
   * *mount* decision (see the note on weight below), not a style one.
   */
  enabled: boolean;
  /** The page on the stage. Its spread is the one drawn. */
  page: number;
  /** How long the print is — 604 for the Madani mus'haf. Bounds the pairing. */
  total: number;
  /** The pages this build holds, ascending. Decides whether a leaf can render. */
  available: readonly number[];
  /** The live stage. Goes in whichever leaf carries `page`. */
  children: ReactNode;
  /**
   * Render a *facing* leaf that this build actually vendors. Optional: with no
   * facing pair in the build there is nothing to call it with, and a caller that
   * cannot afford a second mount simply does not pass it — the leaf then reads
   * as absent, which is true.
   */
  renderFacing?: (page: number) => ReactNode;
  /**
   * The open book — the element holding the two leaves and nothing else.
   *
   * One use: a page turn's fold crosses the *whole open book*, not one leaf of
   * it (docs/design/page-transition.md §3.5), so the band has to be a child of
   * this element rather than of the stage that owns the turn. The stage portals
   * it here. Null below the breakpoint, where there is no wrapper at all and a
   * band that swept "the spread" would be sweeping the single leaf — which is
   * exactly what the stage does when it gets no target.
   *
   * The book rather than the outermost element, because those are two different
   * widths: the outer element is the desk and runs the width of the window. A
   * band handed the desk would appear out on empty field, cross the book, and
   * carry on to the far edge — a fold that starts and finishes where there is no
   * paper is not a picture of a leaf turning.
   *
   * A ref rather than a `renderFold` slot because the fold is not a fact about
   * the spread: the spread must not know that page turns have a picture, or it
   * acquires an opinion about animation it has no business holding.
   */
  bookRef?: Ref<HTMLDivElement>;
}

/**
 * PageSpread — a desktop window shows an open mus'haf, not a single leaf.
 *
 * ## Geometry, declared exactly once
 *
 * The mus'haf reads right to left, so within a spread the **lower page number is
 * on the right** and the next page is to its left; the print pairs (1,2), (3,4),
 * (5,6)… — odd on the right — so Al-Fatiha faces the opening of Al-Baqarah, and
 * the 604-page print divides into 302 complete openings with nothing orphaned.
 * `spreadOf` (@hifth/core) is the only place that arithmetic lives, beside
 * `nearestPage` — it is pagination, not presentation, and its doc comment records
 * where the parity was observed and why the phase it used to implement was wrong.
 *
 * The *sides* are then declared once more, and only once: the two leaves are
 * emitted in DOM order **right leaf first** inside the `dir="rtl"` main, and the
 * RTL flow places them. No `row-reverse`, no `order`, no `inset-inline` tricks.
 * Every extra statement of "which way is forward" is a statement that can drift
 * from `appKeyAction`'s ArrowLeft = +1 and from the page bar's left-edge next
 * button, and this app has three of them to keep in agreement already.
 *
 * ## Why there is no facing page today, and why that is drawn rather than hidden
 *
 * This build vendors pages 7, 9 and 19. They are not adjacent, so **no facing
 * pair exists anywhere in it** — every spread here is one leaf and one hole. The
 * hole is drawn as a hole: a recessed well, a dashed outer edge, the page it
 * would be, and the same inventory line the page bar carries. A blank sheet in
 * the paper colour would be a picture of a page that has nothing printed on it,
 * which is a different and false claim — and it is the exact failure this repo
 * has already paid for once (see `packages/core/src/pages.ts`, and the colophon's
 * licence summary in PLAN follow-up ②). Loop 4b vendors the rest; until then the
 * spread says what it is.
 *
 * The absence is *read*, not *announced*: it is visible text in a labelled
 * region, deliberately not pushed through `LiveAnnouncer`. The live region
 * already speaks on every page turn, and appending "…and the facing page is
 * missing" to all of them is how a reader learns to stop listening to it. A
 * permanent condition belongs in the document.
 *
 * ## Weight
 *
 * Each page is a ~170 KB inline SVG. Two mounted at once doubles the DOM, the
 * raster and the re-raster on zoom — which is the app's one open performance
 * question (PLAN follow-up ①). So `enabled` gates the *mount*: below the
 * breakpoint this component returns its child untouched and the second leaf does
 * not exist. `display: none` would not have done — a hidden panel still fetches,
 * still parses, and still builds a Highlighter.
 *
 * ## The empty end of the book
 *
 * `spreadOf` answers `left: null` for the last leaf of an **odd**-length print.
 * That is not the same as "absent": nothing is missing at the end of a book, so
 * that side is blank furniture with no caption and no label. Captioning it would
 * tell a reader that page 605 is a page we failed to vendor.
 *
 * The Madani print is 604 pages and never reaches that branch — under the
 * corrected parity every one of its 302 openings has two leaves. The branch stays
 * because `total` is a parameter and another edition may be odd. It used to fire
 * twice for this print, at page 1 and at page 604, and those two half-openings
 * were the visible symptom of the wrong phase rather than a fact about the book.
 */
export function PageSpread({
  enabled,
  page,
  total,
  available,
  children,
  renderFacing,
  bookRef,
}: PageSpreadProps): JSX.Element {
  const { t } = useT();

  // Below the breakpoint the stage is the whole story — no wrapper, so nothing
  // about the phone layout depends on this component having been rendered.
  if (!enabled) return <>{children}</>;

  const { right, left } = spreadOf(page, total);

  const leaf = (leafPage: number | null, side: "right" | "left"): JSX.Element => {
    const key = side;
    // The end of the book. Furniture, not a hole: no label, no caption, nothing
    // for a screen reader to stop on.
    if (leafPage === null) {
      return <div key={key} className={styles.leaf} aria-hidden="true" />;
    }
    // The leaf the reader is on — the live stage, with its selection, gestures
    // and hop rail. There is exactly one of these.
    if (leafPage === page) {
      return (
        <div key={key} className={styles.leaf}>
          {children}
        </div>
      );
    }
    // A facing leaf this build holds. Unreachable with today's three vendored
    // pages and kept honest by a fixture manifest in the component test rather
    // than by hope — a branch that waits for Loop 4b to be exercised is a branch
    // Loop 4b discovers on the day it vendors 601 pages.
    const facing = available.includes(leafPage) ? renderFacing?.(leafPage) : null;
    if (facing) {
      return (
        <div key={key} className={styles.leaf}>
          {facing}
        </div>
      );
    }
    return (
      <section key={key} className={`${styles.leaf} ${styles.absent}`} aria-label={t.facingPage}>
        <div className={styles.absentWell}>
          <p className={styles.absentWhat}>{t.facingAbsent(leafPage)}</p>
          {/* The same sentence the page bar carries, from the same string. The
              inventory is one fact and it is said one way, or the two surfaces
              start disagreeing about how much of the mus'haf is here. */}
          <p className={styles.absentInventory}>{t.pagesVendored(available.length, total)}</p>
        </div>
      </section>
    );
  };

  return (
    /* Two boxes, because two different things wanted to be "the spread" and they
       are not the same width. The outer one is the desk: it runs the width of
       the window and draws the field. The inner one is the book — the two
       leaves and nothing else — and it is what the gutter is drawn on and what
       the fold's band is given, both of which are claims about the paper rather
       than about the room it is lying in.

       Right leaf first. The RTL flow of `main` puts it on the right; see the
       geometry note above for why that is the only place the side is decided.
       The gutter is drawn on the book rather than on the leaves — a spine
       belongs to the binding, not to either page. */
    <div className={styles.spread} data-testid="page-spread">
      <div ref={bookRef} className={styles.book} data-testid="page-book">
        {leaf(right, "right")}
        {leaf(left, "left")}
        <div className={styles.gutter} aria-hidden="true" />
      </div>
    </div>
  );
}
