import { useEffect, useRef, type ReactNode } from "react";
import { useT } from "../i18n";
import { TOUCH_QUERY, useMediaQuery } from "../useMediaQuery";
import type { Pen } from "../pen";
import type { PageTool } from "./PageStage";
import styles from "./PageToolbar.module.css";
import { PenPicker } from "./PenPicker";

/**
 * The key for each tool, by its place on the keyboard rather than the letter it
 * prints, so V still picks Select on an Arabic keyboard where that key types
 * «ر» (docs/design/page-toolbar-plan.md, "Keyboard shortcuts on single letters
 * have rules").
 */
export const TOOL_KEYS: Readonly<Record<string, PageTool>> = {
  KeyR: "read",
  KeyV: "select",
  KeyH: "highlight",
  KeyB: "bookmark",
  KeyN: "note",
  KeyK: "sign",
  KeyW: "word",
  KeyM: "mistake",
  KeyC: "crop",
  KeyJ: "jump",
};

/** The tools in the order every bar shows them, desktop and phone alike. */
export const TOOLS: ReadonlyArray<{ tool: PageTool; letter: string }> = [
  { tool: "read", letter: "R" },
  { tool: "select", letter: "V" },
  { tool: "highlight", letter: "H" },
  { tool: "bookmark", letter: "B" },
  { tool: "note", letter: "N" },
  { tool: "sign", letter: "K" },
  { tool: "word", letter: "W" },
  { tool: "mistake", letter: "M" },
  { tool: "crop", letter: "C" },
  { tool: "jump", letter: "J" },
];

/** How long a finger rests on a tool before it locks on. */
const HOLD_MS = 500;

/**
 * What a press on a tool button does, on every bar: a click picks the tool, or
 * puts down the one already on; a double-click, or a long press, locks it on so
 * it is not put down after one use (docs/design/page-toolbar-plan.md, "Double-
 * click locks any tool on, as in tldraw"). One timer for the whole bar, since a
 * hand presses one button at a time.
 */
export function useToolPress(
  tool: PageTool,
  onTool: (tool: PageTool, lock?: boolean) => void,
): (x: PageTool) => React.ButtonHTMLAttributes<HTMLButtonElement> {
  const timer = useRef<number | null>(null);
  // A long press that locked a tool is followed by its own click on release,
  // which must not put the tool straight back down.
  const held = useRef(false);
  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);
  return (x) => ({
    onClick: (e) => {
      if (held.current) {
        held.current = false;
        return;
      }
      if (e.detail === 2 && x !== "select") onTool(x, true);
      else onTool(tool === x && x !== "select" ? "select" : x);
    },
    onPointerDown: (e) => {
      held.current = false;
      clear();
      if (x === "select" || e.button !== 0) return;
      timer.current = window.setTimeout(() => {
        timer.current = null;
        held.current = true;
        onTool(x, true);
      }, HOLD_MS);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    // A held finger would otherwise open the phone's own copy menu.
    onContextMenu: (e) => e.preventDefault(),
  });
}

