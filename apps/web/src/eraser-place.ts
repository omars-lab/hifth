/**
 * Where the eraser sits on a computer's tool bar, and where the reader's
 * choice is kept.
 *
 *   tools  one of the tools, at the end of their row, picked like the others
 *          (the default since the owner's page comment of 2026-11-07: "why is
 *          this not in the tool bar ... it should be an eraser mode");
 *   undo   beside Undo and Redo, where it was first built
 *          (docs/design/notes-style-toolbar.md ③), kept as a setting.
 *
 * A phone keeps it beside Undo either way: its bar has no room for an
 * eleventh tool. E puts it on and down in both.
 *
 * Its own module, free of React and CSS, so the e2e tier can import the key.
 */

export type EraserPlace = "tools" | "undo";

/** In settings order. */
export const ERASER_PLACES: readonly EraserPlace[] = ["tools", "undo"];

/** Versioned: a place that later changes what it does gets a new key. */
export const ERASER_PLACE_KEY = "hifth.tools.eraser.v1";

export function savedEraserPlace(): EraserPlace {
  try {
    return localStorage.getItem(ERASER_PLACE_KEY) === "undo" ? "undo" : "tools";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "tools";
  }
}

export function rememberEraserPlace(choice: EraserPlace): void {
  try {
    localStorage.setItem(ERASER_PLACE_KEY, choice);
  } catch {
    /* nothing to do — see savedEraserPlace */
  }
}
