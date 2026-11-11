import { useEffect, useRef, type ReactNode } from "react";
import { useT } from "../i18n";
import styles from "./SettingsDrawer.module.css";

/**
 * SettingsDrawer — the reading settings behind one button in the top bar
 * (docs/design/ayah-drawer.md ①, a setting: see `settings-at.ts`).
 *
 * The button sits at the bar's end, where the controls it replaces sat. The
 * drawer drops from under the bar at that end and holds the same controls, so
 * a reader who learned them in the bar finds them in the same order.
 *
 * It is not a dialog: the page stays live under it, and a setting changed in it
 * shows on the page at once. Escape, or the button again, puts it away and
 * hands the keyboard back to the button.
 */
export function SettingsDrawer({
  open,
  onOpen,
  children,
}: {
  open: boolean;
  onOpen: (open: boolean) => void;
  /** The controls, as the bar would have drawn them. */
  children: ReactNode;
}): JSX.Element {
  const { t } = useT();
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      onOpen(false);
      button.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpen]);

  return (
    <div className={styles.at}>
      <button
        ref={button}
        type="button"
        className={styles.open}
        aria-label={t.settingsDrawer}
        aria-expanded={open}
        aria-controls="settings-drawer"
        onClick={() => onOpen(!open)}
      >
        ⚙
      </button>
      {open && (
        <section id="settings-drawer" className={styles.drawer} aria-label={t.settingsDrawer}>
          <h2 className={styles.title}>{t.settingsDrawer}</h2>
          {children}
        </section>
      )}
    </div>
  );
}
