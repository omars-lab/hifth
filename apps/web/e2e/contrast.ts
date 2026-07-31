import type { Page } from "@playwright/test";

/**
 * Measuring the contrast of every piece of chrome text on screen.
 *
 * The obvious tool for this is axe's `color-contrast` rule, and it is the wrong
 * one *here*. Pointed at an open hop popover it evaluated 14 of the 33 text
 * elements on screen and returned zero violations — the rest it filed under
 * `incomplete`, with two reasons that between them describe most of this app's
 * chrome:
 *
 *   - `nonBmp` — "content contains only non-text characters". Every glyph
 *     control (↻ ▶ ⬡ ✕ ⌄ ⌖ ▤) is exactly that. They are not decoration; they
 *     are the affordance, and a reader who cannot see them cannot navigate.
 *   - `shortTextContent` — a hop count is one Arabic-Indic digit, a page number
 *     is two. Short is not the same as unimportant.
 *
 * `incomplete` is not a failure, so a spec asserting on `violations` alone
 * cannot go red no matter how unreadable the page gets. That is the same shape
 * as the golden shot that photographed an empty frame: it reads as coverage.
 *
 * So this measures directly. The maths is WCAG 2.1 §1.4.3 relative luminance,
 * cross-checked against axe on the nodes axe *did* rate — it agrees to the
 * rounding (axe 7.11 / 8.21 vs 7.12 / 8.21 here), which is what makes it
 * trustworthy enough to gate on.
 */

/** A text element whose contrast falls under the ratio its size demands. */
export interface ContrastFailure {
  readonly ratio: number;
  readonly required: number;
  readonly foreground: string;
  readonly background: string;
  readonly fontPx: number;
  readonly weight: number;
  readonly selector: string;
  readonly text: string;
}

/** Text whose background could not be resolved — reported, never asserted on. */
export interface Unmeasured {
  readonly selector: string;
  readonly text: string;
  readonly reason: string;
}

export interface ContrastReport {
  readonly measured: number;
  readonly failures: readonly ContrastFailure[];
  readonly unmeasured: readonly Unmeasured[];
}

/**
 * Let every running transition finish before anything is measured.
 *
 * A hop chip fades its background from paper to accent over `--dur-fast`. Read
 * during that fade, the chip is a blend — an early pass caught one at
 * `#79a79f` and reported the tapped chip as the least readable thing on screen,
 * a defect that does not exist a hundred milliseconds later. Contrast is a
 * claim about the state the reader sits and reads in, so measurement waits for
 * the paint to stop moving. Waiting on the animations themselves rather than
 * sleeping a fixed number keeps it exact on a fast machine and correct on a
 * slow one.
 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const running = document.getAnimations().map((a) => a.finished.catch(() => undefined));
    // A capped race, because an intentionally infinite animation (a spinner, a
    // pulse) would otherwise hang the whole traversal rather than fail it.
    await Promise.race([
      Promise.all(running),
      new Promise((resolve) => setTimeout(resolve, 1_000)),
    ]);
  });
}

/**
 * Measure every visible chrome text element against the paper behind it.
 *
 * Mushaf artwork is excluded: the glyphs inside a page `<svg>` are geometry the
 * ETL vendored, not styling this app gets to choose, and the polygon hit layer
 * is transparent by design.
 */
