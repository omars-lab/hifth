/**
 * PWA registration + install-prompt capture.
 *
 * Research §4/§5: on iOS, installing to the Home Screen is effectively a
 * prerequisite for durable offline (ITP deletes script storage after 7 days for
 * non-installed origins). So the install prompt is a first-class feature, not a
 * nicety. Loop 0 scaffolds the capture + a subscribe hook; the full pin-a-juz
 * + persist() flow is Loop 6.
 */
import { registerSW } from "virtual:pwa-register";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<(available: boolean) => void>();

function emit(available: boolean): void {
  for (const fn of listeners) fn(available);
}

/** Subscribe to install-availability changes. Returns an unsubscribe fn. */
export function onInstallAvailability(fn: (available: boolean) => void): () => void {
  listeners.add(fn);
  fn(deferredPrompt !== null);
  return () => listeners.delete(fn);
}

/** Trigger the captured install prompt. No-op if none is available. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  emit(false);
  return outcome;
}

/**
 * True on iPhone/iPad, where `beforeinstallprompt` does not exist and install
 * is therefore instructional: Share → "Add to Home Screen". Every iOS browser
 * is WebKit underneath and every one of them inherits ITP's 7-day deletion of
 * script storage, so this is the platform where install decides whether offline
 * is real (research §5a) — hence a coached flow rather than a hidden button.
 *
 * iPadOS 13+ reports a desktop-Safari UA, so it is caught by the touch-capable
 * "Macintosh" case rather than by the device string.
 */
