import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./VerseMenu.module.css";

/** One line of the small menu: its words, and what it does. */
export interface VerseMenuItem {
  caption: string;
  onPick: () => void;
}

interface VerseMenuProps {
  /** The verse's name, for the menu's own name ("More for Al-Baqarah · 2:39"). */
  name: string;
  /** Where the held verse is on screen; the menu stands above or below it, never over it. */
  around: DOMRect;
  items: readonly VerseMenuItem[];
  onClose: () => void;
}

const GAP = 8;
const EDGE = 8;

/**
 * Where the menu goes: above the verse when it fits there, below when it fits
 * there, and otherwise on whichever side has more room. Kept inside the window
 * left to right. Exported for its unit test.
 */
export function placeMenu(
  around: { left: number; right: number; top: number; bottom: number },
  menu: { width: number; height: number },
  view: { width: number; height: number },
): { left: number; top: number } {
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
  const centre = (around.left + around.right) / 2 - menu.width / 2;
  const left = Math.min(Math.max(EDGE, centre), view.width - EDGE - menu.width);
  return { left, top };
}

/**
 * The small menu a hold on a verse opens under option C of
 * docs/design/verse-tap-and-hold.md: the four things the tap's drawer does not
 * offer, beside the verse rather than over it. Escape, a tap anywhere else, or
 * a pick closes it.
 */
export function VerseMenu({ name, around, items, onClose }: VerseMenuProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setAt(
      placeMenu(around, { width: el.offsetWidth, height: el.offsetHeight }, {
        width: window.innerWidth,
        height: window.innerHeight,
      }),
    );
  }, [around]);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
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
          {item.caption}
        </button>
      ))}
    </div>
  );
}
