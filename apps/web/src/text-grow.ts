/**
 * Larger text for the bars, buttons and panels: a rough build to choose from
 * (backlog row a11y-larger-text, design item ㊾). Off unless a reader picks a
 * way, so the app as it is does not move by a pixel.
 *
 *   phone   bars and panels follow the phone's text size
 *   panels  only the panels follow it; the bars stay as they are
 *   own     bars and panels take a size of our own (1.25 or 1.5)
 *
 * Picked with a link for now (?grow=phone|panels|own|off, &size=1.25|1.5) and
 * kept on this device; it gets a place in the info panel once the owner picks.
 * The mus'haf page is never grown here: it has its own size control.
 *
 * Free of React and CSS, so the tests import it rather than retyping the key.
 */

export type TextGrowWay = "phone" | "panels" | "own";
export interface TextGrow {
  way: TextGrowWay | null;
  size: number;
}

/** Versioned: the rough build's key, dropped when the chosen way ships. */
export const TEXT_GROW_KEY = "hifth.text.grow.v0";
/** Past twice the size, a bar no longer fits a small phone at all. */
export const GROW_CAP = 2;
const WAYS: readonly string[] = ["phone", "panels", "own"];
const SIZES: readonly number[] = [1.25, 1.5];

/** The way a link asks for, else the one this device kept. */
export function textGrowFrom(search: string, store: Storage | undefined): TextGrow {
  let kept: TextGrow = { way: null, size: 1.5 };
  try {
    kept = { ...kept, ...JSON.parse(store?.getItem(TEXT_GROW_KEY) || "{}") };
  } catch {
    /* Safari private mode, or a broken value: the default */
  }
  const asked = new URLSearchParams(search);
  const way = asked.get("grow");
  const size = Number(asked.get("size"));
  const next: TextGrow = {
    way: WAYS.includes(way!) ? (way as TextGrowWay) : way === "off" ? null : kept.way,
    size: SIZES.includes(size) ? size : SIZES.includes(kept.size) ? kept.size : 1.5,
  };
  if (way !== null) {
    try {
      store?.setItem(TEXT_GROW_KEY, JSON.stringify(next));
    } catch {
      /* nothing to do */
    }
  }
  return next;
}

/**
 * How much larger the reader has set their text. An iPhone draws body text at
 * 17 px by default (53 at its largest); a browser that does not know the phone's
 * font gives the page's own 16, where a larger browser text setting shows.
 */
export const phoneTextScale = (px: { appleBody: number; root: number }): number =>
  Math.min(GROW_CAP, Math.max(1, Math.round(Math.max(px.appleBody / 17, px.root / 16) * 100) / 100));

export const growScale = (grow: TextGrow, phone: number): number =>
  grow.way === null ? 1 : grow.way === "own" ? grow.size : phone;

const px = (el: Element) => parseFloat(getComputedStyle(el).fontSize) || 16;

/** Measures the phone's text size with a hidden probe in the document. */
export function measurePhoneText(doc: Document): number {
  const probe = doc.body.appendChild(doc.createElement("i"));
  probe.style.cssText = "position:absolute;visibility:hidden;font:-apple-system-body";
  const appleBody = px(probe);
  probe.remove();
  return phoneTextScale({ appleBody, root: px(doc.documentElement) });
}

export function applyTextGrow(root: HTMLElement, grow: TextGrow, phone: number): void {
  if (grow.way === null) {
    delete root.dataset.textGrow;
    root.style.removeProperty("--text-grow");
  } else {
    root.dataset.textGrow = grow.way;
    root.style.setProperty("--text-grow", "" + growScale(grow, phone));
  }
}

/** At start, and again whenever the reader comes back (they may have changed the phone's size). */
export function installTextGrow(win: Window): void {
  let store: Storage | undefined;
  try {
    store = win.localStorage;
  } catch {
    /* Safari private mode */
  }
  const grow = textGrowFrom(win.location.search, store);
  if (grow.way === null) return;
  const doc = win.document;
  const apply = () => applyTextGrow(doc.documentElement, grow, measurePhoneText(doc));
  apply();
  doc.addEventListener("visibilitychange", apply);
}
