import { useLayoutEffect, useRef } from "react";
import type { NoteShelfItem } from "./NoteShelf";
import rows from "./NoteShelf.module.css";
import styles from "./VerseNotes.module.css";

/** The card's width once the screen has room for all of it. */
const WIDTH = 360;

interface VerseNotesProps {
  /** "2:39 is in 2 notes". */
  head: string;
  /** The verse's notes, the one used last first. */
  notes: readonly NoteShelfItem[];
  /** Where the dot that opened it is on screen, so the list opens beside it. */
  anchor: { top: number; bottom: number; x: number };
  /** Follow that note from this verse. */
  onFollow: (id: string) => void;
  onClose: () => void;
}

/**
 * The list a tap on a verse's dot opens (docs/decisions/scoped-notes.md, the
 * page question, answer A): the notes that verse is in, each a tap from being
 * followed from this verse. It opens under the dot's line, or over it when
 * there is no room below, so it never covers the verse it is about; on a wide
 * screen it also stands beside the dot rather than across both pages. Escape or
 * a tap anywhere else closes it.
 */
export function VerseNotes({ head, notes, anchor, onFollow, onClose }: VerseNotesProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  // Listening starts in the same step the list is drawn, not a frame later: its
  // code arrives on first open, so no tap hurries the after-drawing work, and an
  // Escape pressed as it appears would otherwise fall on the page behind it.
  useLayoutEffect(() => {
    ref.current?.querySelector("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    };
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [onClose]);
  const below = anchor.bottom + 8 < window.innerHeight * 0.55;
  // Wide enough to leave the card its full width: centre it on the dot, kept on screen.
  const wide = window.innerWidth >= WIDTH + 48;
  const left = Math.min(Math.max(anchor.x - WIDTH / 2, 12), window.innerWidth - WIDTH - 12);
  return (
    <div
      ref={ref}
      className={styles.list}
      role="dialog"
      aria-label={head}
      style={{
        ...(below ? { top: anchor.bottom + 8 } : { bottom: window.innerHeight - anchor.top + 8 }),
        ...(wide ? { left, right: "auto", width: WIDTH, marginInline: 0 } : {}),
      }}
    >
      <h3 className={styles.head}>{head}</h3>
      <ul className={rows.list}>
        {notes.map((n) => (
          <li key={n.id}>
            <button type="button" className={rows.item} onClick={() => onFollow(n.id)}>
              <span className={rows.title}>{n.title}</span>
              <span className={rows.about}>{n.about}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
