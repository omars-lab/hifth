import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import {
  CARRIED_KEY,
  CARRY_HASH,
  CARRY_WAIT_MS,
  LATER_KEY,
  RECORD_KEY,
  carryMessage,
  sheetState,
  type Addresses,
  type CarriedSeam,
  settingsOf,
} from "../moved";
import { store, stored } from "./MovedSheet";
import styles from "./MovedCard.module.css";

export interface MovedCardProps {
  /** The same file "Save to a file" writes, as text. */
  file: () => string;
  /** "Save to a file", for when hifth.app does not answer. */
  onSave: () => void;
  /** Where the reader left off, which goes with the file so hifth.app opens there. */
  readPlace: () => Promise<CarriedSeam | null>;
  /** What the reader has opened (the revision record), read only if they tick the box that names it. */
  readRecord: () => Promise<unknown>;
  /** Where the two addresses are, as ./MovedSheet.tsx read them. */
  addresses: Addresses;
  /** "Later": the card goes until the next time it is due. */
  onHide: () => void;
}

type Phase = { at: "ask" } | { at: "waiting" } | { at: "carried"; added: number; record: boolean } | { at: "failed" };

/**
 * The old address's half of carrying marks across (moved.ts says the whole of it).
 * Shown only at the old address, in a browser, once the switch is on.
 *
 * "Carry them" opens hifth.app/read in a new tab — inside the press, so the
 * browser allows it — waits for it to say it is ready, and sends it the file,
 * to that address only. If it has not answered after a while, or the browser
 * kept the tab from opening, the card offers to save the file instead.
 *
 * What the reader has opened (the revision record) goes only when they tick the
 * box that names it, never with "Carry them" alone. The box stays on the card
 * after the marks have gone, until the record has been sent, so a reader who
 * left it unticked can still send it later.
 */
export function MovedCard({ file, onSave, readPlace, readRecord, addresses, onHide }: MovedCardProps): JSX.Element {
  const { t } = useT();
  const [phase, setPhase] = useState<Phase>({ at: "ask" });
  const carried = sheetState(stored(CARRIED_KEY)) === "open";
  const [recordSent, setRecordSent] = useState(() => stored(RECORD_KEY) !== null);
  const [withRecord, setWithRecord] = useState(false);
  const fileRef = useRef(file);
  fileRef.current = file;
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => () => stop.current?.(), []);

  const carry = useCallback(() => {
    stop.current?.();
    const tab = window.open(addresses.page + CARRY_HASH);
    if (!tab) {
      setPhase({ at: "failed" });
      return;
    }
    setPhase({ at: "waiting" });
    let sent = false;
    const onMessage = (e: MessageEvent) => {
      const msg = carryMessage(e, addresses.next, tab);
      if (msg?.type === "hifth-carry-ready" && !sent) {
        sent = true;
        const file = fileRef.current();
        // Where the reader left off goes with the marks, so hifth.app opens there.
        // The record is read only when the box is ticked.
        void Promise.all([readPlace(), withRecord ? readRecord() : undefined]).then(([seam, record]) =>
          tab.postMessage(
            { type: "hifth-carry", file, seam, settings: settingsOf(localStorage), ...(withRecord ? { record } : {}) },
            addresses.next,
          ),
        );
      } else if (msg?.type === "hifth-carry-done") {
        store(CARRIED_KEY, String(msg.added));
        if (withRecord) {
          store(RECORD_KEY, String(Date.now()));
          setRecordSent(true);
          setWithRecord(false);
        }
        setPhase({ at: "carried", added: msg.added, record: withRecord });
        stop.current?.();
      }
    };
    const timer = window.setTimeout(() => {
      setPhase({ at: "failed" });
      stop.current?.();
    }, CARRY_WAIT_MS);
    window.addEventListener("message", onMessage);
    stop.current = () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
      stop.current = null;
    };
  }, [addresses, withRecord]);

  const later = useCallback(() => {
    stop.current?.();
    store(LATER_KEY, String(Date.now()));
    onHide();
  }, [onHide]);

  const line =
    phase.at === "carried"
      ? phase.record
        ? `${t.movedCarried(phase.added)}${t.sep}${t.movedRecordSent}`
        : t.movedCarried(phase.added)
      : phase.at === "waiting"
        ? t.movedWaiting
        : phase.at === "failed"
          ? t.movedFailed
          : t.movedBody;

  return (
    <section className={styles.card} aria-labelledby="moved-title" data-testid="moved-sheet">
      <h2 id="moved-title" className={styles.title}>
        {t.movedTitle}
      </h2>
      <p className={styles.body} role="status">
        {line}
      </p>
      {recordSent || phase.at === "waiting" ? null : (
        <label className={styles.record}>
          <input type="checkbox" checked={withRecord} onChange={(e) => setWithRecord(e.target.checked)} />
          {t.movedRecordBox}
        </label>
      )}
      <div className={styles.actions}>
        {phase.at === "failed" ? (
          <button type="button" className={styles.primary} onClick={onSave}>
            {t.bmSave}
          </button>
        ) : (carried || phase.at === "carried") && !withRecord ? (
          <a className={styles.primary} href={addresses.page}>
            {t.movedOpen}
          </a>
        ) : (
          <button type="button" className={styles.primary} onClick={carry} disabled={phase.at === "waiting"}>
            {carried || phase.at === "carried" ? t.movedRecordSend : t.movedCarry}
          </button>
        )}
        <button type="button" className={styles.secondary} onClick={later}>
          {t.movedLater}
        </button>
      </div>
    </section>
  );
}