export async function measureContrast(page: Page): Promise<ContrastReport> {
  await settle(page);
  return page.evaluate(() => {
    type Rgba = readonly [number, number, number, number];

    function parse(color: string): Rgba | null {
      const parts = color.match(/[\d.]+/g);
      if (!parts || parts.length < 3) return null; // `transparent`, or a keyword we cannot read
      return [
        Number(parts[0]),
        Number(parts[1]),
        Number(parts[2]),
        parts.length > 3 ? Number(parts[3]) : 1,
      ];
    }

    /** Source-over composite: `over` painted on top of the opaque `under`. */
    function composite(over: Rgba, under: Rgba): Rgba {
      const a = over[3];
      return [
        over[0] * a + under[0] * (1 - a),
        over[1] * a + under[1] * (1 - a),
        over[2] * a + under[2] * (1 - a),
        1,
      ];
    }

    function channel(v: number): number {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }

    function luminance(c: Rgba): number {
      return 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
    }

    function ratio(a: Rgba, b: Rgba): number {
      const la = luminance(a);
      const lb = luminance(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    }

    /**
     * The colour stops of a CSS gradient, or `null` if this is not one we can
     * read (a `url()` image, a keyword we do not parse, a stop with alpha).
     *
     * The computed value of `background-image` has already resolved every
     * `var()` and colour keyword to `rgb(…)` / `rgba(…)`, so the stops fall out
     * of a match. Everything else in the string — the shape, the position, the
     * percentages — is geometry, and geometry is exactly what we are refusing to
     * reason about.
     */
    function gradientStops(image: string): Rgba[] | null {
      if (!/gradient\(/.test(image)) return null;
      const found = image.match(/rgba?\([^)]*\)/g);
      if (!found || found.length === 0) return null;
      const stops: Rgba[] = [];
      for (const token of found) {
        const c = parse(token);
        // A translucent stop is a window onto whatever is behind it, and that is
        // a different question from "which stop is darkest". Refuse rather than
        // guess; the caller reports it as unmeasured.
        if (!c || c[3] !== 1) return null;
        stops.push(c);
      }
      return stops;
    }

    /**
     * The colours that can be behind this text — plural, deliberately.
     *
     * Semi-transparent surfaces are the point: the selected hop chip paints an
     * accent at partial alpha over paper, and reading only the topmost declared
     * `background-color` reports the chip as paper — which is how text the same
     * colour as its own token measured 1.00:1 in an early pass and was believed.
     * Layers are composited outward until an opaque one is reached.
     *
     * **A gradient returns every one of its stops, and the caller must clear the
     * floor against all of them.** This used to bail — "a gradient is a range of
     * colours, not one" — and that was true but it was also the wrong conclusion:
     * it made the field the app's largest surface and its least measured one. The
     * mushaf's field is a radial wash, so every hint drawn on it landed in
     * `unmeasured`, which is reported and never asserted on.
     *
     * Taking the worst stop is not a heuristic. sRGB interpolation moves each
     * channel monotonically between two stops, relative luminance is increasing
     * in each channel, so luminance along the ramp is monotone and its extremes
     * are the stops themselves. Contrast depends only on luminance. Checking
     * every stop therefore checks every pixel of the ramp — conservative in the
     * one direction that is safe, since a stop that passes cannot hide a pixel
     * that fails.
     */
    function backgroundOf(el: Element): { colors: Rgba[] } | { reason: string } {
      const layers: Rgba[] = [];
      const under = (base: Rgba): Rgba =>
        layers.reduceRight((acc, over) => composite(over, acc), base);
      let node: Element | null = el;
      while (node) {
        const cs = getComputedStyle(node);
        if (cs.backgroundImage !== "none") {
          const stops = gradientStops(cs.backgroundImage);
          if (!stops) return { reason: `background-image on ${label(node)}` };
          return { colors: stops.map(under) };
        }
        const bg = parse(cs.backgroundColor);
        if (bg && bg[3] > 0) {
          if (bg[3] === 1) return { colors: [under(bg)] };
          layers.push(bg);
        }
        node = node.parentElement;
      }
      return { reason: "no opaque background found up to <html>" };
    }

    function label(el: Element): string {
      const cls = String((el as HTMLElement).className || "")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .join(".");
      return cls ? `${el.tagName.toLowerCase()}.${cls}` : el.tagName.toLowerCase();
    }

    const failures: ContrastFailure[] = [];
    const unmeasured: Unmeasured[] = [];
    let measured = 0;

    for (const el of Array.from(document.querySelectorAll("*"))) {
      // Its *own* text, not a descendant's: otherwise every wrapper is measured
      // with its children's colours and the same finding is reported five times.
      const owns = Array.from(el.childNodes).some(
        (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim().length > 0,
      );
      if (!owns) continue;

      // The mushaf itself — vendored geometry, not chrome this app styles.
      if (el.closest("svg")) continue;

      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;

      const rect = el.getBoundingClientRect();
      // Clipped-to-1px screen-reader text is announced, never seen. Contrast is
      // a claim about what the eye can read.
      if (rect.width < 2 || rect.height < 2) continue;

      const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
      const bg = backgroundOf(el);
      if ("reason" in bg) {
        unmeasured.push({ selector: label(el), text, reason: bg.reason });
        continue;
      }

      const fg = parse(cs.color);
      if (!fg) continue;
      measured += 1;

      const fontPx = parseFloat(cs.fontSize);
      const weight = Number(cs.fontWeight) || 400;
      // WCAG 2.1 §1.4.3: large text is 18pt (24px), or 14pt (18.66px) bold.
      const large = fontPx >= 24 || (fontPx >= 18.66 && weight >= 700);
      const required = large ? 3 : 4.5;

      // The worst place this text can land. One candidate for a flat surface,
      // one per stop for a gradient — and a gradient passes only if its whole
      // ramp does, because the reader does not get to choose which end of the
      // field the hint appears over.
      let worst = bg.colors[0]!;
      let value = ratio(composite(fg, worst), worst);
      for (const candidate of bg.colors.slice(1)) {
        const v = ratio(composite(fg, candidate), candidate);
        if (v < value) {
          value = v;
          worst = candidate;
        }
      }
      if (value + 0.005 < required) {
        failures.push({
          ratio: Math.round(value * 100) / 100,
          required,
          foreground: cs.color,
          background: `rgb(${worst.slice(0, 3).map(Math.round).join(", ")})`,
          fontPx,
          weight,
          selector: label(el),
          text,
        });
      }
    }

    return { measured, failures: failures.sort((a, b) => a.ratio - b.ratio), unmeasured };
  });
}

/** A failure list a reader can act on without opening devtools. */
export function formatFailures(report: ContrastReport): string {
  const lines = report.failures.map(
    (f) =>
      `  ${f.ratio.toFixed(2)}:1 (needs ${f.required}:1)  ${f.selector}  «${f.text}»\n` +
      `      ${f.foreground} on ${f.background}, ${f.fontPx}px/${f.weight}`,
  );
  const tail = report.unmeasured.length
    ? `\n  — ${report.unmeasured.length} element(s) not measurable: ` +
      report.unmeasured.map((u) => `${u.selector} (${u.reason})`).join(", ")
    : "";
  return `${report.measured} text elements measured\n${lines.join("\n")}${tail}`;
}
