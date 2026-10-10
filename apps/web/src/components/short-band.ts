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
