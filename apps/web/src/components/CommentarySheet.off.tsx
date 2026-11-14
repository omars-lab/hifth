import type * as Real from "./CommentarySheet";

/*
 * What a build with no commentary gets in place of ./CommentarySheet.tsx: the
 * same two names, drawing nothing. The public site has neither the pitch's
 * book nor a live commentary service, so App.tsx never shows either; but a
 * plain import of the real file still shipped its style sheet and part of its
 * code, 1.4 KB of the first download nobody used (docs/performance.md, item 21).
 * vite.config.ts swaps this in under exactly the switch App.tsx uses
 * (COMMENTARY: the pitch, or a live service), and only for a build, so tests and
 * the type check still read the real file.
 */
export const CommentarySheet: typeof Real.CommentarySheet = () => null;
export const CommentaryTrigger: typeof Real.CommentaryTrigger = () => null;
