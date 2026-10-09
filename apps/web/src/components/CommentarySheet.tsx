import { forwardRef, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  formatAyahKey,
  orderForHifz,
  parseAyahKey,
  type Edge,
  type LeafSide,
} from "@hifth/core";
import { useT } from "../i18n";
import type { Commentator } from "../pitch/pitch";
import { splitCitations, type Citation } from "../tafsir/citations";
import { splitSigla, type Siglum } from "../tafsir/sigla";
import { isIntroOnly, textDir, type CommentaryNote } from "../tafsir/commentary";
import styles from "./CommentarySheet.module.css";
import { leafStyle, useOverLeaf } from "./over-leaf";
import { watchCover } from "./short-band";

export { overLeaf } from "./over-leaf";

/**
 * The ✎ trigger — the one door to a verse's commentary, whichever source it
 * comes from. It renders nothing when the verse has no note, exactly like the ⬡
 * root trigger, so a tap always lands on something.
 */
export function CommentaryTrigger({
  has,
  open,
  onToggle,
  caption,
  source,
}: {
  has: boolean;
  open: boolean;
  onToggle: () => void;
  /** Whose commentary it is, for the button's spoken name. */
  source: string;
  /** A word under the glyph, shown when the button sits in the verse drawer. */
  caption?: string;
}): JSX.Element | null {
  const { t } = useT();
  if (!has) return null;
  return (
    <button
      type="button"
      className={styles.trigger}
      aria-expanded={open}
      aria-label={t.commentaryBy(source)}
      onClick={onToggle}
    >
      <span aria-hidden="true">✎</span>
      {caption && <span data-caption="">{caption}</span>}
    </button>
  );
}

/** How much of a phone's height the note opens at — `38vh` in the stylesheet. */
const SHORT_SHARE = 0.38;

const NO_KEY: ReadonlyMap<string, Commentator> = new Map();

/** Focusable descendants of `root`, in tab order (excludes disabled + hidden). */
function focusables(root: HTMLElement): HTMLElement[] {
  const sel =
    'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll<HTMLElement>(sel));
}

/**
 * CommentarySheet — the one commentary drawer. It draws a `CommentaryNote` and
 * never learns which source the note came from, only whose words they are: The
 * Study Quran held for the pitch, a live public service, a book a reader loaded
 * (decision `tafsir-provider`).
 *
 * Same bottom-sheet contract as HopPopover / RootLens (a real modal dialog:
 * focus in on open, Tab trapped, Escape closes, focus restored), but its body is
 * built for *reading*, not for a list of hops: a comfortable measure, the
 * editors' translation set large, then the commentary prose. Opened from the ⓘ
 * beside a surah's name it holds that surah's introduction alone; a link's
 * `?open=context` leads a verse's note with it.
 *
 * No source's words live in these bytes — only in the note this renders.
 */
// The private-use pair the extractor wraps around a run the book sets in
// italics; the extractor has the same pair.
const SLANT = /([\uE000\uE001])/;

/**
 * Keep the punctuation that touches a link or an initial on its line, as it
 * would stay with a word: a button is one box in the line, so the line could
 * otherwise break between "(" and the verse it opens, stranding the bracket.
 * Then draw the words the book sets in italics, which may run up to a link.
 */
function together(parts: ReactNode[]): ReactNode[] {
  type Glued = { lead: string; part: ReactNode; trail: string; key: string };
  const out: (string | Glued)[] = [];
  for (let j = 0; j < parts.length; j++) {
    const part = parts[j];
    if (typeof part === "string") {
      out.push(part);
      continue;
    }
    const prev = out[out.length - 1];
    const lead = typeof prev === "string" ? /\S*$/.exec(prev)![0] : "";
    if (lead) out[out.length - 1] = (prev as string).slice(0, -lead.length);
    const next = parts[j + 1];
    const trail = typeof next === "string" ? /^\S*/.exec(next)![0] : "";
    if (trail) parts[j + 1] = (next as string).slice(trail.length);
    out.push({ lead, part, trail, key: `w${j}` });
  }
  // A run opens in one piece of text and closes in the same or a later one.
  let open = false;
  let n = 0;
  const words = (text: string): ReactNode[] =>
    text.split(SLANT).flatMap((piece): ReactNode[] => {
      if (piece === "\uE000" || piece === "\uE001") {
        open = piece === "\uE000";
        return [];
      }
      if (!piece) return [];
      return [open ? <em key={`i${n++}`}>{piece}</em> : piece];
    });
  return out.flatMap((item): ReactNode[] => {
    if (typeof item === "string") return words(item);
    if (!item.lead && !item.trail) return [item.part];
    return [
      <span key={item.key} className={styles.together}>
        {words(item.lead)}
        {item.part}
        {words(item.trail)}
      </span>,
    ];
  });
}

