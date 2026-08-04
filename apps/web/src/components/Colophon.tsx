import { useCallback, useEffect, useRef } from "react";
import { useT } from "../i18n";
import { LOCALES } from "../lang";
import { LOCALE_IDS } from "../messages/locales.gen";
import { SOURCE_REPO, hasCommit, shortCommit, sourceUrl } from "../provenance";
import styles from "./Colophon.module.css";

interface ColophonProps {
  /** Whether the sheet is open. */
  open: boolean;
  /** Dismiss the sheet. */
  onClose: () => void;
}

/** Focusable descendants of `root`, in tab order (excludes disabled + hidden). */
function focusables(root: HTMLElement): HTMLElement[] {
  const sel =
    'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll<HTMLElement>(sel));
}

interface Credit {
  /** What this source gives the reader, in the reader's terms. */
  readonly what: string;
  /** Who made it — the name the licence asks us to carry. */
  readonly who: string;
  /** The licence, named exactly. */
  readonly licence: string;
  /** Where it lives. Mandatory for the corpus; useful for the rest. */
  readonly href: string;
}

/*
 * Every source Hifth is built on, with the name and licence its terms ask for.
 * Most of them ship bytes; one — the ligature corpus, last row — ships none.
 * What it gave is measurement: a rectangle per word, fitted onto our own pages
 * by `build-words.mjs`. Its licence asks for nothing at all, and it is credited
 * anyway, because a reader tapping a word is touching that corpus's work and a
 * row costs us a line. The other side of that is worth saying too: a courtesy
 * recorded as a courtesy can be changed, and one that has quietly hardened into
 * a supposed condition cannot. SOURCES.md marks which is which.
 *
 * Three of these are conditions, not courtesies:
 *   • the Quranic Arabic Corpus requires its source to be "clearly indicated"
 *     with a link to corpus.quran.com;
 *   • quran-tajweed is CC BY 4.0, whose attribution travels with the work;
 *   • the Tanzil metadata is CC BY, likewise — and it is credited even though
 *     Hifth ships none of its bytes, only numbers copied out of them, because
 *     the numbers are the work.
 * The mutashabihat licence asks for a mention "in your app or any other kind of
 * work" — SOURCES.md has promised this surface since Loop 4a. The full terms,
 * pins and hashes are in SOURCES.md; this is the reader-facing half.
 *
 * These rows are NOT authored here. Each one is declared verbatim in its
 * source's ```colophon fence in SOURCES.md, and `gate:license-copy` fails the
 * build if this array is not exactly that set — same string, same link, no
 * extras. Editing a licence line here alone will not ship; edit the fence and
 * bring this into line with it. The binding exists because these two files once
 * disagreed and only one of them was machine-read: the KFGQPC artwork was
 * credited as non-commercial for several loops, and nothing anywhere went red.
 */
const CREDITS: readonly Credit[] = [
  {
    what: "صفحات المصحف",
    who: "طباعة مجمع الملك فهد (KFGQPC)، عبر quran-svg / quranpedia",
    // Two licences layered, and only one of them constrains anyone: quran-svg's
    // own contribution (the polygon overlay and JSON) is CC0, which asks for
    // nothing; the Complex's terms are what a reader might need to know. Those
    // terms permit digital, web and software use — the reservation is on
    // printing physical masahif for commercial sale, which this app cannot do.
    // Said plainly because the earlier wording here, "non-commercial use only",
    // was the *Libyan Awqaf* edition's term, which Hifth does not vendor: it
    // told every reader the artwork was more restricted than it is.
    licence: "إتاحة حرّة للاستعمال الرقمي · الطبع التجاري محفوظ للمجمع",
    href: "https://github.com/quranpedia/quran-svg",
  },
  {
    what: "المتشابهات",
    who: "Quran Mutashabihat Data · Waqar Ahmed",
    licence: "استعمال حرّ مع ذكر المصدر",
    href: "https://github.com/Waqar144/Quran_Mutashabihat_Data",
  },
  {
    what: "الجذور والصرف",
    who: "Quranic Arabic Corpus · Kais Dukes، جامعة ليدز",
    licence: "GNU GPL",
    href: "http://corpus.quran.com",
  },
  {
    what: "أحكام التجويد",
    who: "quran-tajweed · Collin Fair",
    licence: "CC BY 4.0",
    href: "https://github.com/cpfair/quran-tajweed",
  },
  {
    what: "أقسام المصحف",
    who: "Tanzil Project",
    licence: "CC BY",
    href: "https://tanzil.net",
  },
  {
    what: "مواضع الكلمات",
    who: "Mushaf Database · قاعدة بيانات المصحف",
    licence: "صدقة جارية · إتاحة حرّة",
    href: "https://github.com/mushafdatabase/MushafDatabase-Ligature-Based-SVG",
  },
];

