/**
 * Where the page tools sit on a computer, or an iPad held sideways, and where
 * the reader's choice is kept (docs/design/notes-style-toolbar.md, ①).
 *
 * The owner asked on 2026-10-05 for every home the study drew to be built and
 * offered as a setting, so each can be tried by hand:
 *
 *   strip   today's row above the book (the default until one is chosen);
 *   float   A · a palette over the page, dragged to any edge, as in Notes;
 *   bottom  B · a Mark up button in the bottom row, the pens in its place;
 *   side    C · the pens down the empty margin beside the book, falling back
 *           to B where there is no margin.
 *
 * A phone, and an iPad held upright, already use the bottom-row tray, which is
 * B; this setting is for the wider layout only.
 *
 * Its own module, free of React and CSS, so the e2e tier imports the keys
 * rather than retyping them — the discipline `verse-gestures.ts` keeps.
 */

export type PenHome = "strip" | "float" | "bottom" | "side";

/** In settings order. */
export const PEN_HOMES: readonly PenHome[] = ["strip", "float", "bottom", "side"];

/** Versioned: a home that later changes what it does gets a new key. */
export const PEN_HOME_KEY = "hifth.pens.home.v1";

/** Where the floating palette was last left. */
export const PEN_FLOAT_KEY = "hifth.pens.float.v1";

function isPenHome(value: unknown): value is PenHome {
  return value === "strip" || value === "float" || value === "bottom" || value === "side";
}

/** The home this device chose, or the strip when it never chose. */
export function savedPenHome(): PenHome {
  try {
    const stored = localStorage.getItem(PEN_HOME_KEY);
    return isPenHome(stored) ? stored : "strip";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "strip";
  }
}

export function rememberPenHome(choice: PenHome): void {
  try {
    localStorage.setItem(PEN_HOME_KEY, choice);
  } catch {
    /* nothing to do — see savedPenHome */
  }
}

export type Edge = "top" | "bottom" | "left" | "right";

/** An edge of the window, and how far along it, from 0 (left or top) to 1. */
export interface FloatSpot {
  edge: Edge;
  along: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Where a palette let go at `at` comes to rest: on the window edge nearest the
 * point, as far along that edge as the point was. Notes does the same, so the
 * palette never stops half way across the page.
 */
export function snapToEdge(point: { x: number; y: number }, screen: { width: number; height: number }): FloatSpot {
  // A palette let go outside the window counts from the nearest point inside it.
  const at = {
    x: Math.min(screen.width, Math.max(0, point.x)),
    y: Math.min(screen.height, Math.max(0, point.y)),
  };
  const gaps: Array<[Edge, number]> = [
    ["top", at.y],
    ["bottom", screen.height - at.y],
    ["left", at.x],
    ["right", screen.width - at.x],
  ];
  const [edge] = gaps.reduce((a, b) => (b[1] < a[1] ? b : a));
  const along = edge === "top" || edge === "bottom" ? at.x / screen.width : at.y / screen.height;
  return { edge, along: clamp01(along) };
}

const FLOAT_START: FloatSpot = { edge: "bottom", along: 0.5 };

export function savedPenFloat(): FloatSpot {
  try {
    const raw = localStorage.getItem(PEN_FLOAT_KEY);
    if (!raw) return FLOAT_START;
    const v = JSON.parse(raw) as Partial<FloatSpot>;
    const edges: Edge[] = ["top", "bottom", "left", "right"];
    if (!edges.includes(v.edge as Edge) || typeof v.along !== "number" || v.along < 0 || v.along > 1) return FLOAT_START;
    return { edge: v.edge as Edge, along: v.along };
  } catch {
    return FLOAT_START;
  }
}

export function rememberPenFloat(spot: FloatSpot): void {
  try {
    localStorage.setItem(PEN_FLOAT_KEY, JSON.stringify(spot));
  } catch {
    /* nothing to do — see savedPenHome */
  }
}

/**
 * Whether the pens fit down the side of the stage without touching the book:
 * the margin either side of it must hold the rail and a gap on each side of
 * the rail. Upright, zoomed in, or in a narrow window it does not, and the
 * pens go to the bottom row instead.
 */
export function sideFits(stageWidth: number, bookWidth: number, railWidth: number, gap = 8): boolean {
  return (stageWidth - bookWidth) / 2 >= railWidth + 2 * gap;
}
