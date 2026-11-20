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
 * Every road that settles the reader somewhere (a deep link, a hop, a trail
 * rewind, a scrub, a turn's own landing) sets the page through `setPage` here,
 * which puts the destination on that page in the same moment. A deep link
 * arriving mid-turn resets the destination to wherever it put us.
 *
 * It used to be synced afterwards, from `page` changing, and that missed two
 * cases. A flick let go just as the last turn landed had its destination reset
 * under it, so two quick flicks turned one page (that needed a "turn landed"
 * exception). And a jump undone in the same moment, a part marker tapped as
 * the opening link put the page back, never changed `page` at all: the
 * destination stayed on the jump's page and every later tap on that marker was
 * taken for the jump already under way (seen on the iPhone run, 2026-11-19).
 * Set at the moment of setting, both are right with no exception.
 */
export function usePageDestination(page: number, setPageState: (page: number) => void) {
  const pageRef = useRef(page);
  const pendingPageRef = useRef(page);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);
  const setPage = useCallback(
    (n: number): void => {
      pendingPageRef.current = n;
      setPageState(n);
    },
    [setPageState],
  );
  return { pageRef, pendingPageRef, setPage };
}
