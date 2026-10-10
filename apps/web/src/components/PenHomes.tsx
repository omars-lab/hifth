import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { TOUCH_QUERY, useMediaQuery } from "../useMediaQuery";
import type { Pen } from "../pen";
import { rememberPenFloat, savedPenFloat, sideFits, snapToEdge, type FloatSpot } from "../pen-home";
import type { PageTool } from "./PageStage";
import { LockMark, TOOLS, ToolIcon, toolHint, toolName, useToolPress } from "./PageToolbar";
import styles from "./PenHomes.module.css";
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
}

/** The tools, standing in a row or a column, with arrow keys along them. */
function ToolRow({ tool, locked, onTool, upright }: PenHomeProps & { upright?: boolean }): JSX.Element {
  const { t } = useT();
  const press = useToolPress(tool, onTool);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const at = TOOLS.findIndex((x) => x.tool === tool);
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    let to: number | null = null;
    if (e.key === (rtl ? "ArrowLeft" : "ArrowRight") || e.key === "ArrowDown") to = (at + 1) % TOOLS.length;
    else if (e.key === (rtl ? "ArrowRight" : "ArrowLeft") || e.key === "ArrowUp") to = (at - 1 + TOOLS.length) % TOOLS.length;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = TOOLS.length - 1;
    if (to === null) return;
    e.preventDefault();
    onTool(TOOLS[to]!.tool);
    buttons.current[to]?.focus();
  };
  return (
    <div
      className={styles.tools}
      data-upright={upright || undefined}
      role="radiogroup"
      aria-label={t.toolbarLabel}
      aria-orientation={upright ? "vertical" : "horizontal"}
      onKeyDown={onKeyDown}
    >
      {TOOLS.map(({ tool: x, letter }, i) => (
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
          title={`${toolName(t, x)} (${letter})`}
          tabIndex={tool === x ? 0 : -1}
          data-locked={(locked && tool === x) || undefined}
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
  const { tool, locked, onTool, pen, onPen } = props;
  const { t, dir } = useT();
  const touch = useMediaQuery(TOUCH_QUERY);
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.bottomHost} data-pen-home="bottom" data-tool={tool}>
      <button type="button" className={styles.markUp} dir={dir} aria-expanded={open} onClick={() => setOpen(true)}>
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
          {tool === "highlight" && <PenPicker pen={pen} onPen={onPen} />}
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
  const { tool, onTool, pen, onPen } = props;
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
      {tool === "highlight" && <PenPicker pen={pen} onPen={onPen} />}
    </div>
  );
}

/** How wide the side rail is, for the room it needs beside the book. */
export const SIDE_RAIL = 56;

/**
 * Whether the margin beside the open book holds the side rail, measured from
 * the pages as laid out (offsetWidth, so a zoom in progress does not count):
 * null until the pages are there to measure.
 */
export function useSideRoom(on: boolean): boolean | null {
  const [fits, setFits] = useState<boolean | null>(null);
  useEffect(() => {
    if (!on) return;
    const main = document.querySelector("main");
    if (!main) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const leaves = [...main.querySelectorAll<HTMLElement>("[data-page]")].filter((el) => el.offsetWidth > 0);
        if (leaves.length === 0) return;
        const book = leaves.reduce((sum, el) => sum + el.offsetWidth, 0);
        setFits(sideFits(main.clientWidth, book, SIDE_RAIL));
      });
    };
    const sizes = new ResizeObserver(measure);
    sizes.observe(main);
    const pages = new MutationObserver(measure);
    pages.observe(main, { childList: true, subtree: true });
    measure();
    return () => {
      cancelAnimationFrame(frame);
      sizes.disconnect();
      pages.disconnect();
    };
  }, [on]);
  return on ? fits : null;
}

/**
 * C · the tools standing in the margin beside the book, on the right, the
 * side the reader's hand holds an iPad by. App shows B instead where
 * `useSideRoom` says the margin is too narrow.
 */
export function PenHomeSide(props: PenHomeProps): JSX.Element {
  const { tool, onTool, pen, onPen } = props;
  const { t } = useT();
  return (
    // Laid out left to right in both languages, so the tools keep to the
    // window's edge and the pens to the book's side; the buttons are icons.
    <div className={styles.side} role="toolbar" aria-label={t.toolbarLabel} dir="ltr" data-pen-home="side" data-tool={tool} data-keep-clear="">
      {tool === "highlight" && (
        <div className={styles.sidePens}>
          <PenPicker pen={pen} onPen={onPen} />
        </div>
      )}
      <div className={styles.sideColumn}>
        <DoneTick onDone={() => onTool("select")} />
        <ToolRow {...props} upright />
      </div>
    </div>
  );
}
