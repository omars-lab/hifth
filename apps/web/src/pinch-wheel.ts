/**
 * How much a ctrl+wheel step magnifies by, when it is a trackpad pinch, or
 * null when it is a mouse wheel turned with ctrl held.
 *
 * Both reach the page as a ctrl+wheel and no browser says which. They differ
 * in their steps: a pinch is a stream of small pixel steps, a few pixels or
 * less each, often fractional; a wheel notch is a whole line (Firefox) or 100
 * pixels or more (Chrome, Safari). The notch still does nothing, as the
 * wheel-and-zoom decision chose; the pinch magnifies.
 */
export function pinchFactor(e: { ctrlKey: boolean; metaKey: boolean; deltaY: number; deltaMode: number }): number | null {
  if (!e.ctrlKey || e.metaKey || e.deltaMode !== 0) return null;
  if (e.deltaY === 0 || Math.abs(e.deltaY) >= 50) return null;
  return Math.exp(-e.deltaY / 100);
}
