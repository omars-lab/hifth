import { useCallback, useEffect, useRef } from "react";
import {
  TAJWEED_RULES,
  type SkinId,
  type TajweedMark,
  type TajweedRuleId,
} from "@hifth/core";
import { toArabicDigits } from "../format";
import styles from "./SkinToggle.module.css";

interface SkinToggleProps {
  /** The skin currently applied (L3 owns it; the stage applies it). */
  skin: SkinId;
  /** Flip between plain and tajweed. */
  onChange: (skin: SkinId) => void;
  /** Open the legend sheet — the only place rule identity is spelled out. */
  onOpenLegend: () => void;
}

/**
 * SkinToggle — plain ⇄ tajweed, plus the way into the legend.
 *
 * Two controls, not one: the toggle is the switch, the ⓘ is the key. Colour
 * alone can never carry rule identity (WCAG 1.4.1), so the legend is part of the
 * feature rather than help content — which is also why it is reachable *before*
 * the skin is on.
 *
 * **The beta badge is permanent furniture until a hafiz signs off** (PLAN §6
 * testing plan: "Tajweed skin ships behind a beta flag until hafiz approval").
 * It sits on the toggle itself, in both states, so nobody turns the skin on
 * without having seen it — a tajweed error in a memorisation tool is the kind of
 * bug that teaches a mistake.
 */
export function SkinToggle({ skin, onChange, onOpenLegend }: SkinToggleProps): JSX.Element {
  const on = skin === "tajweed";
  return (
    <div className={styles.group} role="group" aria-label="مظهر الصفحة">
      <button
        type="button"
        className={styles.toggle}
        aria-pressed={on}
        onClick={() => onChange(on ? "plain" : "tajweed")}
      >
        <span className={styles.label}>تجويد</span>
        <span className={styles.beta}>تجريبي</span>
      </button>
      <button
        type="button"
        className={styles.legendBtn}
        onClick={onOpenLegend}
        aria-label="مفتاح ألوان التجويد"
      >
        <span aria-hidden="true">ⓘ</span>
      </button>
    </div>
  );
}

interface TajweedLegendProps {
  /** Null when closed (same convention as HopPopover's `chip`). */
  open: boolean;
  /** Rule → how many ayahs on the current page carry it. */
  counts: ReadonlyMap<TajweedRuleId, number>;
  /** The page the counts describe. */
  page: number;
  /** The selected ayah's rules, spelled out in text — the non-visual channel. */
  selection: { label: string; marks: readonly TajweedMark[] } | null;
  /** Attribution required by the rule source's licence, rendered verbatim. */
  credit: { text: string; href: string } | null;
  onClose: () => void;
}

/** Focusable descendants of `root`, in tab order (excludes disabled + hidden). */
function focusables(root: HTMLElement): HTMLElement[] {
  const sel =
    'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll<HTMLElement>(sel));
}

/**
 * TajweedLegend — the key, and the honesty.
 *
 * Every rule gets four channels: an Arabic name, a text mark, a colour swatch
 * and the dash pattern the page actually draws (rendered as a real stroked line,
 * so what you see here is what you see there). Counts say how many ayahs on this
 * page carry the rule, which turns a colour key into something worth opening.
 *
 * It also states the two things a hafiz must know before trusting it: the skin
 * is **beta** pending sign-off, and it marks whole ayahs rather than letters
 * because the vendored corpus has no letter geometry yet.
 *
 * A11y: HopPopover's contract exactly — modal dialog, focus in on open, Tab
 * trapped, Escape closes, focus restored to the trigger.
 */
export function TajweedLegend({
  open,
  counts,
  page,
  selection,
  credit,
  onClose,
}: TajweedLegendProps): JSX.Element | null {
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
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
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
        aria-label="مفتاح ألوان التجويد"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className={styles.grip} aria-hidden="true" />
        <header className={styles.head}>
          <h2 className={styles.title}>مفتاح التجويد</h2>
          <span className={styles.beta}>تجريبي</span>
          <button type="button" className={styles.close} onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </header>

        <p className={styles.caveat}>
          هذه الطبقة <strong>تجريبية</strong> حتى يعتمدها حافظ. وهي تُعلّم الآية كاملة
          بأبرز حكم فيها — لا الحرف نفسه — لأنّ صفحات المصحف الحالية لا تحمل معرّفات
          للحروف بعد.
        </p>

        <ul className={styles.list}>
          {TAJWEED_RULES.map((rule) => {
            const n = counts.get(rule.id) ?? 0;
            return (
              <li key={rule.id} className={styles.row} data-empty={n === 0 || undefined}>
                <span className={styles.swatch} aria-hidden="true">
                  <svg viewBox="0 0 40 12" className={styles.swatchSvg}>
                    <rect
                      x="1"
                      y="1"
                      width="38"
                      height="10"
                      rx="2"
                      className={`${styles.swatchShape} tj-legend-${rule.id}`}
                    />
                  </svg>
                </span>
                <span className={styles.mark} aria-hidden="true">
                  {rule.mark}
                </span>
                <span className={styles.name}>
                  {/* The Arabic name is its own element, not a bare text node:
                      it is the non-colour channel for rule identity, so it has
                      to be addressable on its own by a screen reader's element
                      navigation and by the tests that police WCAG 1.4.1. */}
                  <span>{rule.label}</span>
                  <span className={styles.latin}>{rule.latin}</span>
                </span>
                <span className={styles.count}>
                  {n === 0
                    ? "لا شيء في هذه الصفحة"
                    : `${toArabicDigits(n)} آية في صفحة ${toArabicDigits(page)}`}
                </span>
              </li>
            );
          })}
        </ul>

        {selection && (
          <section className={styles.selection} aria-label="أحكام الآية المحددة">
            <h3 className={styles.subhead}>{selection.label}</h3>
            {selection.marks.length === 0 ? (
              <p className={styles.empty}>لا أحكام معروفة على هذه الآية.</p>
            ) : (
              <ul className={styles.chips}>
                {selection.marks.map((mark) => (
                  <li key={mark.rule.id} className={styles.chip}>
                    <span className={styles.mark} aria-hidden="true">
                      {mark.rule.mark}
                    </span>
                    {mark.rule.label}
                    <span className="numeric">{toArabicDigits(mark.count)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {credit && (
          <p className={styles.credit}>
            {credit.text}{" "}
            <a href={credit.href} target="_blank" rel="noreferrer noopener">
              {credit.href}
            </a>
          </p>
        )}
      </div>
    </>
  );
}
