import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { TOUCH_QUERY, useMediaQuery } from "../useMediaQuery";
import { isMarkAim, MARK_AIMS, type MarkAim } from "../mark-tools";
import { PENS, type Pen } from "../pen";
import type { PenSide } from "../pen-side";
import { nearTheirEdge, stillOnThem, type FullScreenTools } from "../full-screen-tools";
import { besideTip } from "../pencil";
import { innerSpot, outerSpots, ringCentre, RING_REACH, spotStyle, type TipPens } from "../pen-ring";
import { rememberPenFloat, savedPenFloat, snapToEdge, type FloatSpot } from "../pen-home";
import type { PageTool } from "./PageStage";
import { AimPicker, LockMark, TOOLS, ToolIcon, toolHint, toolName, useToolPress, type ToolEntry } from "./PageToolbar";
import styles from "./PenHomes.module.css";
import { UndoRedo } from "./UndoRedo";
import { PenPicker } from "./PenPicker";

/**
 * Three more homes for the page tools on a computer, or an iPad held sideways
 * (docs/design/notes-style-toolbar.md, ①). The owner asked on 2026-10-05 for
 * every home the study drew to be built and offered as a setting, beside
 * today's strip above the book (`PageToolbar`):
 *
 *   PenHomeFloat   A · a palette over the page, dragged to any edge, as in Notes;
 *   PenHomeBottom  B · a Mark up button in the bottom row, the tools in its place;
 *   PenHomeSide    C · the tools down the empty margin beside the book.
 *
 * All three share one interface and one row of tools, so the one the owner
 * keeps is the same component with the others deleted, or left as a setting.
 * Each carries a Done tick, as Notes does: it puts the tool down, back to
 * plain selecting, which is how a page is read.
 */
export interface PenHomeProps {
  tool: PageTool;
  /** The tool on is locked on, and stays after it is used. */
  locked: boolean;
  onTool: (tool: PageTool, lock?: boolean) => void;
  pen: Pen;
  onPen: (pen: Pen) => void;
  /** Note, Harakat and Word as one button, when the reader set it (mark-tools.ts). */
  tools?: readonly ToolEntry[] | undefined;
  aim?: MarkAim | undefined;
  /** Which side the side rail and the Mark up button stand on (docs/PLAN.md, 95); the right unset. */
  side?: PenSide | undefined;
}

/** Beside the tools, what the tool on offers: the highlighter's colours, or the three the one button stands for. */
function Offered({ tool, locked, onTool, pen, onPen, aim }: PenHomeProps): JSX.Element | null {
  if (tool === "highlight") return <PenPicker pen={pen} onPen={onPen} />;
  if (aim && isMarkAim(tool)) return <AimPicker aim={aim} onAim={(x) => onTool(x, locked)} />;
  return null;
}

/** The tools, standing in a row or a column, with arrow keys along them. */
function ToolRow({
  tool,
  locked,
  onTool,
  upright,
  tools = TOOLS,
  ring,
  onMove = onTool,
  explained,
}: PenHomeProps & {
  upright?: boolean;
  ring?: boolean;
  onMove?: (tool: PageTool) => void;
  explained?: ((tool: PageTool) => string) | undefined;
}): JSX.Element {
  const { t, dir } = useT();
  const press = useToolPress(tool, onTool);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const at = tools.findIndex((x) => x.tool === tool);
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    let to: number | null = null;
    if (e.key === (rtl ? "ArrowLeft" : "ArrowRight") || e.key === "ArrowDown") to = (at + 1) % tools.length;
    else if (e.key === (rtl ? "ArrowRight" : "ArrowLeft") || e.key === "ArrowUp") to = (at - 1 + tools.length) % tools.length;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = tools.length - 1;
    if (to === null) return;
    e.preventDefault();
    onMove(tools[to]!.tool);
    buttons.current[to]?.focus();
  };
  return (
    <div
      className={styles.tools}
      data-ring={ring || undefined}
      data-upright={upright || undefined}
      role="radiogroup"
      aria-label={t.toolbarLabel}
      aria-orientation={upright ? "vertical" : "horizontal"}
      onKeyDown={onKeyDown}
    >
      {tools.map(({ tool: x, letter }, i) => (
        <button
          key={x}
          ref={(el) => {
            buttons.current[i] = el;
          }}
          type="button"
          role="radio"
          className={styles.tool}
          aria-checked={tool === x}
          aria-label={toolName(t, x)}
          aria-keyshortcuts={letter}
          aria-describedby={explained?.(x)}
          title={`${toolName(t, x)} (${letter})`}
          tabIndex={tool === x ? 0 : -1}
          data-locked={(locked && tool === x) || undefined}
          style={ring ? spotStyle(innerSpot(i, tools.length, dir === "rtl")) : undefined}
          {...press(x)}
        >
          <ToolIcon tool={x} />
          {locked && tool === x && <LockMark />}
        </button>
      ))}
    </div>
  );
}

