import { expect, type Page } from "@playwright/test";

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
 * The pixels inside an element's box on screen, or the middle of it. Playwright's screenshot is
 * handed to the page's own canvas to decode, so no image library is needed.
 */
export async function pixelsOf(page: Page, selector: string, opts: { middle?: number } = {}): Promise<Rgb[]> {
  // Trimmed to the screen: a band's box takes in the streak filter's margin and
  // can start off the edge, which WebKit refuses as a cut-out where Chromium
  // quietly trims it.
  // And taken once the page has settled: on a phone the verse is still sliding
  // into place for a moment after it is drawn, and can sit below the screen.
  const mark = page.locator(selector).first();
  let last = "";
  await expect
    .poll(
      async () => {
        const now = JSON.stringify(await mark.boundingBox());
        const still = now === last;
        last = now;
        return still;
      },
      { intervals: [100, 100, 150, 200, 300] },
    )
    .toBe(true);
  const box = (await mark.boundingBox())!;
  // `middle` keeps only that share of the box around its centre, both ways: the
  // box takes in the filter's margin, where letters sit outside the ink.
  const m = opts.middle ?? 1;
  const b = {
    x: box.x + (box.width * (1 - m)) / 2,
    y: box.y + (box.height * (1 - m)) / 2,
    width: box.width * m,
    height: box.height * m,
  };
  const view = page.viewportSize()!;
  const x = Math.max(0, b.x);
  const y = Math.max(0, b.y);
  const clip = {
    x,
    y,
    width: Math.min(view.width, b.x + b.width) - x,
    height: Math.min(view.height, b.y + b.height) - y,
  };
  return pixelsAt(page, clip);
}

/** The pixels inside a rectangle of the screen, row by row. */
export async function pixelsAt(
  page: Page,
  clip: { x: number; y: number; width: number; height: number },
): Promise<Rgb[]> {
  const png = await page.screenshot({ clip, animations: "disabled" });
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
