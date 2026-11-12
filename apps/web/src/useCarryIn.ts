import { useEffect, useRef } from "react";
import { ADDRESSES_KEY, ARRIVED_KEY, CARRY_HASH, addressesFor, carryMessage, laySettings, newerSeam, type CarriedSeam, type CarryPlace } from "./moved";

/*
 * The link the page was opened with, read once when the app's code first runs.
 * The app writes its own place into the link as soon as it starts, so by the
 * time the bookmarks have loaded the carry's "#/carry" may be gone from it.
 */
/** How long the reloaded page waits before saying what came across. */
const ARRIVED_AFTER_MS = 1500;

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
 * bookmarks, notes and jumps saved in this browser have loaded, tells the old page it is ready,
 * takes the file it sends, loads it the way "Load from a file" does, and says how
 * many items came across. It listens only to the window that opened it, and only
 * at the old address; anything else is ignored.
 *
 * `load` returns how many items the file added, or null when it was not a
 * bookmark file (nothing then goes back, and the old page offers the file
 * instead once it has waited long enough).
 *
 * Where the reader left off comes with the file. The new address keeps whichever
 * place moved last, its own or the carried one, and `go` turns to it, so a hafiz
 * does not land on the first page and hunt for their place. `go` says false for a
 * page this edition does not have, and then the place is not kept.
 */
export function useCarryIn(
  loaded: boolean,
  load: (file: string) => number | null,
  go: (page: number) => boolean,
  place: CarryPlace,
  saved: () => Promise<unknown>,
  arrived: (added: number) => void,
  openedWith = OPENED_WITH,
): void {
  const loadRef = useRef(load);
  loadRef.current = load;
  const goRef = useRef(go);
  goRef.current = go;
  const done = useRef(false);
  // This address's own place, read as the tab opens. Read later, it could be the
  // first page this tab itself recorded while waiting for the old one (a page
  // counts as read after a few seconds), which would beat the carried place.
  const ownAtOpen = useRef<Promise<CarriedSeam | null> | null>(null);
  if (ownAtOpen.current === null && openedWith === CARRY_HASH) ownAtOpen.current = place.read();
  const placeRef = useRef(place);
  placeRef.current = place;
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const arrivedRef = useRef(arrived);
  arrivedRef.current = arrived;

  // After the reload that lays the settings, say again what came across. The
  // reloaded page first says which page it opened at, and only one line is
  // spoken at a time, so this one waits until that has been said.
  useEffect(() => {
    if (!loaded) return;
    const later = window.setTimeout(() => {
      try {
        const n = sessionStorage.getItem(ARRIVED_KEY);
        sessionStorage.removeItem(ARRIVED_KEY);
        if (n !== null) arrivedRef.current(Number(n));
      } catch {
        // No session storage: the marks are there, only the line is not.
      }
    }, ARRIVED_AFTER_MS);
    return () => window.clearTimeout(later);
  }, [loaded]);

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
      if (added === null) return;
      opener.postMessage({ type: "hifth-carry-done", added }, addresses.old);
      void ownAtOpen.current?.then((own) => {
        const kept = newerSeam(own, msg.seam);
        // Written even when it is this address's own, since this tab may have
        // recorded its first page over it while it waited.
        const laid = (() => {
          try {
            return laySettings(localStorage, msg.settings);
          } catch {
            return 0;
          }
        })();
        const placed = kept && goRef.current(kept.page) ? placeRef.current.write(kept) : null;
        // Settings are read as the app starts, so they show after a reload; it
        // waits for the marks and the place to reach disk, or it would cut them off.
        if (laid)
          void Promise.all([placed, savedRef.current()]).then(() => {
            try {
              sessionStorage.setItem(ARRIVED_KEY, String(added));
            } catch {
              // The reload still shows the settings; only the line is lost.
            }
            window.location.reload();
          });
      });
    };
    window.addEventListener("message", onMessage);
    opener.postMessage({ type: "hifth-carry-ready" }, addresses.old);
    return () => window.removeEventListener("message", onMessage);
  }, [loaded, openedWith]);
}
