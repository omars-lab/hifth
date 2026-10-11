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

/**
 * The lines of text outside a sheet that its foot slices through, so the bottom
 * half of the letters shows under it (empty when none). A line the sheet
 * covers whole, or leaves whole, is fine; one sliced in half reads as the
 * sheet's own text cut off. The wide-window record sheet floated
 * a little above the window's foot and sliced the page bar's count line
 * (2026-10-10).
 */
export function linesCutBy(sheet: Locator): Promise<string[]> {
  return sheet.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const out: string[] = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const text = n.textContent?.trim();
      if (!text || el.contains(n)) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        const w = Math.min(r.right, box.right) - Math.max(r.left, box.left);
        // Sliced by the sheet's foot: its top under the sheet, its bottom
        // showing below. The head rising over the page cuts the page's lines
        // the way any sheet does, and a card's side only covers.
        if (w > 0.5 && r.top < box.bottom - 0.5 && r.bottom > box.bottom + 0.5) out.push(text);
      }
    }
    return out;
  });
}
