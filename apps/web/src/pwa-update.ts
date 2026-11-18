/**
 * A new version is ready (launch item 24).
 *
 * The offline worker of a new release installs beside the old one and then
 * waits, because the open page was built against the old one's files. Until
 * 2026-11-17 it waited until every tab closed, which on a phone that keeps the
 * app open for weeks meant a fix might never arrive. Now the reader is told, and
 * chooses when: "Reload" asks the waiting worker to take over, then opens the
 * page again.
 *
 * Not an update: the first visit's own install (there was no old worker to
 * replace), and the second copy the shell repair registers under another name
 * (its bytes are the same release, and it is left waiting on purpose).
 *
 * Kept out of the start-up script, which has under a kilobyte to spare: pwa.ts
 * imports this once the worker is registered, and holds only the flag.
 */
import { markUpdateReady } from "./pwa";

let waitingWorker: ServiceWorker | null = null;
let applying = false;

const isRepairCopy = (w: ServiceWorker): boolean =>
  new URL(w.scriptURL).searchParams.has("shell-repair");

/** Watch `reg` for a new release's worker waiting to take over from the one running this page. */
export function watchForUpdate(reg: ServiceWorkerRegistration): void {
  const sw = navigator.serviceWorker;
  const hadController = sw.controller !== null;
  const offer = (w: ServiceWorker | null): void => {
    if (!w || isRepairCopy(w) || !sw.controller) return;
    waitingWorker = w;
    markUpdateReady();
  };
  offer(reg.waiting);
  reg.addEventListener("updatefound", () => {
    const w = reg.installing;
    if (!w) return;
    w.addEventListener("statechange", () => {
      if (w.state === "installed") offer(w);
    });
  });
  // "Reload" pressed in another tab: the new worker has taken over this tab too
  // (the build claims every open tab), and this page is still the old release.
  // Say so here as well; the files it still asks for are kept for one release.
  sw.addEventListener("controllerchange", () => {
    if (applying || !hadController) return;
    waitingWorker = null;
    markUpdateReady();
  });
  // A page left open for days would only learn of a release when the browser
  // happens to check. Look again when the reader comes back to it, at most
  // once an hour.
  let checked = Date.now();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || Date.now() - checked < 3_600_000) return;
    checked = Date.now();
    void reg.update().catch(() => undefined);
  });
}

/**
 * Start using the new version: the waiting worker takes over, then the page
 * opens again. With no worker waiting (another tab already switched), it only
 * opens the page again.
 */
export function applyUpdate(reload: () => void = () => location.reload()): void {
  if (applying) return;
  applying = true;
  if (!waitingWorker) return reload();
  // Not before the new worker runs the page, or the reload would come back to
  // the old one.
  navigator.serviceWorker.addEventListener("controllerchange", () => reload(), { once: true });
  waitingWorker.postMessage({ type: "SKIP_WAITING" });
}
