import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { isNative } from "../native-bridge";
import {
  ADDRESSES_KEY,
  CARRIED_KEY,
  CARRY_HASH,
  CARRY_WAIT_MS,
  LATER_KEY,
  addressesFor,
  carryMessage,
  sheetOn,
  sheetShows,
  sheetState,
  type Addresses,
} from "../moved";
import styles from "./MovedSheet.module.css";

function stored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Nothing to keep it in: the sheet simply asks again next time.
  }
}

interface MovedSheetProps {
  /** The same file "Save to a file" writes, as text. */
  file: () => string;
  /** "Save to a file", for when hifth.app does not answer. */
  onSave: () => void;
}

type Phase = { at: "ask" } | { at: "waiting" } | { at: "carried"; added: number } | { at: "failed" };

/**
 * The old address's half of carrying marks across (moved.ts says the whole of it).
 * Shown only at the old address, in a browser, once the switch is on.
 *
 * "Carry them" opens hifth.app/read in a new tab — inside the press, so the
 * browser allows it — waits for it to say it is ready, and sends it the file,
 * to that address only. If it has not answered after a while, or the browser
 * kept the tab from opening, the card offers to save the file instead.
 */
export function MovedSheet({ file, onSave }: MovedSheetProps): JSX.Element | null {
  const { t } = useT();
  const [addresses] = useState<Addresses>(() => addressesFor(window.location.protocol, stored(ADDRESSES_KEY)));
  const [shown, setShown] = useState(() =>
    sheetShows({
      on: sheetOn(addresses),
      native: isNative(),
      origin: window.location.origin,
      laterAt: Number(stored(LATER_KEY)) || null,
      now: Date.now(),
      addresses,
    }),
  );
  const [phase, setPhase] = useState<Phase>({ at: "ask" });
  const carried = sheetState(stored(CARRIED_KEY)) === "open";
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
        tab.postMessage({ type: "hifth-carry", file: fileRef.current() }, addresses.next);
      } else if (msg?.type === "hifth-carry-done") {
        store(CARRIED_KEY, String(msg.added));
        setPhase({ at: "carried", added: msg.added });
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
  }, [addresses]);

  const later = useCallback(() => {
    stop.current?.();
    store(LATER_KEY, String(Date.now()));
    setShown(false);
  }, []);

  if (!shown) return null;

  const line =
    phase.at === "carried"
      ? t.movedCarried(phase.added)
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
      <div className={styles.actions}>
        {phase.at === "failed" ? (
          <button type="button" className={styles.primary} onClick={onSave}>
            {t.bmSave}
          </button>
        ) : carried || phase.at === "carried" ? (
          <a className={styles.primary} href={addresses.page}>
            {t.movedOpen}
          </a>
        ) : (
          <button type="button" className={styles.primary} onClick={carry} disabled={phase.at === "waiting"}>
            {t.movedCarry}
          </button>
        )}
        <button type="button" className={styles.secondary} onClick={later}>
          {t.movedLater}
        </button>
      </div>
    </section>
  );
}
