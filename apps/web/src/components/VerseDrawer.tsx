import { useEffect, type ReactNode } from "react";
import { useT } from "../i18n";
import styles from "./VerseDrawer.module.css";

/**
 * VerseDrawer — the verse's tools in one place (decision selection-drawer = D).
 *
 * In Verse mode a tap lights the verse and this drawer rises from the bottom
 * with everything a reader can do with that verse, each named in a word:
 * listen, the commentary, the words that share its roots, share, bookmark, and
 * the verse on QUL. Before it, those were loose glyphs strung along the bar
 * under the page, and on a phone they ran off its edge.
 *
 * It is not a dialog. The page stays live beneath it, so a tap on another verse
 * moves the light and the drawer follows; nothing is trapped. It rises over the
 * bar and the page slider, never over the page, so it cannot cover the verse it
 * is about — the cost the drawn options page found in a panel that sat on the
 * leaf. Escape, or its ×, puts it away and leaves the verse lit.
 */
export function VerseDrawer({
  label,
  open,
  onClose,
  children,
}: {
  /** The verse's own name, "Al-Baqarah 2:48"; null when no verse is lit. */
  label: string | null;
  open: boolean;
  onClose: () => void;
  /** The tool buttons, each with its caption. */
  children: ReactNode;
}): JSX.Element | null {
  const { t } = useT();
  const shown = open && label !== null;

  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      // A sheet opened from the drawer answers its own Escape first.
      if (document.querySelector('[role="dialog"]')) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, onClose]);

  if (!shown) return null;
  return (
    <section className={styles.drawer} aria-label={t.verseTools(label)}>
      <header className={styles.head}>
        <span className={styles.title}>{label}</span>
        <button type="button" className={styles.close} aria-label={t.close} onClick={onClose}>
          <span aria-hidden="true">×</span>
        </button>
      </header>
      <div className={styles.tools}>{children}</div>
    </section>
  );
}

/** A plain tool of the drawer's own, in the same shape as the others. */
export function DrawerTool({
  glyph,
  caption,
  label,
  onClick,
}: {
  glyph: string;
  caption: string;
  label: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button type="button" aria-label={label} onClick={onClick}>
      <span aria-hidden="true">{glyph}</span>
      <span data-caption="">{caption}</span>
    </button>
  );
}