export function CommentarySheet({
  entry,
  onClose,
  side = null,
  roads = [],
  canHop,
  onHop,
  onGo,
  onCover,
  onTall,
  back = null,
  creditNote,
  sigla = NO_KEY,
}: {
  entry: CommentaryNote | null;
  onClose: () => void;
  side?: LeafSide | null;
  /**
   * The verses this one connects to — the source's own cross-references,
   * merged into the app's adjacency and handed straight back here. Tapping one
   * jumps there (and, in the pitch build, opens that verse's note in turn), so
   * the reading and the roads live on one surface instead of the note burying a
   * rail behind it. Empty when the verse leads nowhere the app can reach.
   */
  roads?: readonly Edge[];
  /** Whether a target's page is vendored (unreachable targets are shown, disabled). */
  canHop?: (toKey: string) => boolean;
  /** Jump to a related verse — the same hop the rail uses, so it leaves a trail. */
  onHop?: (edge: Edge) => void;
  /**
   * Go to a verse the commentary cites in its prose ("see 5:15–16") — the
   * book's own roads, inline, taking the same hop as the cards below.
   */
  onGo?: (key: string) => void;
  /**
   * Where the short phone note starts, in window px, or null when it is closed
   * or standing beside the verse — so the page can move the verse up above it.
   * Stays at the short height while the note is grown: the page underneath is
   * covered then anyway, and moving it would only be motion nobody sees.
   */
  onCover?: (top: number | null) => void;
  /**
   * Whether the phone note is grown to its full height, a modal over the whole
   * page. The look-alike chips ride the short note's top row, and a grown note
   * is all the reader is looking at, so they step back under it.
   */
  onTall?: (tall: boolean) => void;
  /**
   * The verse the reader came from, when they arrived by following a road — the
   * last bead on the trail. On a phone the note covers the trail bar, so without
   * this the only way back was to close the note first. Null where the reading
   * started.
   */
  back?: { label: string; onBack: () => void } | null;
  /** A line under the credit about where this is shown (the pitch says it is private). */
  creditNote?: string | undefined;
  /**
   * The source's key to the initials its notes cite commentators by. Each
   * initial in a bracket that the key has becomes a button saying who it is:
   * the book prints its key once, at the front, where a reader in the app
   * never is. Empty, and the initials stay plain text.
   */
  sigla?: ReadonlyMap<string, Commentator>;
}): JSX.Element | null {
  const { t, dir } = useT();
  const sheetRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cardId = useId();
  // The lines of the key that are open: every initial in the bracket that was
  // tapped, which one of them was tapped (`sig`), and its button (`at`).
  const [keyOpen, setKeyOpen] = useState<{ at: string; sig: string; sigs: readonly string[] } | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const open = entry !== null;
  // On a spread the note stands on the facing leaf, beside the verse, not over
  // it: no veil dims the page, and a tap on the next verse turns the note to it.
  // A phone has no facing leaf, so there it stays a sheet over the page.
  const beside = side !== null;
  // A phone opens the note short, on the lower part of the screen, so the verse
  // it is about stays in sight above it and nothing dims the page. Reading on —
  // a scroll inside the note, or a tap on its handle — grows it to the full
  // height, and only then does it cover the page like a sheet.
  const [tall, setTall] = useState(false);
  const verseKey = entry?.ayahKey ?? null;
  useEffect(() => setTall(false), [verseKey]);
  useEffect(() => setKeyOpen(null), [verseKey]);

  // The card stands under the initials it explains, inside the note's edges,
  // and above them when there is no room left below in the visible note. It is
  // placed before it is painted, so it never shows anywhere else first.
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    const card = cardRef.current;
    const at = keyOpen && sheet?.querySelector<HTMLElement>(`[data-siglum="${keyOpen.at}"]`);
    if (!sheet || !card || !at) return;
    const box = sheet.getBoundingClientRect();
    const word = at.getBoundingClientRect();
    const gap = 6;
    const below = word.bottom + gap + card.offsetHeight <= box.bottom;
    const above = word.top - gap - card.offsetHeight >= box.top;
    const top = !below && above ? word.top - gap - card.offsetHeight : word.bottom + gap;
    card.style.top = `${top - box.top - sheet.clientTop + sheet.scrollTop}px`;
    const left = word.left - box.left - sheet.clientLeft;
    card.style.left = `${Math.max(gap, Math.min(left, sheet.clientWidth - card.offsetWidth - gap))}px`;
  }, [keyOpen]);

  // A press anywhere but the card, or another initial, puts the card away.
  useEffect(() => {
    if (!keyOpen) return;
    const away = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (el?.closest(`.${styles.keyCard}, [data-siglum]`)) return;
      setKeyOpen(null);
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [keyOpen]);
  // Reading starts at the top of each note. A related verse is followed from
  // the foot of a note, and the same panel turning to the new verse kept the
  // old one's scroll, so the reader landed mid-way down a note not yet begun.
  useLayoutEffect(() => {
    if (sheetRef.current) sheetRef.current.scrollTop = 0;
  }, [verseKey]);
  const modal = !beside && tall;
  const grown = open && modal;
  useEffect(() => onTall?.(grown), [grown, onTall]);
  useEffect(() => () => onTall?.(false), [onTall]);

  useLayoutEffect(() => {
    if (!onCover) return;
    const sheet = sheetRef.current;
    if (!open || beside || !sheet) {
      onCover(null);
      return;
    }
    // The short height is worked out, not read off the box: the box may still be
    // easing down from the previous verse's grown note.
    return watchCover(sheet, () => Math.min(sheet.scrollHeight, window.innerHeight * SHORT_SHARE), onCover);
  }, [open, beside, verseKey, onCover]);
  useEffect(() => () => onCover?.(null), [onCover]);

  // Beside a spread, lie over the facing page.
  const place = useOverLeaf(open, side);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    restoreRef.current = opener;
    const sheet = sheetRef.current;
    // Opened by a link, nothing was pressed: focus the note itself, so a screen
    // reader still lands in it but no ring appears round a button nobody reached
    // for. Otherwise the close button, as it always was — not the phone's
    // handle, which comes first in the note but is not where a reader starts.
    const byLink = !opener || opener === document.body;
    if (sheet) (byLink ? sheet : sheet.querySelector<HTMLElement>(`.${styles.close}`) ?? focusables(sheet)[0] ?? sheet).focus();
    // Reading always starts at the top, even when the same sheet re-opens on a
    // different verse.
    if (sheet) sheet.scrollTop = 0;
    return () => {
      restoreRef.current?.focus?.();
    };
  }, [open]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        // An open line of the key goes first, and the note stays.
        if (keyOpen) {
          sheetRef.current?.querySelector<HTMLElement>(`[data-siglum="${keyOpen.at}"]`)?.focus();
          setKeyOpen(null);
          return;
        }
        onClose();
        return;
      }
      if (e.key !== "Tab" || !modal) return;
      const sheet = sheetRef.current;
      if (!sheet) return;
      const items = focusables(sheet);
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose, modal, keyOpen],
  );

  if (!entry) return null;
  const introOnly = isIntroOnly(entry);
  const opening = parseAyahKey(entry.ayahKey);
  const label =
    introOnly && opening
      ? `${t.surahName(opening.surah)}${t.sep}${t.surahIntro}`
      : (t.ayahLabel(entry.ayahKey) ?? entry.ayahKey);
  // A citation in the prose names only surah:verse; it is in this note's edition.
  const edition = opening?.edition;
  const citedKey = (surah: number, ayah: number): string | null =>
    edition ? formatAyahKey(edition, surah, ayah) : null;
  // A paragraph of the source's prose, with the verses it cites as links and the
  // initials its key explains as buttons, in the introduction as in the note.
  // A "v. 5" is a verse of this note's surah. `at` names the paragraph, so each
  // initial's button is told apart from the same initials elsewhere. A note that
  // names its own verse (`self`) draws it as words: the reader is already there.
  // A bracket names commentators who agree, so any initial in it opens the key
  // for all of them: on a phone, a finger cannot tell a letter from the next.
  const prose = (para: string, at: string, self?: string): ReactNode[] => {
    const split = splitSigla(para, sigla);
    const bracket = new Map<number, string[]>();
    for (const part of split) {
      if (typeof part !== "string") bracket.set(part.bracket, [...(bracket.get(part.bracket) ?? []), part.sig]);
    }
    return together(split
      .flatMap((part): (string | Citation | Siglum)[] =>
        typeof part === "string" ? splitCitations(part, opening?.surah) : [part],
      )
      .map((part, j) => {
        if (typeof part === "string") return part;
        if ("sig" in part) {
          const here = `${at}-${j}`;
          const sigs = bracket.get(part.bracket)!;
          return (
            <button
              key={j}
              type="button"
              className={styles.siglum}
              data-siglum={here}
              data-siglum-group={`${at}-${part.bracket}`}
              aria-expanded={keyOpen?.at === here}
              aria-controls={cardId}
              onClick={() => setKeyOpen((o) => (o?.at === here ? null : { at: here, sig: part.sig, sigs }))}
            >
              {part.text}
            </button>
          );
        }
        const key = citedKey(part.surah, part.ayah);
        if (!key) return part.text;
        // The note's own verse is words, not a link, but still one piece: a
        // line must not break between "v." and its number.
        if (key === self) return <span key={j} className={styles.together}>{part.text}</span>;
        return (
          <button
            key={j}
            type="button"
            className={styles.cite}
            disabled={!onGo || !(canHop?.(key) ?? true)}
            aria-label={t.goToVerse(t.ayahLabel(key) ?? part.text)}
            onClick={() => onGo?.(key)}
          >
            {part.text}
          </button>
        );
      }));
  };
  // The drawer's own words follow the app's language; the source's words follow
  // the source's, so an Arabic tafsir reads right to left in an English app and
  // The Study Quran reads left to right in an Arabic one.
  const own = {
    dir: textDir(entry.source.lang),
    ...(entry.source.lang ? { lang: entry.source.lang } : {}),
  };

  return (
    <>
      {modal && <div className={styles.scrim} onClick={onClose} aria-hidden="true" />}
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        // The drawer is drawn inside the mus'haf's right-to-left stage, so it
        // says its own direction or the page's leaks in: in English the credit
        // read ".Shown privately, …" with its full stop in front.
        dir={dir}
        aria-modal={modal}
        aria-label={introOnly ? label : t.commentaryOn(label)}
        data-side={side ?? undefined}
        data-tall={tall || undefined}
        style={leafStyle(place)}
        data-over-leaf={place ? "" : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onScroll={(e) => {
          if (!beside && !tall && e.currentTarget.scrollTop > 0) setTall(true);
        }}
      >
        {/* The handle and the title row stay at the top while the note
            scrolls under them: deep in a long note the reader still sees
            which verse it is on, and can close it or shrink it. */}
        <div className={styles.top}>
          {/* Beside a page nothing drags or grows, so it has no handle. */}
          {beside ? null : (
            <button
              type="button"
              className={styles.grip}
              aria-label={tall ? t.noteShowLess : t.noteShowAll}
              aria-expanded={tall}
              onClick={() => setTall((v) => !v)}
            />
          )}
          <header className={styles.head}>
            <span className={styles.glyph} aria-hidden="true">
              {introOnly ? "ⓘ" : "✎"}
            </span>
            <div className={styles.heading}>
              <h2 className={styles.title} {...own}>
                {entry.source.label}
              </h2>
              <span className={styles.ref}>{label}</span>
            </div>
            <button type="button" className={styles.close} onClick={onClose} aria-label={t.close}>
              ✕
            </button>
          </header>
        </div>

        {back && (
          <button type="button" className={styles.back} onClick={back.onBack}>
            {/* The hook bends back toward where the line starts, so it turns
                with the reading direction; the row's gap is the space after it. */}
            <span aria-hidden="true">{dir === "rtl" ? "↪" : "↩"}</span>
            {t.beadBack(back.label)}
          </button>
        )}

        <div className={styles.body}>
          {entry.intro && (
            <section className={styles.intro} aria-label={t.surahIntro} {...own}>
              <h3 className={styles.introTitle}>{entry.intro.title}</h3>
              {entry.intro.paragraphs.map((para, i) => (
                <p key={i} className={styles.introPara}>
                  {prose(para, `intro-${i}`)}
                </p>
              ))}
            </section>
          )}

          {entry.translation && (
            <blockquote className={styles.translation} {...own}>
              {entry.translation}
            </blockquote>
          )}

          {!introOnly && (
          <section className={styles.commentary} aria-label={t.commentaryTitle} {...own}>
            {entry.paragraphs.map((para, i) => (
              <p key={i} className={styles.para}>
                {prose(para, `${i}`, entry.ayahKey)}
              </p>
            ))}
          </section>
          )}

          {roads.length > 0 && (
            <section className={styles.related} aria-label={t.relatedVerses}>
              <h3 className={styles.relatedTitle}>{t.relatedVerses}</h3>
              <p className={styles.relatedLede}>{t.relatedLede(entry.source.label)}</p>
              <ul className={styles.roads}>
                {orderForHifz(roads).map((edge) => {
                  const enabled = canHop ? canHop(edge.to) : true;
                  const label =
                    (edge.through ? t.rangeLabel(edge.to, edge.through) : t.ayahLabel(edge.to)) ?? edge.to;
                  return (
                    <li key={`${edge.type}:${edge.to}`} className={styles.road}>
                      <button
                        type="button"
                        className={styles.roadHop}
                        disabled={!enabled || !onHop}
                        onClick={() => onHop?.(edge)}
                        aria-label={t.hopTo(label)}
                      >
                        <span className={styles.roadLabel}>
                          {label}
                          {edge.twin && <span className={styles.badge}>{t.twin}</span>}
                        </span>
                        {edge.note && (
                          <span className={styles.roadNote} {...own}>
                            {edge.note}
                          </span>
                        )}
                        {!enabled && (
                          <span className={styles.roadUnavailable}>{t.pageUnavailable}</span>
                        )}
                        <span className={styles.roadArrow} aria-hidden="true">
                          ↪
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <footer className={styles.credit}>
          {/* The book's credit is in the book's language, on a line of its own,
              so an English credit in the Arabic app wraps from the left. */}
          <span className={styles.creditSource} {...own}>
            {entry.source.label} — {entry.source.license}.
          </span>
          {creditNote && <span className={styles.creditNote}>{creditNote}</span>}
        </footer>

        {keyOpen && sigla.has(keyOpen.sig) && (
          <KeyCard
            ref={cardRef}
            id={cardId}
            tapped={keyOpen.sig}
            entries={keyOpen.sigs.flatMap((sig) => (sigla.has(sig) ? [[sig, sigla.get(sig)!] as const] : []))}
            own={own}
          />
        )}
      </div>
    </>
  );
}

/** The source's key for one bracket of initials, under the one that was tapped. */
const KeyCard = forwardRef<
  HTMLDivElement,
  {
    id: string;
    tapped: string;
    entries: readonly (readonly [string, Commentator])[];
    own: { dir: "ltr" | "rtl" | "auto"; lang?: string };
  }
>(function KeyCard({ id, tapped, entries, own }, ref) {
  const { t, dir } = useT();
  const many = entries.length > 1;
  return (
    <div ref={ref} id={id} className={styles.keyCard} role="note" aria-label={t.keyFrom}>
      <p className={styles.keyFrom}>{t.keyFrom}</p>
      {entries.map(([sig, who]) => (
        <div
          key={sig}
          className={styles.keyEntry}
          data-key-entry=""
          // The entry runs the source's way, so the mark of the tapped one
          // stands where its name starts; the app's own words keep the app's.
          dir={own.dir}
          {...(many && sig === tapped ? { "aria-current": "true" as const } : {})}
        >
          <p className={styles.keyWho} {...own}>
            <b>{sig}</b> {who.who}
          </p>
          <p className={styles.keyWork} {...own}>
            <cite>{who.work}</cite>
          </p>
          {who.also && <p className={styles.keyAlso} dir={dir}>{t.keyAlso(who.also)}</p>}
        </div>
      ))}
    </div>
  );
});
