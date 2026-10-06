import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RailGlyph } from "./RailGlyph";
import styles from "./VerseMenu.module.css";

/** One line of the small menu: its words, and what it does. */
export interface VerseMenuItem {
  caption: string;
  onPick: () => void;
  /** The icon the line leads with: the one the app shows for the same thing elsewhere. */
  glyph?: string;
}

interface VerseMenuProps {
  /** The verse's name, for the menu's own name ("More for Al-Baqarah · 2:39"). */
  name: string;
  /** Where the held verse is on screen; the menu stands above or below it, never over it. */
  around: DOMRect;
  /**
   * The whole verse, when `around` is only a part of it: a verse's number
   * sits at its end, so a menu above the number stood on the verse's earlier
   * lines. The menu clears this instead, and stays centred on `around`.
   */
  clear?: DOMRect | undefined;
  /**
   * Where the verse is now, asked again each frame until it stops moving: the
   * press that opens the menu can also move the page (closing a phone's note
   * lets the lifted page drop back), and a menu placed where the verse was
   * would be left standing on it.
   */
  follow?: (() => { around: Box; clear?: Box | undefined } | null) | undefined;
  items: readonly VerseMenuItem[];
  onClose: () => void;
  /**
   * One line under another, for a longer menu: a verse number's choices are
   * seven lines, and a row of seven ran across the whole window.
   */
  stacked?: boolean;
}

const GAP = 8;
const EDGE = 8;

export type Box = { left: number; right: number; top: number; bottom: number };

/**
 * Where the menu goes: above the verse when it fits there, below when it fits
 * there, and otherwise on whichever side has more room. Kept inside the window
 * left to right. Given the whole verse as `clear`, it stands above or below
 * all of it, and beside `around` only when the verse is too tall to clear.
 * Exported for its unit test.
 */
export function placeMenu(
  around: Box,
  menu: { width: number; height: number },
  view: { width: number; height: number },
  clear?: Box,
): { left: number; top: number } {
  const centre = (around.left + around.right) / 2 - menu.width / 2;
  const left = Math.min(Math.max(EDGE, centre), view.width - EDGE - menu.width);
  if (clear) {
    const above = clear.top - GAP - menu.height;
    const below = clear.bottom + GAP;
    if (above >= EDGE) return { left, top: above };
    if (below + menu.height <= view.height - EDGE) return { left, top: below };
  }
  const above = around.top - GAP - menu.height;
  const below = around.bottom + GAP;
  const fitsAbove = above >= EDGE;
  const fitsBelow = below + menu.height <= view.height - EDGE;
  const top = fitsAbove
    ? above
    : fitsBelow
      ? below
      : around.top > view.height - around.bottom
        ? Math.max(EDGE, above)
        : Math.min(below, view.height - EDGE - menu.height);
  return { left, top };
}

/**
 * The small menu a hold on a verse opens under option C of
 * docs/design/verse-tap-and-hold.md: the four things the tap's drawer does not
 * offer, beside the verse rather than over it. Escape, a tap anywhere else, or
 * a pick closes it.
 */
export function VerseMenu({ name, around, clear, follow, items, onClose, stacked = false }: VerseMenuProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setAt(
      placeMenu(around, { width: el.offsetWidth, height: el.offsetHeight }, {
        width: window.innerWidth,
        height: window.innerHeight,
      }, clear),
    );
    // Placed again when lines arrive: a taller menu must still clear the verse.
  }, [around, clear, items.length]);

  // Kept beside the verse while the page settles, then left alone.
  useEffect(() => {
    if (!follow) return;
    const start = performance.now();
    let frame = 0;
    let last = "";
    let still = 0;
    const step = () => {
      const el = ref.current;
      const now = follow();
      if (el && now) {
        const b = [now.around, now.clear ?? now.around];
        const seen = b.map((r) => `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`).join(";");
        if (seen === last) still += 1;
        else {
          still = 0;
          last = seen;
          setAt(
            placeMenu(now.around, { width: el.offsetWidth, height: el.offsetHeight }, {
              width: window.innerWidth,
              height: window.innerHeight,
            }, now.clear),
          );
        }
      }
      if (still < 20 && performance.now() - start < 2000) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [follow, items.length]);

  // Focus waits for the menu to be placed: until then it is hidden, and a
  // browser will not focus a hidden button, so the keyboard was left on nothing.
  // It follows the first line too: a menu opened from a verse's number fills in
  // as the verse's note and look-alikes arrive, and the keyboard should start
  // on the line at the top, not on whichever was first a moment before.
  const placed = at !== null;
  const first = items[0]?.caption;
  useEffect(() => {
    if (placed) ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
  }, [placed, first]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    };
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [onClose]);

  // Arrow keys walk the items, as in any menu.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const all = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const i = all.indexOf(document.activeElement as HTMLElement);
    const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    all[(i + step + all.length) % all.length]?.focus();
  };

  return (
    <div
      ref={ref}
      className={styles.menu}
      role="menu"
      aria-label={name}
      style={at ? { left: at.left, top: at.top } : { visibility: "hidden" }}
      onKeyDown={onKeyDown}
      data-verse-menu=""
      data-stacked={stacked ? "" : undefined}
    >
      {items.map((item) => (
        <button
          key={item.caption}
          type="button"
          role="menuitem"
          className={styles.item}
          onClick={() => {
            onClose();
            item.onPick();
          }}
        >
          {item.glyph !== undefined && (
            <span className={styles.glyph} aria-hidden="true" data-glyph="">
              <RailGlyph glyph={item.glyph} />
            </span>
          )}
          <span data-caption="">{item.caption}</span>
        </button>
      ))}
    </div>
  );
}
