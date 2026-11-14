/*
 * The parts only a computer-sized screen shows, in one file fetched once the
 * app knows the screen is that wide (`desktop` in App.tsx, DESKTOP_QUERY):
 * the strips along the page edges that turn a page when grabbed, and three of
 * the four homes for the page tools. The Pencil's own pens come from here too,
 * the first time an iPad's Pencil calls them up: they share the pen homes' code,
 * and two files would each carry a copy. A phone never asks for this file, so
 * it leaves the first download (docs/performance.md, item 21).
 *
 * Only `./later.tsx` may import this module, and only with `import()`.
 */
export { EdgeGrabRails } from "./EdgeGrabRails";
export { PenHomeAt, PenHomeBottom, PenHomeFloat, PenHomeSide } from "./PenHomes";