/** The small lock drawn on a tool that is locked on. */
export function LockMark(): JSX.Element {
  return (
    <svg className={styles.lock} width="9" height="9" viewBox="0 0 10 10" aria-hidden="true" data-lock-mark="">
      <rect x="1.5" y="4.5" width="7" height="5" rx="1" fill="currentColor" />
      <path d="M3 4.5V3a2 2 0 0 1 4 0v1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

interface PageToolbarProps {
  tool: PageTool;
  /** The tool on is locked on, and stays after it is used. */
  locked: boolean;
  /**
   * Asked for a tool. Clicking the one already on asks for "select"; a
   * double-click asks for it locked on.
   */
  onTool: (tool: PageTool, lock?: boolean) => void;
  /** The highlighter's pen, offered beside the tools while the highlighter is on. */
  pen: Pen;
  onPen: (pen: Pen) => void;
  /**
   * Held at the far end of the row: the look-alike chips, when a magnified
   * page leaves no desk beside it and the reader keeps them up here
   * (rail-home.ts).
   */
  end?: ReactNode;
}

/**
 * The bar of page tools above the mus'haf on a computer — step 1 of
 * docs/design/page-toolbar-plan.md: select, highlight and bookmark, the three
 * tools that already existed behind a press-and-hold and a corner button — and
 * step 2's note, which pins the reader's words to a word on the page, and
 * step 3's mistake, which marks the words a reader slips on. Between them sit
 * the two tools the harakah-pick decision chose (D): harakat, whose magnifier
 * follows the pointer and takes the sign it rings, and word, which opens a
 * word into its parts.
 *
 * One tab stop, arrow keys along it (the ARIA toolbar pattern), and the tools
 * are radios because exactly one is on at a time. The name of the tool that is
 * on is printed beside the buttons, so the pointer's shape is never the only
 * place it is said; App announces the change for a screen reader.
 *
 * Hidden below the desktop breakpoint by CSS, like `DesktopChrome`: a phone
 * layout for the bar is the plan's step 5 and a decision of its own.
 */
export function PageToolbar({ tool, locked, onTool, pen, onPen, end }: PageToolbarProps): JSX.Element {
  const { t } = useT();
  const touch = useMediaQuery(TOUCH_QUERY);
  const press = useToolPress(tool, onTool);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const nameOf = (x: PageTool) => toolName(t, x);

  // Arrow keys move focus along the bar and pick the tool they land on, as
  // arrows do in any radio group. The bar is laid out in reading order, so in
  // the right-to-left chrome the left arrow is "next".
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const at = TOOLS.findIndex((x) => x.tool === tool);
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    let to: number | null = null;
    if (e.key === forward || e.key === "ArrowDown") to = (at + 1) % TOOLS.length;
    else if (e.key === back || e.key === "ArrowUp") to = (at - 1 + TOOLS.length) % TOOLS.length;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = TOOLS.length - 1;
    if (to === null) return;
    e.preventDefault();
    onTool(TOOLS[to]!.tool);
    buttons.current[to]?.focus();
  };

  return (
    <div className={styles.bar} role="toolbar" aria-label={t.toolbarLabel} data-tool={tool} data-pen-home="strip">
      <div className={styles.tools} role="radiogroup" aria-label={t.toolbarLabel} onKeyDown={onKeyDown}>
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
            aria-label={nameOf(x)}
            aria-keyshortcuts={letter}
            title={`${nameOf(x)} (${letter})`}
            tabIndex={tool === x ? 0 : -1}
            data-locked={(locked && tool === x) || undefined}
            {...press(x)}
          >
            <ToolIcon tool={x} />
            {locked && tool === x && <LockMark />}
            {/* A span, not a kbd: the header's key legend is the one list of
                keys, and this is a printed reminder on a button. */}
            <span className={styles.letter} dir="ltr" aria-hidden="true">
              {letter}
            </span>
          </button>
        ))}
      </div>
      {/* The pens on the side the highlighter's button is on, the hint on the
          other: at the narrowest window neither side has room for both. */}
      {tool === "highlight" && (
        <div className={styles.start}>
          <PenPicker pen={pen} onPen={onPen} />
        </div>
      )}
      <div className={styles.side} data-end={end ? "" : undefined}>
        {/* For the eye. The change is announced once, by App, through the one
            polite announcer the app has — a second live region here would talk
            over it. */}
        {/* An iPad on its side is wide enough for this bar, and a finger is
            told to tap where a mouse is told to click. */}
        <span className={styles.name}>
          {locked
            ? touch
              ? t.toolLockedHintTouch(nameOf(tool))
              : t.toolLockedHint(nameOf(tool))
            : toolHint(t, tool, touch)}
        </span>
        {end}
      </div>
    </div>
  );
}

