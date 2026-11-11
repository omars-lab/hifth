/**
 * Where a page tool's help is shown (docs/design/ayah-drawer.md ①).
 *
 * Every tool's button carries a label, shown while the pointer rests on it or
 * the keyboard reaches it: its name, its key and what it does. The owner asked
 * on 2026-11-07 for the help to live there instead of in the line beside the
 * bar. Both are kept and the reader picks in settings; the line stays on by
 * default until the owner has tried the bar without it.
 *
 *   line   today's way: the label on each tool, and the line beside the bar
 *          saying what the tool that is on does.
 *   hover  the label only. Where nothing can hover (a tablet) the line stays,
 *          since a finger has no way to bring the label up.
 *
 * Its own module, free of React and CSS, so the e2e tier imports the key.
 */

export type ToolHelp = "line" | "hover";

/** In settings order. */
export const TOOL_HELPS: readonly ToolHelp[] = ["line", "hover"];

/** Versioned: an option that later changes what it does gets a new key. */
export const TOOL_HELP_KEY = "hifth.tool.help.v1";

/** The option this device chose, or the line when it never chose. */
export function savedToolHelp(): ToolHelp {
  try {
    return localStorage.getItem(TOOL_HELP_KEY) === "hover" ? "hover" : "line";
  } catch {
    // Safari private mode throws on localStorage: the default.
    return "line";
  }
}

export function rememberToolHelp(choice: ToolHelp): void {
  try {
    localStorage.setItem(TOOL_HELP_KEY, choice);
  } catch {
    /* nothing to do — see savedToolHelp */
  }
}
