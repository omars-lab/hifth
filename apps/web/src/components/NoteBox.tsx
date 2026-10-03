import { useEffect, useRef, useState } from "react";
import type { Note } from "@hifth/core";
import { useT } from "../i18n";
import styles from "./NoteBox.module.css";

interface NoteBoxProps {
  /** Only its id and words: a note about a juz or a surah has no verse to sit by. */
  note: Pick<Note, "id" | "text">;
  /** The verse it is on, as the reader reads it ("Al-Baqarah 5"). */
  label: string;
  /** Closed with Done, Escape or a press outside; carries what was typed. */
  onClose: (text: string) => void;
  onDelete: () => void;
  /** The head line, when it says more than the verse: the note's scope and size. */
  head?: string | undefined;
  /** What Delete says, when it does less than delete the note: take one verse out of it. */
  deleteLabel?: string | undefined;
  /**
   * The notes a pin just made could join instead of being a note of its own
   * (docs/decisions/scoped-notes.md, option C), the likeliest first and the
   * rest behind "More notes". Shown only until something is typed, so a tap
   * can never throw words away.
   */
  choices?: {
    readonly offered: readonly NoteChoice[];
    readonly more: readonly NoteChoice[];
  } | null;
  onJoin?: (id: string) => void;
  /** Set once the verse has just joined this note: what to say, and the way back. */
  joined?: { readonly said: string; readonly onUndo: () => void } | null;
  /**
   * What the note is about, and the parts it could be about instead, narrowest
   * first (docs/design/scoped-notes.md, step 7). Its name in the head line is
   * the way to change it.
   */
  about?: NoteAbout | null;
}

export interface NoteAbout {
  /** The part it is about now, as the reader reads it: "Page 7", "Juz 1". */
  readonly name: string;
  /** How many verses it holds; past one, the head line counts them instead of naming the verse. */
  readonly count: number;
  readonly options: readonly { readonly id: string; readonly name: string }[];
  readonly current: string;
  /** Null once the note is about that part; otherwise what to say about the verses that would fall out. */
  readonly onPick: (id: string) => string | null;
}

export interface NoteChoice {
  readonly id: string;
  readonly title: string;
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
export function NoteBox({
  note,
  label,
  onClose,
  onDelete,
  head,
  deleteLabel,
  choices,
  onJoin,
  joined,
  about,
}: NoteBoxProps): JSX.Element {
  const { t } = useT();
  const [draft, setDraft] = useState(note.text);
  const [showMore, setShowMore] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [aboutSaid, setAboutSaid] = useState<string | null>(null);
  const offer = choices && draft.trim() === "" ? [...choices.offered, ...(showMore ? choices.more : [])] : [];
  const boxRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const aboutRef = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Stand beside the pin: below it when there is room, above it when not, and
  // always inside the window, whose bottom is the top of the bars there (a
  // phone's tools tray stays up while a tool is on). Measured a frame late, because the pin of a note
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
      const floor = Math.min(
        window.innerHeight,
        ...[...document.querySelectorAll("[data-keep-clear]")]
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.height > 0)
          .map((r) => r.top),
      );
      const below = pin ? pin.bottom + MARGIN : floor / 2 - h / 2;
      const top = !pin || below + h + MARGIN <= floor ? below : Math.max(MARGIN, pin.top - h - MARGIN);
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
      <div className={styles.head}>
        {about ? (
          <>
            {about.count > 1 ? null : <>{label} · </>}
            <button
              type="button"
              ref={aboutRef}
              className={styles.about}
              aria-expanded={aboutOpen}
              aria-label={t.noteAboutChange(about.name)}
              onClick={() => {
                setAboutOpen((o) => !o);
                setAboutSaid(null);
              }}
            >
              {about.name}
            </button>
            {about.count > 1 ? <> · {t.noteVerses(about.count)}</> : null}
          </>
        ) : (
          (head ?? label)
        )}
      </div>
      {about && aboutOpen && (
        <div className={styles.choices} role="group" aria-label={t.noteAboutAsk}>
          <div className={styles.choicesHead} aria-hidden="true">
            {t.noteAboutAsk}
          </div>
          <div className={styles.pills}>
            {about.options.map((o) => (
              <button
                key={o.id}
                type="button"
                className={styles.pill}
                aria-pressed={o.id === about.current}
                onClick={() => {
                  const said = about.onPick(o.id);
                  setAboutSaid(said);
                  if (said !== null) return;
                  // The picked button goes with the list; focus stays in the
                  // box, so Escape still closes it.
                  setAboutOpen(false);
                  aboutRef.current?.focus();
                }}
              >
                {o.name}
              </button>
            ))}
          </div>
          {aboutSaid && (
            <div className={styles.outside} role="status">
              {aboutSaid}
            </div>
          )}
        </div>
      )}
      <textarea
        ref={areaRef}
        className={styles.text}
        aria-label={t.noteBox(label)}
        value={draft}
        rows={3}
        onChange={(e) => setDraft(e.target.value)}
      />
      {joined && (
        <div className={styles.joined}>
          <span>{joined.said}</span>
          <button type="button" className={styles.undo} onClick={joined.onUndo}>
            {t.bmUndo}
          </button>
        </div>
      )}
      {offer.length > 0 && (
        <div className={styles.choices} role="group" aria-label={t.noteAddTo}>
          <div className={styles.choicesHead} aria-hidden="true">
            {t.noteAddTo}
          </div>
          <div className={styles.pills}>
            {offer.map((c) => (
              <button key={c.id} type="button" className={styles.pill} title={c.title} onClick={() => onJoin?.(c.id)}>
                {c.title}
              </button>
            ))}
            {choices!.more.length > 0 && !showMore && (
              <button type="button" className={styles.more} aria-expanded={false} onClick={() => setShowMore(true)}>
                {t.noteMore}
              </button>
            )}
          </div>
        </div>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.delete} onClick={onDelete}>
          {deleteLabel ?? t.noteDelete}
        </button>
        <button type="button" className={styles.done} onClick={() => onClose(draft)}>
          {t.noteDone}
        </button>
      </div>
    </div>
  );
}
