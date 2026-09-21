import { useT } from "../i18n";
import { qulVerseUrl } from "../qul";
import styles from "./QulTrigger.module.css";

/**
 * QulTrigger — the ↗ in the trail bar that opens the selected verse's page in
 * the Quranic Universal Library (QUL), in a new tab.
 *
 * It renders nothing until a single ayah is selected (a word or a range has no
 * one verse page). It is a plain outbound link, not a button: it copies nothing
 * of QUL's into the app, so the honest element is an anchor the reader — or their
 * browser's own "open in new tab" — can follow, with the arrow saying it leaves
 * the app. See `qul.ts` for the address.
 */
export function QulTrigger({
  selectedKey,
  label,
}: {
  /** The selected ayah key, or null (nothing selected, or a word/range). */
  selectedKey: string | null;
  /** The ayah's own label, for the link's accessible name. */
  label: string | null;
}): JSX.Element | null {
  const { t } = useT();
  if (!selectedKey || !label) return null;
  const href = qulVerseUrl(selectedKey);
  if (!href) return null;

  return (
    <a
      className={styles.trigger}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t.qulVerse(label)}
      title={t.qulVerse(label)}
    >
      <span aria-hidden="true">↗</span>
    </a>
  );
}
