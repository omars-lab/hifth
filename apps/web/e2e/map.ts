import type { Locator } from "@playwright/test";

/**
 * The squares of the revision map that are bigger than their own place in its
 * grid, or that reach past its edge, as "label WxH in WxH" (empty when all fit).
 * Every button is at least a thumb's width, and the map's squares are smaller
 * than that on purpose, so a square that lost its own size spilled over its
 * neighbours (2026-10-10).
 */
export function oversizeSquares(grid: Locator): Promise<string[]> {
  return grid.evaluate((el) => {
    const edge = el.getBoundingClientRect();
    const out: string[] = [];
    for (const cell of el.querySelectorAll("button")) {
      const r = cell.getBoundingClientRect();
      const slot = cell.parentElement!.getBoundingClientRect();
      if (r.width > slot.width + 0.5 || r.height > slot.height + 0.5 || r.left < edge.left - 0.5 || r.right > edge.right + 0.5)
        out.push(`${cell.textContent} ${Math.round(r.width)}x${Math.round(r.height)} in ${Math.round(slot.width)}x${Math.round(slot.height)}`);
    }
    return out;
  });
}
