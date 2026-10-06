import { useLayoutEffect, type RefObject } from "react";
import { useMediaQuery } from "../useMediaQuery";

/** Below this width a list is a band across the foot of the screen, not a card. */
export const BAND_QUERY = "(max-width: 899.98px)";

/**
 * On a phone, the roots and similar-verses lists open as a short band at the
 * foot of the screen, the way the note does, and say where they start so the
 * page can move the verse up into the part still showing. They used to rise
 * over most of the screen behind a dimmed page, hiding the verse they are about.
 *
 * Returns whether the list is that band now: then there is no veil over the
 * page, and the page stays live, as it does under the note.
 */
export function useShortBand(
  open: boolean,
  beside: boolean,
  sheetRef: RefObject<HTMLElement | null>,
  onCover: ((top: number | null) => void) | undefined,
): boolean {
  const band = useMediaQuery(BAND_QUERY) && !beside;
  useLayoutEffect(() => {
    if (!onCover) return;
    const sheet = sheetRef.current;
    if (!open || !band || !sheet) {
      onCover(null);
      return;
    }
    // Its height is read from layout, not its box: the band rises into place,
    // and its box is still below the screen while it does.
    const report = () => onCover(window.innerHeight - sheet.offsetHeight);
    report();
    window.addEventListener("resize", report);
    const seen = new ResizeObserver(report);
    seen.observe(sheet);
    return () => {
      seen.disconnect();
      window.removeEventListener("resize", report);
      onCover(null);
    };
  }, [open, band, sheetRef, onCover]);
  return band;
}
