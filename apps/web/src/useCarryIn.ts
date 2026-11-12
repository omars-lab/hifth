import { useEffect, useRef } from "react";
import { ADDRESSES_KEY, CARRY_HASH, addressesFor, carryMessage } from "./moved";

/*
 * The link the page was opened with, read once when the app's code first runs.
 * The app writes its own place into the link as soon as it starts, so by the
 * time the bookmarks have loaded the carry's "#/carry" may be gone from it.
 */
const OPENED_WITH = typeof window === "undefined" ? "" : window.location.hash;

function storedAddresses(): string | null {
  try {
    return window.localStorage.getItem(ADDRESSES_KEY);
  } catch {
    return null;
  }
}

/**
 * The new address's half of carrying marks across (moved.ts says the whole of it).
 *
 * When this page was opened by the old address for the carry, it waits until the
 * bookmarks saved in this browser have loaded, tells the old page it is ready,
 * takes the file it sends, loads it the way "Load from a file" does, and says how
 * many items came across. It listens only to the window that opened it, and only
 * at the old address; anything else is ignored.
 *
 * `load` returns how many items the file added, or null when it was not a
 * bookmark file (nothing then goes back, and the old page offers the file
 * instead once it has waited long enough).
 */
export function useCarryIn(loaded: boolean, load: (file: string) => number | null, openedWith = OPENED_WITH): void {
  const loadRef = useRef(load);
  loadRef.current = load;
  const done = useRef(false);

  useEffect(() => {
    if (!loaded || done.current || openedWith !== CARRY_HASH) return;
    const addresses = addressesFor(window.location.protocol, storedAddresses());
    const opener = window.opener as Window | null;
    if (window.location.origin !== addresses.next || !opener) return;

    const onMessage = (e: MessageEvent) => {
      const msg = carryMessage(e, addresses.old, opener);
      if (msg?.type !== "hifth-carry" || done.current) return;
      done.current = true;
      const added = loadRef.current(msg.file);
      // A reload of this page must not take the file again.
      if (window.location.hash === CARRY_HASH)
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      if (added !== null) opener.postMessage({ type: "hifth-carry-done", added }, addresses.old);
    };
    window.addEventListener("message", onMessage);
    opener.postMessage({ type: "hifth-carry-ready" }, addresses.old);
    return () => window.removeEventListener("message", onMessage);
  }, [loaded, openedWith]);
}