/** What to do with the tool that is on, or its name when there is nothing to add. */
export function toolHint(t: ReturnType<typeof useT>["t"], x: PageTool, touch: boolean): string {
  // A finger has no hover, so the harakat tool's magnifier cannot follow it:
  // on a phone a tap takes the sign nearest the finger.
  if (touch && x === "sign") return t.toolSignHintTouch;
  // A finger is told to tap, a mouse to click: the bar said tap at a desk.
  return x === "read"
    ? touch ? t.toolReadHint : t.toolReadHintClick
    : x === "bookmark"
    ? touch ? t.toolBookmarkHint : t.toolBookmarkHintClick
    : x === "note"
      ? touch ? t.toolNoteHint : t.toolNoteHintClick
      : x === "mistake"
        ? touch ? t.toolMistakeHint : t.toolMistakeHintClick
        : x === "sign"
          ? t.toolSignHint
          : x === "word"
            ? touch ? t.toolWordHint : t.toolWordHintClick
            : x === "crop"
              ? t.toolCropHint
              : x === "jump"
                ? t.toolJumpHint
                : t.toolOn(toolName(t, x));
}

/** A tool's spoken name. App says the same name when a tool is switched on. */
export function toolName(t: ReturnType<typeof useT>["t"], x: PageTool): string {
  return x === "read"
    ? t.toolRead
    : x === "select"
    ? t.toolSelect
    : x === "highlight"
      ? t.toolHighlight
      : x === "bookmark"
        ? t.toolBookmark
        : x === "note"
          ? t.toolNote
          : x === "sign"
            ? t.toolSign
            : x === "word"
              ? t.toolWord
              : x === "crop"
                ? t.toolCrop
                : x === "jump"
                  ? t.toolJump
                  : t.toolMistake;
}

export function ToolIcon({ tool }: { tool: PageTool }): JSX.Element {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
    "aria-hidden": true,
  };
  if (tool === "read")
    return (
      <svg {...common}>
        <path d="M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13c-3-.5-6 0-8 1.5zM12 6v13" />
      </svg>
    );
  if (tool === "select")
    return (
      <svg {...common}>
        <path d="M5 3l14 8-6 1.6L10 19z" />
      </svg>
    );
  if (tool === "highlight")
    return (
      <svg {...common}>
        <path d="M14.5 4.5l5 5L10 19H5v-5z" />
        <path d="M4 22h16" />
      </svg>
    );
  if (tool === "mistake")
    return (
      <svg {...common}>
        <path d="M8 15l4-11 4 11M9.5 11h5" />
        <path d="M4 20c1.3-1.3 2.7-1.3 4 0s2.7 1.3 4 0 2.7-1.3 4 0 2.7 1.3 4 0" />
      </svg>
    );
  if (tool === "sign")
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="6" />
        <path d="M14.5 14.5L20 20" />
        <path d="M8 9.5l4-1.5" />
      </svg>
    );
  if (tool === "word")
    return (
      <svg {...common}>
        <path d="M4 7V5h16v2M12 5v14M9 19h6" />
      </svg>
    );
  if (tool === "crop")
    return (
      <svg {...common}>
        <path d="M6 2v16h16M2 6h16v16" />
      </svg>
    );
  if (tool === "jump")
    return (
      <svg {...common}>
        <path d="M3 17c2-3 3.5-3 5 0s3 3 5 0 3-3 5 0" />
        <path d="M16 13.5l3 3.5-4 1" />
        <circle cx="5" cy="7" r="1.6" />
      </svg>
    );
  if (tool === "note")
    return (
      <svg {...common}>
        <path d="M12 21s-6-5.6-6-10.5a6 6 0 0 1 12 0C18 15.4 12 21 12 21z" />
        <circle cx="12" cy="10.5" r="2" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M7 3h10v18l-5-4-5 4z" />
    </svg>
  );
}