/**
 * The colophon — what Hifth is, and the offer the GPL makes on its behalf.
 *
 * This sheet exists because publishing the app *conveys* it: the browser is
 * handed real copies of the JS and of `assets/roots/**`, a GPL-covered
 * derivative of the Quranic Arabic Corpus. §6 then owes the reader the
 * Corresponding Source for the build they are running — which is why the link
 * carries this bundle's commit (see `../provenance`) and not a branch name.
 * A licence notice nobody can reach is not a notice, so it lives one tap from
 * every screen rather than in a README.
 *
 * It is also where the other sources are credited. Two of their licences
 * require it, one asks for it, and the rest are here by choice; all of them are
 * named so a reader can see whose work they are holding without cloning
 * anything.
 *
 * Opened from the wordmark rather than a fifth header button: the chrome
 * already carries ⌖, ▤, the skin switch and its legend, and on a phone
 * one more control would compete with navigation for the thumb. The wordmark
 * was decoration; "about" is the one thing a wordmark is always allowed to be.
 *
 * The language switch lives here for the same arithmetic. `e2e/chrome-fit`
 * holds the header inside 320px with seventeen pixels to spare, and a sixth
 * control does not fit in seventeen pixels. This is also the right *kind* of
 * place: the language is chosen once and then forgotten, like the mus'haf and
 * unlike the skin. It sits at the top of the sheet rather than the bottom
 * because a reader who opened "about" in a language they cannot read needs the
 * switch before they need anything else on this page.
 *
 * A11y: EditionPicker's contract — modal dialog, focus in, Tab trapped, Escape
 * closes, focus restored to the wordmark.
 */
export function Colophon({ open, onClose }: ColophonProps): JSX.Element | null {
  const { t, dir, lang, setLang } = useT();
  const sheetRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = (document.activeElement as HTMLElement | null) ?? null;
    const sheet = sheetRef.current;
    if (sheet) (focusables(sheet)[0] ?? sheet).focus();
    return () => {
      restoreRef.current?.focus?.();
    };
  }, [open]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const sheet = sheetRef.current;
      if (!sheet) return;
      const items = focusables(sheet);
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const el = document.activeElement;
      if (e.shiftKey && el === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && el === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={t.aboutTitle}
        dir={dir}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className={styles.grip} aria-hidden="true" />
        <header className={styles.head}>
          <span className={styles.glyph} aria-hidden="true">
            ۞
          </span>
          <h2 className={styles.title}>{t.aboutTitle}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t.close}>
            ✕
          </button>
        </header>

        {/* One button per language rather than one toggle. A single "switch to
            English" control is unreadable to the half of its audience that
            cannot read the label it is currently wearing, and `aria-pressed` on
            a two-state language control announces "pressed" for a thing that is
            not on or off. A radio group says every option in its own script, at
            once, and marks which one is live — which is also what makes it
            usable by someone who opened the app in the wrong language by
            accident. */}
        <section className={styles.block} aria-labelledby="colophon-lang">
          <h3 className={styles.subhead} id="colophon-lang">
            {t.langSectionTitle}
          </h3>
          <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-lang">
            {/* Driven by the registry, not by two hand-written buttons. Each
                name is written in its own language and marked as such, so a
                screen reader switches voice for the option it is offering
                rather than reading «العربية» through an English synthesiser —
                and each button names *itself* rather than "the other one",
                which is what stops the group from being a toggle wearing a
                radiogroup's clothes. */}
            {LOCALE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                className={styles.lang}
                aria-checked={lang === id}
                aria-label={lang === id ? undefined : t.langSwitchTo(LOCALES[id].name)}
                lang={id}
                onClick={() => setLang(id)}
              >
                {LOCALES[id].name}
              </button>
            ))}
          </div>
          <p className={styles.note}>{t.langSectionNote}</p>
        </section>

        <p className={styles.lede}>{t.aboutLede}</p>
        <p className={styles.caveat}>{t.aboutCaveat}</p>

        <section className={styles.block}>
          <h3 className={styles.subhead}>{t.licenceHead}</h3>
          <p className={styles.body}>{t.licenceBody}</p>
          {/* The §6 offer itself. `rel` is belt-and-braces on a link that opens
              a code host: noopener/noreferrer cost nothing and the target is
              outside our control. */}
          <a
            className={styles.source}
            href={sourceUrl()}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className={styles.sourceLabel}>{t.sourceLink}</span>
            <span className={`${styles.commit} numeric`}>
              {hasCommit() ? shortCommit() : t.devBuild}
            </span>
          </a>
          {!hasCommit() && (
            /* A dev server corresponds to a working tree, which is not a thing
               anyone can be handed. Say that, rather than link to a commit that
               does not exist — the link above falls back to the repository. */
            <p className={styles.note}>{t.devBuildNote}</p>
          )}
        </section>

        <section className={styles.block}>
          <h3 className={styles.subhead}>{t.sourcesHead}</h3>
          <ul className={styles.list}>
            {/* The rows stay Arabic in both languages, and pinned RTL with it.
                They are not copy: `gate:license-copy` binds every one of them
                byte-for-byte to a ```colophon fence in SOURCES.md, and an
                attribution that says something different depending on who is
                reading is an attribution nobody has actually made. So the row
                declares the language it is written in and lets the browser
                bidi-render the Latin names inside it, exactly as before. */}
            {CREDITS.map((credit) => (
              <li key={credit.href} className={styles.row} lang="ar" dir="rtl">
                <span className={styles.what}>{credit.what}</span>
                <a
                  className={styles.who}
                  href={credit.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {credit.who}
                </a>
                <span className={styles.licence}>{credit.licence}</span>
              </li>
            ))}
          </ul>
        </section>

        <p className={styles.foot}>
          {t.aboutFoot}{" "}
          <a className={styles.inline} href={SOURCE_REPO} target="_blank" rel="noopener noreferrer">
            {SOURCE_REPO.replace("https://", "")}
          </a>
        </p>
      </div>
    </>
  );
}
