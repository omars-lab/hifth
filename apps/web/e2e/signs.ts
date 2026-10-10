import type { Page } from "@playwright/test";

/**
 * Where on screen the sign nearest the middle of page 7 sits, read from the
 * sign data itself: mid-page, so no corner (the bookmark fold) is over it.
 */
export async function midSign(page: Page): Promise<{ x: number; y: number; id: string }> {
  return page.evaluate(async () => {
    const res = await fetch(new URL("assets/marks/hafs-kfqc/7.json", document.baseURI));
    const shard = (await res.json()) as { marks: Record<string, { r: number[] }[]> };
    let best = { d: Infinity, id: "", r: [0, 0, 0, 0] };
    for (const [ayah, list] of Object.entries(shard.marks))
      list.forEach((m, i) => {
        const d = Math.hypot(m.r[0]! + m.r[2]! / 2 - 172, m.r[1]! + m.r[3]! / 2 - 275);
        if (d < best.d) best = { d, id: `${ayah}/${i}`, r: m.r };
      });
    const r = best.r;
    const svg = [...document.querySelectorAll<SVGSVGElement>('svg[aria-labelledby="page-label-7"]')].find(
      (s) => s.getBoundingClientRect().width > 0,
    )!;
    const pt = svg.createSVGPoint();
    pt.x = r[0]! + r[2]! / 2;
    pt.y = r[1]! + r[3]! / 2;
    const at = pt.matrixTransform(svg.getScreenCTM()!);
    return { x: at.x, y: at.y, id: best.id };
  });
}
