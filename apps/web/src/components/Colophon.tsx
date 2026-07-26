import { useCallback, useEffect, useRef } from "react";
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
 * Every source Hifth ships bytes from, with the name and licence its terms ask
 * for. Two of these are conditions, not courtesies:
 *   • the Quranic Arabic Corpus requires its source to be "clearly indicated"
 *     with a link to corpus.quran.com;
 *   • quran-tajweed is CC BY 4.0, whose attribution travels with the work.
 * The mutashabihat licence asks for a mention "in your app or any other kind of
 * work" — SOURCES.md has promised this surface since Loop 4a. The full terms,
 * pins and hashes are in SOURCES.md; this is the reader-facing half.
 */
const CREDITS: readonly Credit[] = [
  {
    what: "صفحات المصحف",
    who: "طباعة مجمع الملك فهد (KFGQPC)، عبر quran-svg / quranpedia",
    licence: "إتاحة حرّة للاستعمال غير التجاري",
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
 * It is also where the other three sources are credited. Two of their licences
 * require it and one asks for it; all four are named here so a reader can see
 * whose work they are holding without cloning anything.
 *
 * Opened from the wordmark rather than a fifth header button: the chrome
 * already carries ⌖, ▤, the skin switch and the install prompt, and on a phone
 * one more control would compete with navigation for the thumb. The wordmark
 * was decoration; "about" is the one thing a wordmark is always allowed to be.
 *
 * A11y: EditionPicker's contract — modal dialog, focus in, Tab trapped, Escape
 * closes, focus restored to the wordmark.
 */
export function Colophon({ open, onClose }: ColophonProps): JSX.Element | null {
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
        aria-label="عن حِفظ"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className={styles.grip} aria-hidden="true" />
        <header className={styles.head}>
          <span className={styles.glyph} aria-hidden="true">
            ۞
          </span>
          <h2 className={styles.title}>عن حِفظ</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </header>

        <p className={styles.lede}>
          حِفظ آلة ملاحة في المصحف: تختار آية فينقلك إلى متشابهاتها. لا حساب ولا خادم ولا
          تتبّع؛ الصفحات والبيانات تُحمَّل إلى جهازك.
        </p>
        <p className={styles.caveat}>
          المصحف المطبوع هو المرجع. ما يعرضه حِفظ عونٌ على المراجعة، لا بديل عنها.
        </p>

        <section className={styles.block}>
          <h3 className={styles.subhead}>الرخصة والمصدر</h3>
          <p className={styles.body}>
            برنامج حرّ برخصة GNU GPL الإصدار الثالث أو ما بعده: لك أن تدرسه وتعدّله وتنشره.
            وهذه شيفرة هذه النسخة بعينها، لا فرعٌ قد يتغيّر:
          </p>
          {/* The §6 offer itself. `rel` is belt-and-braces on a link that opens
              a code host: noopener/noreferrer cost nothing and the target is
              outside our control. */}
          <a
            className={styles.source}
            href={sourceUrl()}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className={styles.sourceLabel}>الشيفرة المصدرية</span>
            <span className={`${styles.commit} numeric`}>
              {hasCommit() ? shortCommit() : "نسخة تطوير"}
            </span>
          </a>
          {!hasCommit() && (
            /* A dev server corresponds to a working tree, which is not a thing
               anyone can be handed. Say that, rather than link to a commit that
               does not exist — the link above falls back to the repository. */
            <p className={styles.note}>
              هذه نسخة تطوير محلّية، فلا تقابلها إصدارة معيّنة؛ الرابط يفتح المستودع.
            </p>
          )}
        </section>

        <section className={styles.block}>
          <h3 className={styles.subhead}>المصادر</h3>
          <ul className={styles.list}>
            {CREDITS.map((credit) => (
              <li key={credit.href} className={styles.row}>
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
          الشروط الكاملة والإصدارات المثبَّتة في ملف SOURCES.md داخل المستودع:{" "}
          <a className={styles.inline} href={SOURCE_REPO} target="_blank" rel="noopener noreferrer">
            {SOURCE_REPO.replace("https://", "")}
          </a>
        </p>
      </div>
    </>
  );
}