export function isIosDevice(): boolean {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

/*
 * Known and NOT worked around (research §6): on iOS a tapped web link cannot
 * open an installed PWA — a shared hop link opens a Safari tab, even when Hifth
 * is on the Home Screen, and the tab is a separate storage-and-state world from
 * the installed app. There is no script-side fix; Track B's Universal Links are
 * the real one. The consequence for this loop is a copy rule: never promise
 * that a shared link will open the installed app.
 */

/** True when running as an installed standalone PWA. */
export function isStandalone(): boolean {
  return (
    // A platform sniff must never be the thing that takes the app down: jsdom
    // (and a couple of embedded webviews) ship without matchMedia, and "we
    // can't tell" means "not installed", not a crash.
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches) ||
    // iOS Safari non-standard flag.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * True when the precache still holds the app shell — i.e. a cold start with no
 * network would render something.
 *
 * `index.html` is the navigation fallback, so it is precisely the entry whose
 * absence turns an offline launch into the browser's own error page. Asking the
 * caches for it is a behavioural question ("can I still boot offline?") rather
 * than a structural one, which is why this does not look for
 * `workbox-precache-v2-…` by name: that name is workbox's private business and
 * would make a version bump look like an eviction.
 *
 * `ignoreSearch` because workbox keys unhashed precache entries with a
 * `?__WB_REVISION__=…` query it alone knows.
 */
export async function shellCached(): Promise<boolean> {
  if (!("caches" in globalThis)) return false;
  try {
    return (await caches.match("index.html", { ignoreSearch: true })) !== undefined;
  } catch {
    // A browser that refuses to answer is not evidence of eviction, and
    // "repair" is the expensive branch. Say intact and leave it alone.
    return true;
  }
}

/**
 * Marks that this tab has already spent its one repair. Session-scoped on
 * purpose: the repair ends in a reload, so the only thing that can stop a boot
 * loop is a flag that survives the reload and dies with the tab.
 */
const REPAIR_FLAG = "hifth:shell-repair";

/** `true` if the flag was written and can be read back — see repairShellCache. */
function markRepairAttempted(): boolean {
  try {
    sessionStorage.setItem(REPAIR_FLAG, "1");
    return sessionStorage.getItem(REPAIR_FLAG) === "1";
  } catch {
    return false;
  }
}

function repairAlreadyAttempted(): boolean {
  try {
    return sessionStorage.getItem(REPAIR_FLAG) === "1";
  } catch {
    return false;
  }
}

function clearRepairFlag(): void {
  try {
    sessionStorage.removeItem(REPAIR_FLAG);
  } catch {
    /* nothing to clear if we could never write it */
  }
}

/**
 * Rebuild the precache after the browser has evicted it. Returns `true` if the
 * shell is cached on return; a repair that has to reload navigates away instead
 * of returning.
 *
 * **Why this has to exist.** Workbox fills the precache in the service worker's
 * `install` handler. Eviction does not uninstall the worker — it takes the
 * bytes and leaves the registration — so the worker never installs again and
 * the precache is never refilled. The runtime caches (pages, data) *do* refill
 * on demand, so from every online signal the app looks perfectly healthy: the
 * mushaf renders, hops work, nothing is logged. The damage shows up only once
 * the reader is offline, as the browser's own error page, because `index.html`
 * is gone and there is nothing left to boot from.
 *
 * So one eviction ended offline support permanently — until a deploy happened
 * to ship new `sw.js` bytes. On iOS that is a 7-day ITP timer, which means the
 * default outcome for an uninstalled origin was that offline quietly stopped
 * working and Loop 6a's promise ("a page you have visited still opens when the
 * network is gone") was false with nothing anywhere going red.
 *
 * **Why the reload.** Measured, not assumed — every step below was probed
 * against a real `Storage.clearDataForOrigin` (research ④, §3.3):
 *   • three reloads alone → precache still empty;
 *   • `registration.update()` → no new worker at all, because the `sw.js` bytes
 *     are identical, so no `install`, so no precache;
 *   • `unregister()` then `register()` in the same page → the registration
 *     comes straight back as `activated` with `installing` never set. The old
 *     worker was still controlling this client, so unregistration only takes
 *     effect once that client goes away, and re-registering the same script URL
 *     resurrects it. Still no `install`.
 * Dropping the last client is the step that makes the next registration a
 * genuine first install, and a reload is how a page drops itself. It is a real
 * cost — one flash at startup — paid at most once per tab, only after an actual
 * eviction, and only when there is a network to refill from.
 *
 * Guarded on being online: unregistering is destructive, and doing it offline
 * would trade a broken cold start for no service worker at all. Offline, the
 * honest move is to leave the wreckage alone and repair on the next connected
 * boot.
 */
export async function repairShellCache(): Promise<boolean> {
  if (await shellCached()) {
    // Intact — including "intact again, because the reload below worked". This
    // is also the only place the flag is cleared, so a *second* eviction later
    // in the same session still gets its own repair.
    clearRepairFlag();
    return true;
  }
  if (!("serviceWorker" in navigator)) return false;
  // `navigator.onLine` false is a reliable "definitely offline"; true only means
  // "an interface is up". That asymmetry is the right way round here — the cost
  // of a wrong `true` is a reload that fails to refill and is not retried.
  if (!navigator.onLine) return false;
  if (repairAlreadyAttempted()) return false;

  const regs = await navigator.serviceWorker.getRegistrations();
  if (regs.length === 0) return false;

  // Write the flag *before* the destructive part, and only proceed if it can be
  // read back. Without durable storage (private mode, storage disabled) there is
  // nothing to break the loop, and an app that reloads itself forever is worse
  // than one that cannot boot offline.
  if (!markRepairAttempted()) return false;

  await Promise.all(regs.map((r) => r.unregister()));
  location.reload();
  return false;
}

export function initPwa(): void {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
    emit(true);
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    emit(false);
  });
  // Prompt-type registration: the SW updates in the background; Loop 6 surfaces
  // an "update ready" affordance. For Loop 0 we just register.
  registerSW({ immediate: true });

  if (!("serviceWorker" in navigator)) return;
  // Only meaningful once a worker is actually controlling this page: before
  // that, an empty cache is a first visit rather than an eviction, and the
  // first visit's own install is already on its way to filling it.
  void navigator.serviceWorker.ready.then(() => void repairShellCache());
}
