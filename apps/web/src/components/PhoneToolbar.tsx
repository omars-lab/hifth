import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import type { PageTool } from "./PageStage";
import { TOOLS, ToolIcon, toolHint, toolName } from "./PageToolbar";
import styles from "./PhoneToolbar.module.css";

/**
 * The page tools on a phone — step 5 of docs/design/page-toolbar-plan.md, and
 * an open decision of its own (docs/decisions/phone-toolbar.md). A phone has no
 * pointer shapes, no letters to press and little room, so the three layouts the
 * plan named are built, not drawn, and the owner chooses by holding each:
 *
 *   A · a slim row of tools joined under the top bar, always there;
 *   B · one button in the bottom row that fans the tools out, like a pen case;
 *   C · a Tools button in the bottom row that slides the tools up in its place.
 *
 * All three take the desktop bar's own inputs, so whichever wins drops in with
 * nothing else changing, and the two that lose are deleted. Until the choice is
 * made the app shows C; `?phonebar=a` or `?phonebar=b` in the address shows the
 * others, which is how the decision page mounts all three side by side.
 */
export interface PhoneToolbarProps {
  tool: PageTool;
  /** Asked for a tool. Tapping the one already on asks for "select". */
  onTool: (tool: PageTool) => void;
}

export type PhoneBarId = "a" | "b" | "c";

/** Which layout the address asks for; C when it names none. */
export function phoneBarFromUrl(search: string): PhoneBarId {
  const asked = new URLSearchParams(search).get("phonebar")?.toLowerCase();
  return asked === "a" || asked === "b" ? asked : "c";
}

function ToolButtons({ tool, onTool, labelled }: PhoneToolbarProps & { labelled?: boolean }): JSX.Element {
  const { t } = useT();
  return (
    <>
      {TOOLS.map(({ tool: x }) => (
        <button
          key={x}
          type="button"
          role="radio"
          className={styles.tool}
          aria-checked={tool === x}
          aria-label={toolName(t, x)}
          onClick={() => onTool(tool === x && x !== "select" ? "select" : x)}
        >
          <ToolIcon tool={x} />
          {labelled && (
            <span className={styles.label} aria-hidden="true">
              {toolName(t, x)}
            </span>
          )}
        </button>
      ))}
    </>
  );
}

/** A · the slim row under the top bar. One tap switches; it costs a row of the page, always. */
export function PhoneToolbarA({ tool, onTool }: PhoneToolbarProps): JSX.Element {
  const { t } = useT();
  return (
    <div className={styles.strip} role="toolbar" aria-label={t.toolbarLabel} data-phone-bar="a" data-tool={tool}>
      <div className={styles.row} role="radiogroup" aria-label={t.toolbarLabel}>
        <ToolButtons tool={tool} onTool={onTool} />
      </div>
    </div>
  );
}

/**
 * B · the pen case. One button, showing the tool that is on; a tap fans the
 * tools out above it, and picking one closes the fan again.
 */
export function PhoneToolbarB({ tool, onTool }: PhoneToolbarProps): JSX.Element {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);
  return (
    <div ref={boxRef} className={styles.case} data-phone-bar="b" data-tool={tool}>
      <button
        type="button"
        className={styles.caseButton}
        aria-expanded={open}
        aria-label={t.phoneTools(toolName(t, tool))}
        data-on={tool !== "select" || undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <ToolIcon tool={tool} />
      </button>
      {open && (
        <div className={styles.fan} role="radiogroup" aria-label={t.toolbarLabel}>
          <ToolButtons
            tool={tool}
            labelled
            onTool={(x) => {
              onTool(x);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * C · the tray. A Tools button in the bottom row; a tap slides the tools up
 * over that row, where the thumb already is, and they stay up — with what the
 * tool on is for — until the tray is closed. Closing it puts the page back to
 * plain reading.
 */
export function PhoneToolbarC({ tool, onTool }: PhoneToolbarProps): JSX.Element {
  const { t, dir } = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.trayHost} data-phone-bar="c" data-tool={tool}>
      <button
        type="button"
        className={styles.caseButton}
        aria-expanded={open}
        aria-label={t.phoneTools(toolName(t, tool))}
        data-on={tool !== "select" || undefined}
        onClick={() => setOpen(true)}
      >
        <ToolIcon tool={tool} />
      </button>
      {open && (
        // In the chrome's own direction, like the desktop bar: the bottom row
        // it covers is pinned right to left for the mus'haf, the tools are not.
        <div className={styles.tray} role="toolbar" aria-label={t.toolbarLabel} dir={dir}>
          <div className={styles.trayRow}>
            <div className={styles.row} role="radiogroup" aria-label={t.toolbarLabel}>
              <ToolButtons tool={tool} onTool={onTool} />
            </div>
            <button
              type="button"
              className={styles.close}
              aria-label={t.phoneToolsClose}
              onClick={() => {
                setOpen(false);
                onTool("select");
              }}
            >
              ×
            </button>
          </div>
          <span className={styles.trayHint}>{toolHint(t, tool, true)}</span>
        </div>
      )}
    </div>
  );
}
