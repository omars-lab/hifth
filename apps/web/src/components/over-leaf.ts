import { useLayoutEffect, useState, type CSSProperties } from "react";
import type { LeafSide } from "@hifth/core";

/** The least width the note is read in, beside a spread — the stylesheet's card. */
const LEAST_WIDTH = 460;
/** How far the note stands off the fold, so the spine still shows. */
const OFF_FOLD = 4;
/** How far it stands in from the window's edges. */
const MARGIN = 12;

/**
 * Where a card lies on a spread, in window px: over the whole facing page,
 * from the fold to the page's outer edge and from its top to its foot, like a
 * page of commentary laid on the book. A fixed card in from the window's edge
 * hid most of the facing page and left a strip of it showing, its words cut off
 * at the card. A page narrower than the note can be read in is overhung past
 * its outer edge rather than squeezed; a book magnified past the window is
 * covered as far as the window goes.
 */
export function overLeaf(
  book: { left: number; right: number; top: number; bottom: number },
  side: LeafSide,
  screen: { width: number; height: number },
): { left: number; width: number; top: number; height: number } {
  const fold = (book.left + book.right) / 2;
  const top = Math.max(book.top, MARGIN);
  const height = Math.min(book.bottom, screen.height - MARGIN) - top;
  if (side === "right") {
    const left = fold + OFF_FOLD;
    const width = Math.min(Math.max(LEAST_WIDTH, book.right - left), screen.width - MARGIN - left);
    return { left, width, top, height };
  }
  const right = fold - OFF_FOLD;
  const width = Math.min(Math.max(LEAST_WIDTH, right - book.left), right - MARGIN);
  return { left: right - width, width, top, height };
}

type Place = ReturnType<typeof overLeaf>;

/**
 * Where a card opened beside a spread lies, kept over the facing page as the
 * book is magnified, scrolled or the window resized; null on a phone, or when
 * the book is closed to one leaf and has no facing page, so the card keeps its
 * stylesheet's place. The note, the roots, the similar verses and a
 * highlighted passage's menu all use it, so each lands on the book the same
 * way: the lists kept a corner card and ran past the book's foot.
 */
export function useOverLeaf(open: boolean, side: LeafSide | null): Place | null {
  const [place, setPlace] = useState<Place | null>(null);
  useLayoutEffect(() => {
    const book = document.querySelector<HTMLElement>('[data-testid="page-book"]');
    if (!open || side === null || !book || book.dataset.solo) {
      setPlace(null);
      return;
    }
    const measure = () =>
      setPlace(overLeaf(book.getBoundingClientRect(), side, { width: innerWidth, height: innerHeight }));
    measure();
    const seen = new ResizeObserver(measure);
    seen.observe(book);
    window.addEventListener("resize", measure);
    // A magnified book is scrolled, which moves it without resizing it.
    window.addEventListener("scroll", measure, true);
    return () => {
      seen.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, side]);
  return place;
}

/** The card's style for a place: the stylesheet's corner when there is none. */
export function leafStyle(place: Place | null, fit: "page" | "content" = "page"): CSSProperties | undefined {
  if (!place) return undefined;
  // A list is only as tall as what it holds, up to the page: one look-alike
  // stretched to the book's height sat at the top of an empty card.
  if (fit === "content") return { ...place, height: "auto", maxBlockSize: place.height, right: "auto", bottom: "auto" };
  return { ...place, right: "auto", bottom: "auto", maxBlockSize: "none" };
}
