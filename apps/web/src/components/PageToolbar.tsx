import { useRef } from "react";
import { useT } from "../i18n";
import type { PageTool } from "./PageStage";
import styles from "./PageToolbar.module.css";

/**
 * The key for each tool, by its place on the keyboard rather than the letter it
 * prints, so V still picks Select on an Arabic keyboard where that key types
 * «ر» (docs/design/page-toolbar-plan.md, "Keyboard shortcuts on single letters
 * have rules").
 */
export const TOOL_KEYS: Readonly<Record<string, PageTool>> = {
  KeyV: "select",
  KeyH: "highlight",
  KeyB: "bookmark",
  KeyN: "note",
  KeyK: "sign",
  KeyW: "word",
  KeyM: "mistake",
  KeyC: "crop",
};

/** The tools in the order every bar shows them, desktop and phone alike. */
export const TOOLS: ReadonlyArray<{ tool: PageTool; letter: string }> = [
  { tool: "select", letter: "V" },
  { tool: "highlight", letter: "H" },
  { tool: "bookmark", letter: "B" },
  { tool: "note", letter: "N" },
  { tool: "sign", letter: "K" },
  { tool: "word", letter: "W" },
  { tool: "mistake", letter: "M" },
  { tool: "crop", letter: "C" },
];

interface PageToolbarProps {
  tool: PageTool;
  /** Asked for a tool. Clicking the one already on asks for "select". */
  onTool: (tool: PageTool) => void;
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
export function PageToolbar({ tool, onTool }: PageToolbarProps): JSX.Element {
  const { t } = useT();
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
    <div className={styles.bar} role="toolbar" aria-label={t.toolbarLabel} data-tool={tool}>
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
            onClick={() => onTool(tool === x && x !== "select" ? "select" : x)}
          >
            <ToolIcon tool={x} />
            {/* A span, not a kbd: the header's key legend is the one list of
                keys, and this is a printed reminder on a button. */}
            <span className={styles.letter} dir="ltr" aria-hidden="true">
              {letter}
            </span>
          </button>
        ))}
      </div>
      {/* For the eye. The change is announced once, by App, through the one
          polite announcer the app has — a second live region here would talk
          over it. */}
      <span className={styles.name}>{toolHint(t, tool)}</span>
    </div>
  );
}

/** What to do with the tool that is on, or its name when there is nothing to add. */
export function toolHint(t: ReturnType<typeof useT>["t"], x: PageTool, touch = false): string {
  // A finger has no hover, so the harakat tool's magnifier cannot follow it:
  // on a phone a tap takes the sign nearest the finger.
  if (touch && x === "sign") return t.toolSignHintTouch;
  return x === "bookmark"
    ? t.toolBookmarkHint
    : x === "note"
      ? t.toolNoteHint
      : x === "mistake"
        ? t.toolMistakeHint
        : x === "sign"
          ? t.toolSignHint
          : x === "word"
            ? t.toolWordHint
            : x === "crop"
              ? t.toolCropHint
              : t.toolOn(toolName(t, x));
}

/** A tool's spoken name. App says the same name when a tool is switched on. */
export function toolName(t: ReturnType<typeof useT>["t"], x: PageTool): string {
  return x === "select"
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
