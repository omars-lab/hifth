import { serializeState, type AppState, type OpenPanel } from "@hifth/core";

/**
 * The links the share sheet writes, and the shape of the sheet that writes them
 * (decision share-sheet-builder).
 *
 * Two links describe the same view: the website's, which anyone with a browser
 * can open, and the app's, which the Mac and iPad shell opens straight into
 * the verse. Both are the app's own address grammar (`serializeState`) behind a
 * different front: the site's `#/`, or `hifth://` with the `#` dropped, which is
 * exactly what the shell's contract accepts. Nothing here knows a route of its
 * own, so a link the sheet writes is a link a cold open already parses.
 */

/** The three shapes built for the decision page; C is what the app shows. */
export type ShareShape = "a" | "b" | "c";

/**
 * What the link opens on arrival: nothing beyond the verse, or one of the
 * panels a reader would send someone to look at. The commentary is a pitch-only
 * panel and the sheet offers it only in that build.
 */
export type SharePanel = "" | Extract<OpenPanel, "lookalikes" | "roots" | "commentary">;

/**
 * Read the sheet's shape from the page's address (`?share=a|b|c`), so the
 * decision page can mount all three and a losing shape stays tryable by its
 * address. Anything else, including nothing, is C.
 */
export function shareShapeFromUrl(search: string): ShareShape {
  const v = new URLSearchParams(search).get("share")?.toLowerCase();
  return v === "a" || v === "b" ? v : "c";
}

/** Both links for a view, with the chosen panel (if any) written into each. */
export function linksFor(
  state: AppState,
  panel: SharePanel,
  base: string,
): { site: string; app: string } {
  const hash = serializeState(panel ? { ...state, open: panel } : state);
  return { site: base + hash, app: "hifth://" + hash.slice(1) };
}
