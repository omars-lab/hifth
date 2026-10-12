/**
 * Whether Note, Harakat and Word sit on the bar as three buttons or as one
 * (docs/design/notes-style-toolbar.md, ②), and where the reader's choice is
 * kept.
 *
 * The owner asked on 2026-10-12 for the one button to be built and offered as
 * a setting, with the three buttons kept as the default until use shows which
 * is better:
 *
 *   three  Note, Harakat and Word each have a button (the default);
 *   one    one button stands for all three, showing the one last used, and
 *          while it is on the three are offered beside it, where the
 *          highlighter offers its colours.
 *
 * Their keys (N, K, W) pick each one directly in both.
 *
 * Its own module, free of React and CSS, so the e2e tier imports the key
 * rather than retyping it — the discipline `pen-home.ts` keeps.
 */

export type MarkTools = "three" | "one";

/** In settings order. */
export const MARK_TOOLS: readonly MarkTools[] = ["three", "one"];

/** Versioned: a shape that later changes what it does gets a new key. */
export const MARK_TOOLS_KEY = "hifth.tools.marks.v1";

/** The three the one button stands for, in the order the bar showed them. */
export const MARK_AIMS = ["note", "sign", "word"] as const;
export type MarkAim = (typeof MARK_AIMS)[number];

export function isMarkAim(tool: string): tool is MarkAim {
  return (MARK_AIMS as readonly string[]).includes(tool);
}

export function savedMarkTools(): MarkTools {
  try {
    return localStorage.getItem(MARK_TOOLS_KEY) === "one" ? "one" : "three";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "three";
  }
}

export function rememberMarkTools(choice: MarkTools): void {
  try {
    localStorage.setItem(MARK_TOOLS_KEY, choice);
  } catch {
    /* nothing to do — see savedMarkTools */
  }
}

/**
 * The bar's tools for a shape: unchanged for three buttons; for one, Note,
 * Harakat and Word folded into a single entry where Note stood, standing for
 * `aim` — the one on now, or the one last used.
 */
export function toolsFor<T extends { tool: string }>(tools: readonly T[], shape: MarkTools, aim: MarkAim): readonly T[] {
  if (shape === "three") return tools;
  const joined = tools.find((x) => x.tool === aim);
  return tools.flatMap((x) => (x.tool === "note" && joined ? [joined] : isMarkAim(x.tool) ? [] : [x]));
}
