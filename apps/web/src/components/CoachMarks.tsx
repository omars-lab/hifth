import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { COACH_STORAGE_KEY, coachDismissed, rememberDismissal } from "../coach";
import styles from "./CoachMarks.module.css";

// The key and its two accessors live in `../coach` — a module with no React and
// no CSS, so the e2e specs that seed a returning reader can import the key
// instead of retyping it. Re-exported here because this component is where
// callers expect to find them. Imported *and* re-exported rather than
// `export … from`: the bare re-export creates no local binding, so the
// `coachDismissed()` call below was a ReferenceError at render.
export { COACH_STORAGE_KEY, coachDismissed };

/**
 * The three verbs the app actually has, one glyph each — select, drag, hop.
 *
 * The glyphs are the same three the chrome and the rail use, so they stay here
 * while the words live in `i18n`'s `coachSteps` (PLAN §5 copy rules: user-side
 * vocabulary, active voice, one verb per flow). Nothing here describes a
 * feature that does not exist yet, in either language.
 */
const GLYPHS: readonly string[] = ["◉", "▤", "↪"];

interface CoachMarksProps {
  /** Render only once the app is usable (there is nothing to teach before). */
  ready: boolean;
  /**
   * Fired when the strip leaves for good. The strip occupies layout above the
   * stage, so what shares that space is a question only App can answer — it
   * holds the storage notice back until this fires.
   */
  onDismiss?: () => void;
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
export function CoachMarks({ ready, onDismiss }: CoachMarksProps): JSX.Element | null {
  const { t } = useT();
  // Read storage once, on mount: a dismissal must not re-render into view.
  const [dismissed, setDismissed] = useState(() => coachDismissed());
  const [step, setStep] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);

  const dismiss = useCallback(() => {
    rememberDismissal();
    setDismissed(true);
    onDismiss?.();
  }, [onDismiss]);

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

  const steps = t.coachSteps;
  const current = steps[step]!;
  const last = step === steps.length - 1;

  return (
    <div
      ref={stripRef}
      className={styles.strip}
      role="region"
      aria-label={t.coachRegion}
      onKeyDown={onKeyDown}
    >
      <span className={styles.glyph} aria-hidden="true">
        {GLYPHS[step]}
      </span>
      <p className={styles.text}>
        <span className={styles.title}>{current.title}</span>
        <span className={styles.body}>{current.body}</span>
      </p>
      <span className={styles.count} aria-hidden="true">
        {t.num(step + 1)}⁄{t.num(steps.length)}
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
        aria-label={last ? t.coachDoneAria : t.coachNextAria(step + 2, steps.length)}
      >
        {last ? t.coachDone : t.coachNext}
      </button>
      <button type="button" className={styles.skip} onClick={dismiss}>
        {t.coachSkip}
      </button>
    </div>
  );
}
