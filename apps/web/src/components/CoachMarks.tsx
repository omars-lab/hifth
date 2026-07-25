import { useCallback, useEffect, useRef, useState } from "react";
import { toArabicDigits } from "../format";
import styles from "./CoachMarks.module.css";

/**
 * Where the dismissal is remembered. Versioned: teaching a *new* verb later
 * means a new key, not a silent re-show of the old marks.
 */
export const COACH_STORAGE_KEY = "hifth.coach.v1";

/** Has this device already been shown (and dismissed) the marks? */
export function coachDismissed(): boolean {
  try {
    return localStorage.getItem(COACH_STORAGE_KEY) === "1";
  } catch {
    // Safari private mode throws on localStorage. A device we cannot remember
    // is a device we do not teach twice in one session — better a missed lesson
    // than a strip that returns on every reload.
    return true;
  }
}

function rememberDismissal(): void {
  try {
    localStorage.setItem(COACH_STORAGE_KEY, "1");
  } catch {
    /* nothing to do — see coachDismissed */
  }
}

interface Step {
  readonly glyph: string;
  readonly title: string;
  readonly body: string;
}

/**
 * The three verbs the app actually has, in the app's own words (PLAN §5 copy
 * rules: user-side vocabulary, active voice, one verb per flow). Nothing here
 * describes a feature that does not exist yet.
 */
const STEPS: readonly Step[] = [
  {
    glyph: "◉",
    title: "المس آية",
    body: "يظهر شريط الروابط بجانبها: متشابهاتها، وعددها.",
  },
  {
    glyph: "▤",
    title: "اضغط واسحب",
    body: "يتظلّل المقطع، وتفتح قائمته بروابط آياته مجموعة.",
  },
  {
    glyph: "↪",
    title: "المس رقاقة",
    body: "تنتقل إلى الآية المشابهة، وتبقى خرزة في المسار للرجوع.",
  },
];

interface CoachMarksProps {
  /** Render only once the app is usable (there is nothing to teach before). */
  ready: boolean;
}

/**
 * CoachMarks — the one-time teaching strip (PLAN §Loop 6a).
 *
 * **Deliberately not a modal.** A wall over the mushaf on first open would be
 * the first thing Hifth ever did to a hafiz, and it would sit between them and
 * the page they came for. Instead the marks are a strip *in the layout* between
 * the chrome and the stage: it never covers an ayah, so the very first tap the
 * strip is describing still lands. It is also why they teach three verbs in one
 * place rather than pointing at three moving targets.
 *
 * Shown once per device, dismissible, and gone for good afterwards
 * (`localStorage`). Fully operable from the keyboard — Tab reaches every
 * control, Escape skips the whole thing — and animation-free under
 * `prefers-reduced-motion` (the CSS honours it via the shared duration tokens).
 */
export function CoachMarks({ ready }: CoachMarksProps): JSX.Element | null {
  // Read storage once, on mount: a dismissal must not re-render into view.
  const [dismissed, setDismissed] = useState(() => coachDismissed());
  const [step, setStep] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);

  const dismiss = useCallback(() => {
    rememberDismissal();
    setDismissed(true);
  }, []);

  // Escape skips from anywhere in the strip; the strip is not modal, so it only
  // listens while focus is inside it (a global Escape belongs to the sheets).
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        dismiss();
      }
    },
    [dismiss],
  );

  // Keep focus inside the strip as the steps advance: the "next" button is
  // replaced by "done" on the last card, and a keyboard user must not be
  // dropped back to the top of the document mid-lesson.
  const advancedRef = useRef(false);
  useEffect(() => {
    if (!advancedRef.current) return;
    stripRef.current?.querySelector<HTMLElement>("[data-primary]")?.focus();
  }, [step]);

  if (dismissed || !ready) return null;

  const current = STEPS[step]!;
  const last = step === STEPS.length - 1;

  return (
    <div
      ref={stripRef}
      className={styles.strip}
      role="region"
      aria-label="كيف تتنقّل"
      onKeyDown={onKeyDown}
    >
      <span className={styles.glyph} aria-hidden="true">
        {current.glyph}
      </span>
      <p className={styles.text}>
        <span className={styles.title}>{current.title}</span>
        <span className={styles.body}>{current.body}</span>
      </p>
      <span className={styles.count} aria-hidden="true">
        {toArabicDigits(step + 1)}⁄{toArabicDigits(STEPS.length)}
      </span>
      <button
        type="button"
        className={styles.next}
        data-primary=""
        onClick={() => {
          if (last) {
            dismiss();
            return;
          }
          advancedRef.current = true;
          setStep((s) => s + 1);
        }}
        aria-label={
          last
            ? "تمّ · إخفاء الشرح"
            : `التالي · ${toArabicDigits(step + 2)} من ${toArabicDigits(STEPS.length)}`
        }
      >
        {last ? "تمّ" : "التالي"}
      </button>
      <button type="button" className={styles.skip} onClick={dismiss}>
        تخطَّ
      </button>
    </div>
  );
}