function DoneTick({ onDone }: { onDone: () => void }): JSX.Element {
  const { t } = useT();
  return (
    <button type="button" className={styles.done} aria-label={t.penDone} title={t.penDone} onClick={onDone}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </button>
  );
}

/**
 * B · a Mark up button in the bottom row. Closed, the page is for reading;
 * open, the tools take the row the button was in, with what the tool on is
 * for printed beside them, until Done.
 */
export function PenHomeBottom(props: PenHomeProps): JSX.Element {
  const { tool, locked, onTool } = props;
  const { t, dir } = useT();
  const touch = useMediaQuery(TOUCH_QUERY);
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.bottomHost} data-pen-home="bottom" data-tool={tool}>
      <button type="button" className={styles.markUp} dir={dir} aria-expanded={open} data-pen-side={props.side ?? "right"} onClick={() => setOpen(true)}>
        <ToolIcon tool="highlight" />
        <span>{t.penMarkUp}</span>
      </button>
      {open && (
        // In the chrome's own direction: the bottom row it covers is pinned
        // right to left for the mus'haf, the tools are not.
        <div className={styles.bottom} role="toolbar" aria-label={t.toolbarLabel} dir={dir} data-keep-clear="">
          <DoneTick
            onDone={() => {
              setOpen(false);
              onTool("select");
            }}
          />
          <ToolRow {...props} />
          <Offered {...props} />
          <UndoRedo />
          <span className={styles.hint}>
            {locked
              ? touch
                ? t.toolLockedHintTouch(toolName(t, tool))
                : t.toolLockedHint(toolName(t, tool))
              : toolHint(t, tool, touch)}
          </span>
        </div>
      )}
    </div>
  );
}

const MARGIN = 8;

/** Where the palette's corner goes for a spot on an edge, kept inside the window. */
function placeFor(spot: FloatSpot, size: { w: number; h: number }, view: { w: number; h: number }) {
  const fit = (n: number, room: number) => Math.min(Math.max(MARGIN, n), Math.max(MARGIN, room - MARGIN));
  if (spot.edge === "top" || spot.edge === "bottom") {
    return {
      left: fit(spot.along * view.w - size.w / 2, view.w - size.w),
      top: spot.edge === "top" ? MARGIN : view.h - size.h - MARGIN,
    };
  }
  return {
    left: spot.edge === "left" ? MARGIN : view.w - size.w - MARGIN,
    top: fit(spot.along * view.h - size.h / 2, view.h - size.h),
  };
}

/**
 * A · the palette Notes has: over the page, dragged by its handle to any edge
 * of the window, where it comes to rest, lying flat along the top or bottom and
 * standing up along a side. Where it was left is remembered.
 */
