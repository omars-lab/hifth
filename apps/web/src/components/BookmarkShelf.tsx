import { useEffect, useRef, useState } from "react";
import { groupBySurah, type Bookmark } from "@hifth/core";
import { useT } from "../i18n";
import styles from "./BookmarkShelf.module.css";

interface BookmarkShelfProps {
  bookmarks: readonly Bookmark[];
  /** Go to a bookmark's page, and note in its history that it was opened. */
  onOpen: (id: string) => void;
  onClearSurah: (surah: number) => void;
  onClearAll: () => void;
  /** Hand the reader a file of every bookmark they hold. */
  onSave: () => void;
  /** Read a chosen file; the caller says what came of it. */
  onLoad: (text: string) => void;
}

/** What is waiting on a yes: every bookmark, or one surah's. */
type Pending = { kind: "all" } | { kind: "surah"; surah: number; n: number } | null;

/**
 * The page map's bookmark section (docs/decisions/bookmark-admin.md): every
 * bookmark the reader holds, grouped by surah in mus'haf order, with a clear for
 * each surah and one for everything — and both of those ask first, in the page,
 * naming how many will go. Saving to a file and loading one back live here too,
 * beside the list they act on.
 *
 * The question is asked inline rather than in a browser dialog: a browser's own
 * confirm box blocks the whole page, cannot be styled or translated with the
 * rest of the app, and a reader on a phone cannot tell it from a site warning.
 */
export function BookmarkShelf({
  bookmarks,
  onOpen,
  onClearSurah,
  onClearAll,
  onSave,
  onLoad,
}: BookmarkShelfProps): JSX.Element {
  const { t } = useT();
  const [pending, setPending] = useState<Pending>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const groups = groupBySurah(bookmarks);

  // The safe answer takes the focus, so a second press of Enter does not clear.
  useEffect(() => {
    if (pending) cancelRef.current?.focus();
  }, [pending]);

  const confirm = pending && (
    <div className={styles.confirm} role="alertdialog" aria-labelledby="bm-confirm-q">
      <p id="bm-confirm-q" className={styles.question}>
        {pending.kind === "all" ? t.bmConfirmAll(bookmarks.length) : t.bmConfirmSurah(pending.n, pending.surah)}
      </p>
      <div className={styles.confirmRow}>
        <button ref={cancelRef} type="button" className={styles.button} onClick={() => setPending(null)}>
          {t.bmCancel}
        </button>
        <button
          type="button"
          className={styles.button}
          data-kind="danger"
          onClick={() => {
            if (pending.kind === "all") onClearAll();
            else onClearSurah(pending.surah);
            setPending(null);
          }}
        >
          {t.bmClear}
        </button>
      </div>
    </div>
  );

  return (
    <section className={styles.shelf} aria-labelledby="bm-shelf-head">
      <h3 id="bm-shelf-head" className={styles.head}>
        {t.bmHead}
      </h3>
      <p className={styles.count}>{t.bmCount(bookmarks.length)}</p>

      {groups.map((g) => (
        <div key={g.surah} className={styles.group}>
          <div className={styles.groupHead}>
            <span className={styles.groupName}>{t.bmGroup(g.surah, g.bookmarks.length)}</span>
            <button
              type="button"
              className={styles.button}
              aria-label={t.bmClearSurahAria(g.surah)}
              onClick={() => setPending({ kind: "surah", surah: g.surah, n: g.bookmarks.length })}
            >
              {t.bmClear}
            </button>
          </div>
          {pending?.kind === "surah" && pending.surah === g.surah && confirm}
          <ul className={styles.list}>
            {g.bookmarks.map((b) => (
              <li key={b.id}>
                <button type="button" className={styles.item} onClick={() => onOpen(b.id)}>
                  {t.bmOpen(b.name, b.page)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className={styles.footRow}>
        {bookmarks.length > 0 && (
          <button type="button" className={styles.button} data-kind="danger" onClick={() => setPending({ kind: "all" })}>
            {t.bmClearAll}
          </button>
        )}
        {bookmarks.length > 0 && (
          <button type="button" className={styles.button} onClick={onSave}>
            {t.bmSave}
          </button>
        )}
        <button type="button" className={styles.button} onClick={() => fileRef.current?.click()}>
          {t.bmLoad}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          data-testid="bm-load-file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void file.text().then(onLoad);
          }}
        />
      </div>
      {pending?.kind === "all" && confirm}
    </section>
  );
}
