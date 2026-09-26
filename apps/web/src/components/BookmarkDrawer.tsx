import { useEffect, useRef, useState } from "react";
import type { Bookmark } from "@hifth/core";
import { useT } from "../i18n";
import styles from "./BookmarkDrawer.module.css";

interface BookmarkDrawerProps {
  /** The bookmark whose drawer is open, or null for closed. */
  bookmark: Bookmark | null;
  /** Where "move it" would put it, named — or null when a move would change nothing. */
  moveLabel: string | null;
  onRename: (name: string) => void;
  onMoveHere: () => void;
  onLift: () => void;
  onAddAnother: () => void;
  onClose: () => void;
}

/**
 * One ribbon's drawer (docs/decisions/bookmark-fold.md): rename it, move it to
 * the selected ayah or the page on the stage, lift it, drop another beside it,
 * and read its history.
 *
 * A sheet under the thumb like the app's others. Everything a reader can lose is
 * one press away but never zero: lifting is a button of its own, and there is no
 * swipe that does it.
 */
export function BookmarkDrawer({
  bookmark,
  moveLabel,
  onRename,
  onMoveHere,
  onLift,
  onAddAnother,
  onClose,
}: BookmarkDrawerProps): JSX.Element | null {
  const { t } = useT();
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const id = bookmark?.id ?? null;

  // A fresh draft for each bookmark opened, and the name field ready to type
  // into — a new ribbon's first job is to be named.
  useEffect(() => {
    if (!bookmark) return;
    setDraft(bookmark.name);
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [id]); // only on a new bookmark, not on each edit to the one open

  useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, onClose]);

  if (!bookmark) return null;

  const history = [...bookmark.timeline].reverse();

  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="bm-drawer-title">
        <div className={styles.grip} aria-hidden="true" />
        <header className={styles.head}>
          <h2 id="bm-drawer-title" className={styles.title}>
            {t.bmDrawerTitle}
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t.close}>
            ✕
          </button>
        </header>

        <form
          className={styles.nameRow}
          onSubmit={(e) => {
            e.preventDefault();
            onRename(draft);
          }}
        >
          <label className={styles.label} htmlFor="bm-name">
            {t.bmNameLabel}
          </label>
          <input
            id="bm-name"
            ref={inputRef}
            className={styles.input}
            value={draft}
            maxLength={40}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className={styles.action}>
            {t.bmSaveName}
          </button>
        </form>

        <div className={styles.actions}>
          {moveLabel && (
            <button type="button" className={styles.action} onClick={onMoveHere}>
              {t.bmMoveTo(moveLabel)}
            </button>
          )}
          <button type="button" className={styles.action} onClick={onAddAnother}>
            {t.bmAddAnother}
          </button>
          <button type="button" className={styles.action} data-kind="lift" onClick={onLift}>
            {t.bmLift}
          </button>
        </div>

        <h3 className={styles.sub}>{t.bmHistory}</h3>
        <ol className={styles.history}>
          {history.map((e, i) => (
            <li key={`${e.at}-${i}`}>{t.bmEvent(e.what, e.at, e.page)}</li>
          ))}
        </ol>
      </div>
    </>
  );
}
