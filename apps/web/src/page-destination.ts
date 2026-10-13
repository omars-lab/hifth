import { useCallback, useEffect, useRef } from "react";

/**
 * Where the reader is, and where they are *going*.
 *
 * `page` is a committed fact: it changes when a page has actually landed on
 * the stage. A turn takes 240 ms, and during those 240 ms a second arrow press
 * or flick must step from the page being turned to, not from the one still on
 * screen: otherwise holding ArrowLeft oscillates between two pages instead of
 * walking the book. `pendingPageRef` is that destination, and it is the number
 * every page-stepping decision is made against.
 *
 * Both are synced from `page` rather than written at each of the places that
 * call `setPage`: a deep link, a hop, a trail rewind and a scrub all settle the
 * reader somewhere, and any of them arriving mid-turn should reset the
 * destination to wherever they put us. All but a turn's own landing: the
 * destination is already that page when it lands, and by the time the change
 * settles a flick let go just after may have moved it on. Reset then, that
 * flick's own landing found the destination gone and was dropped, so two
 * quick flicks turned one page.
 */
export function usePageDestination(page: number) {
  const pageRef = useRef(page);
  const pendingPageRef = useRef(page);
  const landedRef = useRef<number | null>(null);
  useEffect(() => {
    pageRef.current = page;
    const turned = landedRef.current === page;
    landedRef.current = null;
    if (!turned) pendingPageRef.current = page;
  }, [page]);
  /** Say a turn has landed on `n`, just before the page is set to it. */
  const turnLanded = useCallback((n: number): void => {
    landedRef.current = n;
  }, []);
  return { pageRef, pendingPageRef, turnLanded };
}
