/**
 * Bringing an opened list row into view.
 *
 * A look-alike row near the foot of a long list opens its comparison below the
 * list's edge, where nothing says it is there (walking in Firefox, 2026-10-09).
 * The browser's own `scrollIntoView({ block: "nearest" })` was tried first and
 * left a comparison taller than a phone's list showing neither its start nor
 * its end, so the rule is worked out here instead:
 *
 *   fits       move the list just far enough to show the row whole
 *   too tall   line up the row's top, so its name is the first thing seen
 *
 * "The list's top" is the bottom of any title pinned over its rows.
 */

interface Edges {
  readonly top: number;
  readonly bottom: number;
}

/** How far to scroll the list (down is positive) to bring the row into view. */
export function revealBy(row: Edges, list: Edges): number {
  if (row.top < list.top) return row.top - list.top;
  if (row.bottom <= list.bottom) return 0;
  if (row.bottom - row.top > list.bottom - list.top) return row.top - list.top;
  return row.bottom - list.bottom;
}

/** The nearest box around `el` that scrolls up and down, if any. */
function scrollerOf(el: Element): Element | null {
  for (let at = el.parentElement; at; at = at.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(at).overflowY)) return at;
  }
  return null;
}

/**
 * The list's edges as a reader sees them: a title pinned over the rows (on a
 * phone it rides inside the scrolling sheet) covers the top, so the rows begin
 * under it. Only the list's own children and grandchildren are looked at — a
 * title is never buried deeper, and the rows below can hold hundreds of nodes.
 */
function shownEdges(list: Element): { top: number; bottom: number } {
  const edges = list.getBoundingClientRect();
  let top = edges.top;
  for (const child of list.querySelectorAll(":scope > *, :scope > * > *")) {
    const style = getComputedStyle(child);
    if (style.position !== "sticky") continue;
    const box = child.getBoundingClientRect();
    // Pinned already, or still at rest further down: then it pins where its
    // own offset says once the list scrolls, which is what the row lines up to.
    const offset = parseFloat(style.top);
    const pinned = box.top <= edges.top + 1;
    if (!pinned && Number.isNaN(offset)) continue;
    const bottom = pinned ? box.bottom : edges.top + offset + (box.bottom - box.top);
    if (bottom > top) top = bottom;
  }
  return { top, bottom: edges.bottom };
}

/**
 * Scroll the list holding `el` so the row it sits in (its `<li>`, or `el`
 * itself) shows. Smooth unless the reader asked for less motion.
 */
export function revealRow(el: Element): void {
  const row = el.closest("li") ?? el;
  const list = scrollerOf(row);
  if (!list) return;
  const by = revealBy(row.getBoundingClientRect(), shownEdges(list));
  if (by === 0) return;
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  list.scrollBy?.({ top: by, behavior: still ? "auto" : "smooth" });
}
