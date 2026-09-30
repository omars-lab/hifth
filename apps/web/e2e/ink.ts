import type { Page } from "@playwright/test";

/*
 * Reading the highlighter's ink back off the page: what colour a token
 * resolves to, and what colour the screen actually shows. Shared by the specs
 * that check the marks' colours, so there is one way to ask either question.
 */

/**
 * A colour token, resolved the way the browser writes a computed fill, so it
 * compares like for like with `getComputedStyle(mark).fill`. Resolved inside
 * the page's overlay, where the marks themselves pick it up.
 */
export function inkToken(page: Page, name: string): Promise<string> {
  return page.evaluate((n) => {
    const probe = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    probe.style.fill = `var(${n})`;
    document.querySelector("#hifth-overlay")!.appendChild(probe);
    const c = getComputedStyle(probe).fill;
    probe.remove();
    return c;
  }, name);
}

export type Rgb = [number, number, number];

/**
 * The pixels inside an element's box on screen. Playwright's screenshot is
 * handed to the page's own canvas to decode, so no image library is needed.
 */
export async function pixelsOf(page: Page, selector: string): Promise<Rgb[]> {
  const box = (await page.locator(selector).first().boundingBox())!;
  const png = await page.screenshot({ clip: box, animations: "disabled" });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const out: Array<[number, number, number]> = [];
    for (let i = 0; i < d.length; i += 4) out.push([d[i]!, d[i + 1]!, d[i + 2]!]);
    return out;
  }, png.toString("base64"));
}

/** How light a pixel looks. */
export const lum = ([r, g, b]: Rgb): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * How light the ink looks between the letters: the mean of the lighter half of
 * the pixels, so the black of the words does not drag it down.
 */
export function inkLightness(px: readonly Rgb[]): number {
  const l = px.map(lum).sort((a, b) => b - a);
  const half = l.slice(0, Math.max(1, Math.floor(l.length / 2)));
  return half.reduce((a, b) => a + b, 0) / half.length;
}
