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
};

const TOOLS: ReadonlyArray<{ tool: PageTool; letter: string }> = [
  { tool: "select", letter: "V" },
  { tool: "highlight", letter: "H" },
  { tool: "bookmark", letter: "B" },
  { tool: "note", letter: "N" },
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
 * step 2's note, which pins the reader's words to a word on the page.
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
      <span className={styles.name}>
        {tool === "bookmark" ? t.toolBookmarkHint : tool === "note" ? t.toolNoteHint : t.toolOn(nameOf(tool))}
      </span>
    </div>
  );
}

/** A tool's spoken name. App says the same name when a tool is switched on. */
export function toolName(t: ReturnType<typeof useT>["t"], x: PageTool): string {
  return x === "select"
    ? t.toolSelect
    : x === "highlight"
      ? t.toolHighlight
      : x === "bookmark"
        ? t.toolBookmark
        : t.toolNote;
}

function ToolIcon({ tool }: { tool: PageTool }): JSX.Element {
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
