import { useEffect, useState } from "react";

/**
 * The one desktop breakpoint. One query, two behaviours — there is no tablet tier.
 *
 * **Two axes, and height is the one that binds.** A mus'haf leaf is portrait
 * (`viewBox="0 0 345 550"`, aspect 0.627), so a leaf's width is derived from the
 * height the chrome leaves the stage, not from how wide the window is. Two leaves
 * need only ~774px of width; what they need is vertical room.
 *
 * The rule they are sized by: **a leaf must never be narrower than the narrowest
 * supported phone gives the single page it replaced.** `e2e/chrome-fit.spec.ts`
 * supports 320px, and there the scripture measures **290px** — the page host's
 * border and fore-edge stack come off the stage's width before the SVG is laid
 * out. Both sides of the comparison are the SVG, deliberately: comparing a leaf's
 * *box* against a phone's *page* is how the old derivation came out 33px optimistic.
 *
 * Both terms are measured, not estimated. Chrome above and below the stage is
 * **252px** (header 72 + trail 52 + page bar 56 + the shell's own 72), the leaf
 * box is `0.627 × (H − 252)`, and 14px of that is border and fore-edge stack. So
 *
 * ```
 * 0.627 × (H − 252) − 14 ≥ 290   ⟹   H ≥ 737
 * ```
 *
 * and the width requirement is `2×290 + 14 + 14 = 608`.
 *
 * 740 and 1024 are the chosen rounds. Height sits 3px above its floor because
 * that axis is scarce and every step up excludes a real laptop; width sits well
 * above its own because that axis is nearly free and buys room for the chrome
 * desktop adds. The whole derivation is docs/design/desktop.md §3.
 *
 * Height was 720 until the leaf was sized to the page it holds: the estimate it
 * had been derived from (a 220px chrome allowance) was 32px light, and the honest
 * arithmetic put the corner at 280px of scripture — under the floor this rule
 * exists to hold. Verified by measurement at 1024×740, not by re-deriving it.
 *
 * Repeated as a literal in DesktopChrome.module.css, because a CSS custom
 * property cannot appear inside a media query. The two must agree; this string is
 * the copy of record, and `useMediaQuery.test.ts` pins it so a change here is at
 * least loud enough that the CSS gets changed with it.
 */
export const DESKTOP_QUERY = "(min-width: 1024px) and (min-height: 740px)";

/**
 * Subscribe to a CSS media query from JavaScript.
 *
 * ## Why this exists at all, when CSS has media queries
 *
 * Because the desktop spread's second page must not be *hidden* below the
 * breakpoint — it must not be **mounted**. A `display: none` panel still fetches
 * its ~170 KB inline SVG, still parses it, still builds a `Highlighter`, and
 * still costs the frame budget the app's whole performance story is about (PLAN
 * follow-up ①). Desktop is where a second page is affordable; a phone is exactly
 * where it is not. So the decision has to be reachable by React, not only by the
 * style engine.
 *
 * ## Why the default is `false`
 *
 * No `matchMedia` (jsdom without a stub, an SSR pass, an ancient engine) answers
 * "not desktop", which renders the phone layout — one page, one mount, no extra
 * bytes. The failure mode of guessing wrong in the other direction is a low-end
 * device being handed two SVGs by a feature-detection miss, which is the one
 * outcome this hook exists to prevent.
 *
 * The initial value is read in `useState`'s initialiser rather than in an effect,
 * so a desktop window renders the spread on its first frame instead of mounting
 * the phone layout and reflowing a tick later.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    // Re-read on subscribe: between the initialiser above and this effect the
    // window can already have been resized (or the query prop changed), and a
    // listener only reports *changes* from whatever it is attached to.
    setMatches(mql.matches);
    const onChange = (e: MediaQueryListEvent): void => setMatches(e.matches);
    // `addEventListener` on a MediaQueryList is Safari 14+. Older WebKit only has
    // the deprecated `addListener`, and this app's acceptance device is an
    // iPhone — falling back is cheaper than deciding a reader's Safari is too old
    // to be shown a layout.
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    const legacy = mql as MediaQueryList & {
      addListener?: (l: (e: MediaQueryListEvent) => void) => void;
      removeListener?: (l: (e: MediaQueryListEvent) => void) => void;
    };
    legacy.addListener?.(onChange);
    return () => legacy.removeListener?.(onChange);
  }, [query]);

  return matches;
}
