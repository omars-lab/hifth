import { useEffect, useState } from "react";
import { sideFits } from "../pen-home";

/*
 * Kept apart from PenHomes.tsx because the app asks it at start-up, on every
 * device, while the pen homes themselves load later, on a computer only
 * (./later.tsx). Importing it from PenHomes.tsx would pull their code and style
 * sheet back into the first download.
 */

/** How wide the side rail is, for the room it needs beside the book. */
export const SIDE_RAIL = 56;

/**
 * Whether the margin beside the open book holds the side rail, measured from
 * the pages as laid out (offsetWidth, so a zoom in progress does not count):
 * null until the pages are there to measure.
 */
export function useSideRoom(on: boolean): boolean | null {
  const [fits, setFits] = useState<boolean | null>(null);
  useEffect(() => {
    if (!on) return;
    const main = document.querySelector("main");
    if (!main) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const leaves = [...main.querySelectorAll<HTMLElement>("[data-page]")].filter((el) => el.offsetWidth > 0);
        if (leaves.length === 0) return;
        const book = leaves.reduce((sum, el) => sum + el.offsetWidth, 0);
        setFits(sideFits(main.clientWidth, book, SIDE_RAIL));
      });
    };
    const sizes = new ResizeObserver(measure);
    sizes.observe(main);
    const pages = new MutationObserver(measure);
    pages.observe(main, { childList: true, subtree: true });
    measure();
    return () => {
      cancelAnimationFrame(frame);
      sizes.disconnect();
      pages.disconnect();
    };
  }, [on]);
  return on ? fits : null;
}
