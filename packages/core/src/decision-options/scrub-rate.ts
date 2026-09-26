/**
 * phone-scrub (settled on D, docs/decisions/page-bar-phone-scrub.md): a phone has no
 * hover, so the page bar's magnifier never appears there. While a reader drags
 * the knob with a thumb, how do they land on one exact page out of 604, on a bar
 * where each page is about half a pixel wide?
 *
 * Four interchangeable strategies, one per option on the decision page
 * (docs/design/page-bar-phone-scrub-options.html), where each is mounted live on
 * a phone-sized bar so the reader chooses by dragging, not by reading:
 *
 *   A · today — the knob follows the finger at full speed.
 *   B · slow down by sliding away — Apple's players: full speed on the bar, then
 *       half, a quarter and a tenth as the finger rises above it.
 *   C · a strip of page marks above the finger while dragging, at full speed.
 *   D · B and C together — the strip zooms in as the knob slows.
 *
 * As in detent-strategy.ts, every function here is standalone: it reads only its
 * arguments, so the page builder inlines the very same compiled source and the
 * page runs what the unit test checks. The owner picked D: the page bar imports
 * its pieces (scrubRateSlowAway, scrubAdvance, stripPxPerPage and the bands) and
 * nothing else. A to C stay here so the decision page can still be tried.
 */

/** From this height above the bar (px), the knob moves at `rate` times the finger. */
export interface ScrubBand {
  readonly fromPx: number;
  readonly rate: number;
}

/**
 * The speeds Apple's video player uses, as documented by the open rebuild at
 * arthurhammer.de/2020/03/uislider-with-scrubbing-speeds: full speed on the bar,
 * half from 50 points above it, a quarter from 100, a tenth from 150.
 */
export const APPLE_SCRUB_BANDS: readonly ScrubBand[] = [
  { fromPx: 0, rate: 1 },
  { fromPx: 50, rate: 0.5 },
  { fromPx: 100, rate: 0.25 },
  { fromPx: 150, rate: 0.1 },
];

/** A and C: the knob always moves with the finger. */
export function scrubRateFull(_offPx: number, _bands: readonly ScrubBand[]): number {
  return 1;
}

/**
 * B and D: the speed for a finger `offPx` above the bar — the last band whose
 * start the finger has passed. Below or on the bar is full speed.
 */
export function scrubRateSlowAway(offPx: number, bands: readonly ScrubBand[]): number {
  let rate = 1;
  for (const band of bands) if (offPx >= band.fromPx) rate = band.rate;
  return rate;
}

/**
 * One step of a drag, in bar pixels. The knob at `pos` moves by the finger's
 * sideways step `dxPx` times `rate`. When the finger comes back down towards the
 * bar (from `prevOffPx` to a smaller `offPx`), the knob also closes the gap to
 * the finger in proportion, so the two meet exactly when the finger is back on
 * the bar — Apple's behaviour, and the reason a slowed knob never strands itself
 * away from the thumb. `fingerPos` is where the finger is along the bar.
 */
export function scrubAdvance(
  pos: number,
  dxPx: number,
  rate: number,
  prevOffPx: number,
  offPx: number,
  fingerPos: number,
): number {
  let next = pos + dxPx * rate;
  if (prevOffPx > 0 && offPx < prevOffPx) {
    const closed = (prevOffPx - Math.max(0, offPx)) / prevOffPx;
    next += (fingerPos - next) * closed;
  }
  return next;
}

/**
 * C and D: how many pixels one page takes in the strip above the finger. The
 * strip is `magnify` times the bar at full speed, and zooms in as the knob slows,
 * so a finger step always moves the strip by the same distance. With the tick
 * rule from the desktop magnifier, a phone bar gives every 5th page at full speed
 * and single pages from a quarter speed down (at `magnify` 5).
 */
export function stripPxPerPage(barPxPerPage: number, rate: number, magnify: number): number {
  return (barPxPerPage * magnify) / rate;
}

/** A scrub rule plus how it presents itself on the decision page. */
export interface ScrubStrategy {
  readonly id: "A" | "B" | "C" | "D";
  readonly label: string;
  /** Does the knob slow as the finger rises above the bar? */
  readonly slows: boolean;
  /** Is a strip of page marks drawn above the finger while dragging? */
  readonly tickStrip: boolean;
  rate(offPx: number, bands: readonly ScrubBand[]): number;
}

export const fullSpeedScrub: ScrubStrategy = {
  id: "A",
  label: "Today: the knob follows the thumb",
  slows: false,
  tickStrip: false,
  rate: scrubRateFull,
};

export const slowAwayScrub: ScrubStrategy = {
  id: "B",
  label: "Slide up and away to slow the knob",
  slows: true,
  tickStrip: false,
  rate: scrubRateSlowAway,
};

export const tickStripScrub: ScrubStrategy = {
  id: "C",
  label: "A strip of page marks above the thumb",
  slows: false,
  tickStrip: true,
  rate: scrubRateFull,
};

export const slowAndStripScrub: ScrubStrategy = {
  id: "D",
  label: "Both: slow down, and the strip zooms in",
  slows: true,
  tickStrip: true,
  rate: scrubRateSlowAway,
};

export const SCRUB_STRATEGIES: readonly ScrubStrategy[] = [
  fullSpeedScrub,
  slowAwayScrub,
  tickStripScrub,
  slowAndStripScrub,
];