export function PenHomeFloat(props: PenHomeProps): JSX.Element {
  const { tool, onTool } = props;
  const { t, dir } = useT();
  const [spot, setSpot] = useState<FloatSpot>(() => savedPenFloat());
  const [drag, setDrag] = useState<{ left: number; top: number } | null>(null);
  const grab = useRef<{ dx: number; dy: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const upright = spot.edge === "left" || spot.edge === "right";
  const [, relayout] = useState(0);

  // Placed from its own size, which changes with the edge and with the pens.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || drag) return;
    const at = placeFor(spot, { w: el.offsetWidth, h: el.offsetHeight }, { w: window.innerWidth, h: window.innerHeight });
    el.style.left = `${at.left}px`;
    el.style.top = `${at.top}px`;
  });
  useEffect(() => {
    const onResize = () => relayout((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div
      ref={box}
      className={styles.float}
      style={drag ?? undefined}
      role="toolbar"
      aria-label={t.toolbarLabel}
      dir={dir}
      data-pen-home="float"
      data-edge={spot.edge}
      data-upright={upright || undefined}
      data-tool={tool}
      data-keep-clear=""
    >
      <button
        type="button"
        className={styles.grip}
        aria-label={t.penGrip}
        title={t.penGrip}
        data-pen-grip=""
        onPointerDown={(e) => {
          const r = box.current!.getBoundingClientRect();
          grab.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
          e.currentTarget.setPointerCapture(e.pointerId);
          setDrag({ left: r.left, top: r.top });
        }}
        onPointerMove={(e) => {
          if (!grab.current) return;
          setDrag({ left: e.clientX - grab.current.dx, top: e.clientY - grab.current.dy });
        }}
        onPointerUp={(e) => {
          if (!grab.current) return;
          grab.current = null;
          const next = snapToEdge({ x: e.clientX, y: e.clientY }, { width: window.innerWidth, height: window.innerHeight });
          rememberPenFloat(next);
          setSpot(next);
          setDrag(null);
        }}
        onPointerCancel={() => {
          grab.current = null;
          setDrag(null);
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          {[3, 7, 11].flatMap((x) => [4, 10].map((y) => <circle key={`${x}-${y}`} cx={upright ? y : x} cy={upright ? x : y} r="1.3" fill="currentColor" />))}
        </svg>
      </button>
      <DoneTick onDone={() => onTool("select")} />
      <ToolRow {...props} upright={upright} />
      <UndoRedo upright={upright} />
      <Offered {...props} />
    </div>
  );
}

/**
 * The pens beside the Apple Pencil's tip, opened by a squeeze or a double-tap
 * in the iPad app (docs/PLAN.md, 96). Over the page on any layout, upright or
 * sideways, never under the tip, whole inside the window: as rings round the
 * tip, or as a row beside it (pen-ring.ts; the reader's setting). A pick puts
 * the pens away, unless the tool picked has choices of its own to offer;
 * Escape or a touch anywhere else puts them away too. On the rings the hole
 * and the gaps between buttons are the page's, so a touch there is "anywhere
 * else".
 */
export function PenHomeAt(props: PenHomeProps & { at: { x: number; y: number }; onClose: () => void; layout: TipPens }): JSX.Element {
  const { at, onClose, layout, tool, locked, onTool, onPen, aim } = props;
  const { t, dir } = useT();
  const box = useRef<HTMLDivElement>(null);
  const rings = layout === "rings";
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const view = { w: window.innerWidth, h: window.innerHeight };
    const mid = ringCentre(at, view);
    const p = rings ? { left: mid.x - RING_REACH, top: mid.y - RING_REACH } : besideTip(at, { w: el.offsetWidth, h: el.offsetHeight }, view);
    el.style.left = `${p.left}px`;
    el.style.top = `${p.top}px`;
  });
  // The arrow keys start from the tool in hand, with nothing tapped first.
  useLayoutEffect(() => {
    box.current?.querySelector<HTMLElement>('[aria-keyshortcuts][aria-checked="true"]')?.focus({ preventScroll: true });
  }, []);
  // A tool with choices of its own keeps the pens out for them; any other
  // pick, and a pick among the choices, puts the pens away. The arrow keys
  // only move along the tools.
  const offers = (x: PageTool) => x === "highlight" || (!!aim && isMarkAim(x));
  const pick = (next: PageTool, lock?: boolean) => {
    onTool(next, lock);
    if (!offers(next)) onClose();
  };
  const pickPen = (next: Pen) => {
    onPen(next);
    onClose();
  };
  const pickAim = (next: MarkAim) => {
    onTool(next, locked);
    onClose();
  };
  // Heard from the moment the pens are drawn, not a beat later: a key pressed
  // as they appeared did nothing.
  useLayoutEffect(() => {
    // Capture, so Escape closes the pens before it would put the tool down.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    };
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [onClose]);
  return (
    <div ref={box} className={rings ? styles.rings : styles.atTip} role="toolbar" aria-label={t.toolbarLabel} dir={dir} data-pencil-pens={layout} data-tool={tool}>
      <TipPensInside {...props} onTool={pick} onMove={onTool} onPen={pickPen} onAim={pickAim} />
    </div>
  );
}

/** Where to find the line that explains each button, on a page that has them (PenGuide.tsx). */
export interface PensExplained {
  tool: (tool: PageTool) => string;
  pen: string;
  words: string;
}

/**
 * What stands inside the pens at the pencil's tip, in either layout: the
 * tools, and outside the one on its own choices. Shared by the pens the iPad
 * opens and the copy of them the info panel explains, so the two cannot drift
 * apart.
 */
function TipPensInside(
  props: PenHomeProps & {
    layout: TipPens;
    onMove: (tool: PageTool) => void;
    onAim: (aim: MarkAim) => void;
    words?: { pen: Pen; onPen: (pen: Pen) => void } | undefined;
    explained?: PensExplained | undefined;
  },
): JSX.Element {
  const { layout, tool, aim, tools = TOOLS, onMove, onAim, words, explained } = props;
  const { dir } = useT();
  const rings = layout === "rings";
  // On the rings a tool's choices stand outside it, centred on it.
  const rtl = dir === "rtl";
  const spots = (groups: readonly number[]) =>
    rings
      ? outerSpots(innerSpot(Math.max(0, tools.findIndex((x) => x.tool === tool)), tools.length, rtl).angle, groups, rtl).map(spotStyle)
      : undefined;
  return (
    <>
      <ToolRow {...props} onMove={onMove} ring={rings} explained={explained?.tool} />
      {tool === "highlight" && (
        <PenPicker pen={props.pen} onPen={props.onPen} spots={spots([PENS.length, PENS.length])} words={words} explained={explained} />
      )}
      {aim && isMarkAim(tool) && <AimPicker aim={aim} onAim={onAim} spots={spots([MARK_AIMS.length])} explained={explained?.tool} />}
    </>
  );
}

/**
 * The same pens, standing in a page instead of at the pencil's tip, for the
 * page that explains them (PenGuide.tsx). They work, so a reader can press
 * each one, but they are run by that page: nothing here closes them, and no
 * pick reaches the mus'haf page unless the page showing them passes it on.
 */
export function PenHomeHere(
  props: PenHomeProps & {
    layout: TipPens;
    words: { pen: Pen; onPen: (pen: Pen) => void };
    explained: PensExplained;
  },
): JSX.Element {
  const { layout, tool, locked, onTool } = props;
  const { t, dir } = useT();
  return (
    <div className={layout === "rings" ? styles.ringsHere : styles.rowHere} role="toolbar" aria-label={t.toolbarLabel} dir={dir} data-pencil-pens={layout} data-tool={tool}>
      <TipPensInside {...props} onMove={onTool} onAim={(next) => onTool(next, locked)} />
    </div>
  );
}

/**
 * C · the tools standing in the margin beside the book, on the right, the
 * side the reader's hand holds an iPad by, or on the left, mirrored, where the
 * reader set it (docs/PLAN.md, 95). App shows B instead where
 * `useSideRoom` says the margin is too narrow.
 */
/** How long hidden tools wait, once the pointer has left them, before going. */
const EDGE_LINGER_MS = 350;

/**
 * In full screen (full-screen-tools.ts), the ways the side rail can stay:
 * hidden at the window's edge until the pointer comes, or a small dock that
 * opens out. Returns what the rail carries for each, nothing for "side".
 */
function useFullScreenRail(full: FullScreenTools | undefined, side: PenSide, rail: React.RefObject<HTMLDivElement | null>) {
  const [shown, setShown] = useState(false);
  const [open, setOpen] = useState(false);
  // Hidden at the edge: the pointer resting at that side of the window brings
  // them back, and they stay while it is on them or just round them.
  useEffect(() => {
    if (full !== "edge") return;
    let linger = 0;
    const onPointer = (e: PointerEvent) => {
      const el = rail.current;
      if (nearTheirEdge(e.clientX, window.innerWidth, side)) {
        window.clearTimeout(linger);
        linger = 0;
        setShown(true);
        return;
      }
      const box = el?.getBoundingClientRect();
      if (box && stillOnThem(e.clientX, e.clientY, box)) {
        window.clearTimeout(linger);
        linger = 0;
        return;
      }
      if (linger === 0) linger = window.setTimeout(() => {
        linger = 0;
        setShown(false);
      }, EDGE_LINGER_MS);
    };
    window.addEventListener("pointermove", onPointer);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.clearTimeout(linger);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onPointer);
      setShown(false);
    };
  }, [full, side, rail]);
  // The dock: a finger, with nothing to hover, opens it with a tap, and a tap
  // anywhere else shuts it again.
  useEffect(() => {
    if (full !== "dock" || !open) return;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "touch" && !rail.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [full, open, rail]);
  useEffect(() => {
    if (full !== "dock") setOpen(false);
  }, [full]);
  if (full === "edge") return { "data-edge": shown ? "shown" : "hidden" } as const;
  if (full !== "dock") return {};
  return {
    "data-dock": open ? "open" : "shut",
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType !== "touch") setOpen(true);
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if (e.pointerType !== "touch") setOpen(false);
    },
    // A key that reaches a button opens it; a tap's focus does not, or the
    // tap would open it and pick in one go.
    onFocus: (e: React.FocusEvent) => {
      if ((e.target as Element).matches(":focus-visible")) setOpen(true);
    },
    onBlur: (e: React.FocusEvent) => {
      if (!rail.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
    },
    // While shut, a tap only opens it: the tool under the finger is too small
    // to aim at, so nothing is picked and nothing is held on.
    onPointerDownCapture: (e: React.PointerEvent) => {
      if (!open) e.stopPropagation();
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (open) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(true);
    },
  } as const;
}

export function PenHomeSide(props: PenHomeProps & { full?: FullScreenTools | undefined }): JSX.Element {
  const { full, ...home } = props;
  const { tool, onTool } = home;
  const { t } = useT();
  const pens = tool === "highlight" || (home.aim && isMarkAim(tool));
  const rail = useRef<HTMLDivElement | null>(null);
  const stays = useFullScreenRail(full, home.side ?? "right", rail);
  return (
    // Laid out left to right in both languages, so the tools keep to the
    // window's edge and the pens to the book's side; the buttons are icons.
    // In full screen they stay (data-full-keep), the one bar that does.
    <div ref={rail} className={styles.side} role="toolbar" aria-label={t.toolbarLabel} dir="ltr" data-pen-home="side" data-pen-side={home.side ?? "right"} data-tool={tool} data-keep-clear="" data-full-keep={full} {...stays}>
      {/* Undo and redo stand at the foot of the pens' side, in the room the
          pens leave under them, so the rail grows no taller than the tools. */}
      <div className={styles.sideNear} data-pens={pens || undefined}>
        {pens && (
          <div className={styles.sidePens}>
            <Offered {...home} />
          </div>
        )}
        <div className={styles.sideUndo}>
          <UndoRedo upright={!pens} />
        </div>
      </div>
      <div className={styles.sideColumn}>
        <DoneTick onDone={() => onTool("select")} />
        <ToolRow {...home} upright />
      </div>
    </div>
  );
}
