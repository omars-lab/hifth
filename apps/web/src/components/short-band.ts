import { useLayoutEffect, type RefObject } from "react";

/**
 * On a phone, the roots and similar-verses lists open as a short band at the
 * foot of the screen, the way the note does, and say where they start so the
 * page can move the verse up into the part still showing. They used to rise
 * over most of the screen behind a dimmed page, hiding the verse they are about.
 *
 * Wider, the list is a card at the foot of one page, and it says where it
 * starts too: an iPad held upright drew it across the page's foot and left the
 * verse under it, while the note on the same screen slid its verse clear
 * (2026-10-08).
 *
 * The same card on that upright iPad still drew a veil over the page and the
 * toolbar, and the roots list rose over nearly the whole screen, where the
 * note in the same place leaves the page bright (2026-10-09). So no list not
 * beside a spread draws a veil, whatever the width, and the page stays live,
 * as it is under the note.
 *
 * Returns whether the list is that band now; the sheet carries `data-band`
 * then, which keeps it short where it lies across the page (a phone, or a wide
 * screen held upright). Wide and not upright, the card stands in the corner
 * beside one page and keeps its height.
 */
export function useShortBand(
  open: boolean,
  beside: boolean,
  sheetRef: RefObject<HTMLElement | null>,
  onCover: ((top: number | null) => void) | undefined,
): boolean {
  const band = !beside;
  useLayoutEffect(() => {
    if (!onCover) return;
    const sheet = sheetRef.current;
    if (!open || beside || !sheet) {
      onCover(null);
      return;
    }
    // Its height is read from layout, not its box: the list rises into place,
    // and its box is still below the screen while it does.
    const stop = watchCover(sheet, () => sheet.offsetHeight, onCover);
    return () => {
      stop();
      onCover(null);
    };
  }, [open, beside, sheetRef, onCover]);
  return band;
}

/**
 * Tell `onCover` where a card at the foot of the screen starts, for as long as
 * it is up, so the page can slide the verse above it; null while the card
 * stands beside the page and covers none of it. Returns the stop.
 */
export function watchCover(sheet: HTMLElement, height: () => number, onCover: (top: number | null) => void): () => void {
  const report = () => {
    // A card in the corner beside one page covers nothing on it: claiming
    // the window's foot anyway slid the page up under the toolbar.
    const paper = [...document.querySelectorAll('[data-live="true"] [data-host-page]')]
      .map((host) => host.getBoundingClientRect())
      .find((box) => box.width > 0);
    const card = sheet.getBoundingClientRect();
    if (paper && (card.left >= paper.right || card.right <= paper.left)) {
      onCover(null);
      return;
    }
    // Measured up from the card's own foot: a corner card stands above the
    // bars, and measuring from the window's foot left the verse under it.
    const foot = window.innerHeight - (parseFloat(getComputedStyle(sheet).bottom) || 0);
    onCover(foot - height());
  };
  report();
  window.addEventListener("resize", report);
  // Closing the book to one page moves the card into the corner while the
  // book is still two pages wide, so look again once the book has narrowed:
  // a card judged against the old spread kept the page slid up under the
  // toolbar for nothing.
  const book = document.querySelector<HTMLElement>('[data-testid="page-book"]');
  // And when the card itself grows or shrinks, as a list does when a row opens.
  const seen = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(report);
  if (book) seen?.observe(book);
  seen?.observe(sheet);
  // And again whenever the page moves or zooms: whether a corner card lies
  // beside the page or over it depends on how wide the page is drawn. A cold
  // link shows its page at the whole-page size, clear of the card, then
  // zooms in to frame the verse and runs under it, and judged only at the
  // first size the note claimed to cover nothing while it sat on its verse.
  // Once a frame at most, since a zoom moves the page every frame.
  let frame = 0;
  const moved = new MutationObserver(() => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      report();
    });
  });
  if (book) moved.observe(book, { subtree: true, attributes: true, attributeFilter: ["style"] });
  return () => {
    seen?.disconnect();
    moved.disconnect();
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", report);
  };
}

/** Where a card spans across the window, in window px. */
export interface CardSpan {
  left: number;
  right: number;
}

/**
 * Tell `onSide` where a card spans across the window for as long as it is up,
 * and null once it is gone or stands beside a spread. A laptop window closed
 * to one page puts the lists and the note in its corner, and the page was
 * centred as though nothing stood there: at the size a link lands at, the
 * card hid where the page's lines begin (look-alike rows ⑩). The app decides
 * whether the card is beside the page or across its foot; this only says
 * where it is. Read from layout, not its box, as the cover above is.
 */
export function useSideCover(
  open: boolean,
  beside: boolean,
  sheetRef: RefObject<HTMLElement | null>,
  onSide: ((span: CardSpan | null) => void) | undefined,
): void {
  useLayoutEffect(() => {
    if (!onSide) return;
    const sheet = sheetRef.current;
    if (!open || beside || !sheet) {
      onSide(null);
      return;
    }
    const report = () => onSide({ left: sheet.offsetLeft, right: sheet.offsetLeft + sheet.offsetWidth });
    report();
    window.addEventListener("resize", report);
    const seen = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(report);
    seen?.observe(sheet);
    return () => {
      seen?.disconnect();
      window.removeEventListener("resize", report);
      onSide(null);
    };
  }, [open, beside, sheetRef, onSide]);
}

/**
 * The span of every card that is up, from the furthest left edge to the
 * furthest right: the note, the roots list, the share card and the tajweed key stand in
 * the same corner, so the page has to clear whichever reaches furthest in.
 */
export function spanOfAll(cards: readonly (CardSpan | null)[]): CardSpan | null {
  const up = cards.filter((c): c is CardSpan => c !== null);
  if (!up.length) return null;
  return { left: Math.min(...up.map((c) => c.left)), right: Math.max(...up.map((c) => c.right)) };
}

/**
 * How much of the stage's left or right side a card covers: a card in the
 * stage's right half covers it from the card's left edge on, one in its left
 * half up to the card's right edge.
 */
export function sideCoverOf(
  card: CardSpan | null,
  stage: CardSpan,
): { coverLeft?: number; coverRight?: number } {
  if (!card) return {};
  return card.left + card.right >= stage.left + stage.right
    ? { coverRight: Math.max(0, stage.right - card.left) }
    : { coverLeft: Math.max(0, card.right - stage.left) };
}
