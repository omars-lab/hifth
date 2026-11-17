import { useT } from "../i18n";
import styles from "./BarControls.module.css";

/*
 * The two controls "the new layout" (new-layout.ts) adds to the page bar. The
 * rest of what moves there (one page or two, the size buttons) is DesktopChrome,
 * reused rather than copied.
 */

/**
 * Where the reader is, said on the bar, and the way to go somewhere else: the
 * label is the Go to button. The surah's name is the first thing to leave when
 * the bar is short of room (the CSS beside this file).
 */
export function BarGoTo({
  page,
  context,
  onOpen,
}: {
  page: number;
  context: { surah: number; running: number } | null;
  onOpen: () => void;
}): JSX.Element {
  const { t } = useT();
  return (
    <button
      type="button"
      className={styles.goTo}
      data-bar-goto=""
      aria-label={t.goToLong}
      aria-haspopup="dialog"
      title={t.goToLong}
      onClick={onOpen}
      dir="auto"
    >
      <span>
        {t.pageWord} <span className="numeric">{t.num(page)}</span>
      </span>
      {context !== null && (
        <>
          <span className={styles.juz}>
            {t.sep}
            {t.juzN(context.running)}
          </span>
          <span className={styles.surah}>
            {t.sep}
            {t.surahName(context.surah)}
          </span>
        </>
      )}
    </button>
  );
}

/** Full screen, entered from the bar. The way back is in the tool row and on F. */
export function BarFullScreen({ onToggle }: { onToggle: () => void }): JSX.Element {
  const { t } = useT();
  return (
    <button
      type="button"
      className={styles.full}
      data-bar-full=""
      aria-label={t.fullScreen}
      aria-keyshortcuts="F"
      title={`${t.fullScreen} (F)`}
      onClick={onToggle}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1.5 5.5v-4h4M10.5 1.5h4v4M14.5 10.5v4h-4M5.5 14.5h-4v-4" />
      </svg>
    </button>
  );
}
