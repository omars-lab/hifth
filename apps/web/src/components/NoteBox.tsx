import { useEffect, useRef, useState } from "react";
import type { Note } from "@hifth/core";
import { useT } from "../i18n";
import styles from "./NoteBox.module.css";

interface NoteBoxProps {
  note: Note;
  /** The verse it is on, as the reader reads it ("Al-Baqarah 5"). */
  label: string;
  /** Closed with Done, Escape or a press outside; carries what was typed. */
  onClose: (text: string) => void;
  onDelete: () => void;
}

/** Room kept between the box and the edge of the window, and above the pin. */
const MARGIN = 12;

/**
 * The small box a note is typed in, standing beside its pin — step 2 of
 * docs/design/page-toolbar-plan.md, after Figma's comment box.
 *
 * Nothing here is saved while typing: the box keeps its own draft and hands it
 * over once, on closing, so a note is one write however long it took to type.
 * Delete asks nothing first; App offers the note back with an Undo line, as the
 * corner unfold does.
 */
export function NoteBox({ note, label, onClose, onDelete }: NoteBoxProps): JSX.Element {
  const { t } = useT();
  const [draft, setDraft] = useState(note.text);
  const boxRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Stand beside the pin: below it when there is room, above it when not, and
  // always inside the window. Measured a frame late, because the pin of a note
  // just made is drawn by the page after this box mounts; and only a pin with a
  // size counts, since a page kept mounted out of sight holds a copy too.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const box = boxRef.current;
      if (!box) return;
      const pin = [...document.querySelectorAll(`[data-note-id="${CSS.escape(note.id)}"]`)]
        .map((el) => el.getBoundingClientRect())
        .find((r) => r.width > 0);
      const w = box.offsetWidth;
      const h = box.offsetHeight;
      const cx = pin ? pin.left + pin.width / 2 : window.innerWidth / 2;
      const below = pin ? pin.bottom + MARGIN : window.innerHeight / 2 - h / 2;
      const top =
        !pin || below + h + MARGIN <= window.innerHeight ? below : Math.max(MARGIN, pin.top - h - MARGIN);
      const left = Math.min(Math.max(MARGIN, cx - w / 2), window.innerWidth - w - MARGIN);
      setAt({ left, top });
    });
    return () => cancelAnimationFrame(frame);
  }, [note.id]);

  // Focus once the box stands where it belongs: until then it is hidden, and a
  // hidden text box cannot take focus.
  const placed = at !== null;
  useEffect(() => {
    if (placed) areaRef.current?.focus();
  }, [placed]);

  // A press anywhere else closes the box and keeps what was typed, as a
  // comment box does. Pressing another pin then opens that one.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) onCloseRef.current(draftRef.current);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, []);

  return (
    <div
      ref={boxRef}
      className={styles.box}
      role="dialog"
      aria-label={t.noteBox(label)}
      data-note-box=""
      style={at ? { left: at.left, top: at.top } : { visibility: "hidden" }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose(draft);
        }
      }}
    >
      <div className={styles.head}>{label}</div>
      <textarea
        ref={areaRef}
        className={styles.text}
        aria-label={t.noteBox(label)}
        value={draft}
        rows={3}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className={styles.actions}>
        <button type="button" className={styles.delete} onClick={onDelete}>
          {t.noteDelete}
        </button>
        <button type="button" className={styles.done} onClick={() => onClose(draft)}>
          {t.noteDone}
        </button>
      </div>
    </div>
  );
}
