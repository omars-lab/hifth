import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";
import type { LeafSide } from "@hifth/core";
import { useCardEdge, type CardEdge } from "../card-edge";

/** The least width the note is read in, beside a spread — the stylesheet's card. */
const LEAST_WIDTH = 460;
/** How far the note stands off the fold, so the spine still shows. */
const OFF_FOLD = 4;
/** How far it stands in from the window's edges. */
const MARGIN = 12;
/**
 * The outer strip a card leaves uncovered when the reader keeps the edge free:
 * the grab strip's widest reach (3.5rem in EdgeGrabRails.module.css).
 */
export const EDGE_FREE = 56;

/**
 * Where a card lies on a spread, in window px: over the whole facing page,
 * from the fold to the page's outer edge and from its top to its foot, like a
 * page of commentary laid on the book. A fixed card in from the window's edge
 * hid most of the facing page and left a strip of it showing, its words cut off
 * at the card. A page narrower than the note can be read in is overhung past
 * its outer edge rather than squeezed; a book magnified past the window is
 * covered as far as the window goes.
 *
 * With the edge kept free (`clear`, see card-edge.ts) the card stops short of
 * the outer edge by the grab strip's width instead, however narrow that leaves
 * it, so the page can still be turned by hand with the card open.
 */
export function overLeaf(
  book: { left: number; right: number; top: number; bottom: number },
  side: LeafSide,
  screen: { width: number; height: number },
  edge: CardEdge = "covers",
): { left: number; width: number; top: number; height: number } {
  const fold = (book.left + book.right) / 2;
  const top = Math.max(book.top, MARGIN);
  const height = Math.min(book.bottom, screen.height - MARGIN) - top;
  const free = edge === "clear";
  if (side === "right") {
    const left = fold + OFF_FOLD;
    if (free) return { left, width: Math.min(book.right - EDGE_FREE, screen.width - MARGIN) - left, top, height };
    const width = Math.min(Math.max(LEAST_WIDTH, book.right - left), screen.width - MARGIN - left);
    return { left, width, top, height };
  }
  const right = fold - OFF_FOLD;
  if (free) {
    const left = Math.max(book.left + EDGE_FREE, MARGIN);
    return { left, width: right - left, top, height };
  }
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
  const edge = useCardEdge();
  useLayoutEffect(() => {
    const book = document.querySelector<HTMLElement>('[data-testid="page-book"]');
    if (!open || side === null || !book || book.dataset.solo) {
      setPlace(null);
      return;
    }
    const measure = () =>
      setPlace(overLeaf(book.getBoundingClientRect(), side, { width: innerWidth, height: innerHeight }, edge));
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
  }, [open, side, edge]);
  return place;
}

/**
 * Tell every card how much of the window the page has: how far its foot stands
 * above the window's foot, and how tall it is. With one page open the cards
 * stand in a corner, and a corner a fixed gap off the window's foot ran down
 * over the full-screen button, the verse's chip and the page bar, so the
 * reader could not move on without closing the note. The stylesheets read the
 * two measures (--room-foot, --room-block) to stand in the page's room.
 */
export function useRoomForCards(room: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const area = room.current;
    if (!area) return;
    const root = document.documentElement.style;
    const measure = () => {
      const box = area.getBoundingClientRect();
      root.setProperty("--room-foot", `${Math.max(0, innerHeight - box.bottom)}px`);
      root.setProperty("--room-block", `${box.height}px`);
    };
    measure();
    const seen = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    seen?.observe(area);
    window.addEventListener("resize", measure);
    return () => {
      seen?.disconnect();
      window.removeEventListener("resize", measure);
      root.removeProperty("--room-foot");
      root.removeProperty("--room-block");
    };
  }, [room]);
}

/** The card's style for a place: the stylesheet's corner when there is none. */
export function leafStyle(place: Place | null, fit: "page" | "content" = "page"): CSSProperties | undefined {
  if (!place) return undefined;
  // A list is only as tall as what it holds, up to the page: one look-alike
  // stretched to the book's height sat at the top of an empty card.
  if (fit === "content") return { ...place, height: "auto", maxBlockSize: place.height, right: "auto", bottom: "auto" };
  return { ...place, right: "auto", bottom: "auto", maxBlockSize: "none" };
}
