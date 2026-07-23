import { orderForHifz, type Edge, type RailChip } from "@hifth/core";
import { ayahLabel } from "../format";
import styles from "./HopPopover.module.css";

interface HopPopoverProps {
  /** The open chip's bucket, or null when closed. */
  chip: RailChip | null;
  /** Whether a hop target's page is vendored (loadable). Unvendored → disabled. */
  canHop: (toKey: string) => boolean;
  /** Perform the hop to an edge's target. */
  onHop: (edge: Edge) => void;
  /** Dismiss the sheet. */
  onClose: () => void;
}

const DIRECTION_TITLE: Record<RailChip["direction"], string> = {
  loop: "متشابهات في السورة",
  earlier: "في سور سابقة",
  later: "في سور لاحقة",
  root: "بنفس الجذر",
};

/**
 * HopPopover — the bottom-sheet hop list (spec §9). Opened by a rail chip, it
 * lists that bucket's edges hifz-ordered (nearest first), each row a "hop there"
 * arc-arrow. A target on an un-vendored page shows the link and its note but the
 * leap is disabled with an honest "page not available yet" note (Plan Q6) — we
 * never pan to a ghost page. Sheet on phones, floating card on wide screens (CSS).
 */
export function HopPopover({ chip, canHop, onHop, onClose }: HopPopoverProps): JSX.Element | null {
  if (!chip) return null;
  const edges = orderForHifz(chip.edges);

  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={`${DIRECTION_TITLE[chip.direction]} · ${chip.count}`}
      >
        <div className={styles.grip} aria-hidden="true" />
        <header className={styles.head}>
          <span className={styles.glyph} aria-hidden="true">
            {chip.glyph}
          </span>
          <h2 className={styles.title}>{DIRECTION_TITLE[chip.direction]}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </header>

        <ul className={styles.list}>
          {edges.map((edge) => {
            const enabled = canHop(edge.to);
            const label = ayahLabel(edge.to) ?? edge.to;
            return (
              <li key={edge.to} className={styles.row}>
                <div className={styles.rowText}>
                  <span className={styles.rowLabel}>
                    {label}
                    {edge.twin && <span className={styles.badge}>توأم</span>}
                    {edge.root && <span className={styles.root}>{edge.root}</span>}
                  </span>
                  {edge.note && <span className={styles.note}>{edge.note}</span>}
                  {!enabled && (
                    <span className={styles.unavailable}>هذه الصفحة غير متوفّرة بعد</span>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.hop}
                  disabled={!enabled}
                  onClick={() => onHop(edge)}
                  aria-label={`انتقل إلى ${label}`}
                >
                  <span aria-hidden="true">↪</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
