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
 * How many repairs this document has started. Only ever compared against zero;
 * the count is here because it also supplies the distinct script URL below.
 */
let repairsStarted = 0;

/**
 * Resolve once `worker` has left `installing`, `true` if it got as far as
 * installed. Workbox writes the precache *during* install, one entry at a time,
 * so any earlier answer is a half-filled cache: waiting on the shell alone
 * returns on the first of ten entries and leaves the app's own scripts out.
 */
function awaitInstalled(worker: ServiceWorker, timeoutMs: number): Promise<boolean> {
  const settled = (): boolean | null =>
    worker.state === "installing" ? null : worker.state !== "redundant";
  const now = settled();
  if (now !== null) return Promise.resolve(now);

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    worker.addEventListener("statechange", () => {
      const done = settled();
      if (done === null) return;
      clearTimeout(timer);
      resolve(done);
    });
  });
}

/**
 * Marks that this tab has already spent its one repair *reload*. Session-scoped
 * because the thing it guards survives a reload and must die with the tab.
 *
 * Deliberately not a guard on the repair itself. It used to be one, and that is
 * how a repair that silently did nothing (see below) became permanent: the flag
 * was spent, so no later boot in that tab ever tried again. The refill is now
 * unconditional and only the reload is rationed.
 */
const RELOAD_FLAG = "hifth:shell-repair";

/** `true` if the flag was written and can be read back. */
function claimReload(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG) === "1") return false;
    sessionStorage.setItem(RELOAD_FLAG, "1");
    return sessionStorage.getItem(RELOAD_FLAG) === "1";
  } catch {
    // Without durable storage (private mode, storage disabled) there is nothing
    // to break a loop with, and an app that reloads itself forever is worse than
    // one whose mushaf refills on the next visit.
    return false;
  }
}

/**
 * Rebuild the precache after the browser has evicted it. Returns `true` if the
 * shell is cached on return.
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
 * **Why a second script URL.** The only thing that refills a precache is an
 * `install`, and the only thing that causes an `install` is a worker the
 * registration has not seen. Measured against a real
 * `Storage.clearDataForOrigin` (research ④, §3.3):
 *   • three reloads alone → precache still empty;
 *   • `registration.update()` → no new worker at all: the `sw.js` bytes are
 *     identical, so there is nothing to install;
 *   • `unregister()` then `register()` in the same page → the registration
 *     comes straight back as `activated`, `installing` never set. Unregistering
 *     from a client the registration still controls only sets the uninstalling
 *     flag; the removal waits for that client to go away.
 *   • `unregister()` then `location.reload()` → **a coin flip.** The reload is
 *     what drops the client, so the removal and the reloaded page's own
 *     `register()` race, and `register()` winning is not harmless: it clears
 *     the uninstalling flag and hands back the same already-activated worker.
 *     No `install`, no precache, no controller — and since the repair had spent
 *     its one attempt, offline stayed broken for the life of the tab. Ten runs
 *     of the eviction e2e on one machine: five dead in exactly that state.
 *
 * A URL the registration has never registered is not a race. `sw.js?…` is the
 * same script — same bytes, same precache manifest, same cache name — under a
 * name that makes `register()` mean *install* instead of *acknowledge*. The
 * install refills the shared precache, which is enough on its own: the worker
 * still controlling this page reads that cache, so the shell is back without
 * anything being unregistered and without the new worker having to activate.
 *
 * **Why it still reloads afterwards.** Eviction took the runtime caches too —
 * the mushaf pages and shards this tab has read — and nothing re-requests what
 * is already on screen. Refilling the shell alone would leave a reader who goes
 * offline now with an app that boots to no page. A reload re-fetches what the
 * tab is showing, through the worker, which is what makes "a page you have
 * visited still opens" true again of the page in front of them. It happens only
 * after the precache is confirmed back, so it can no longer be the step that
 * leaves the app broken, and at most once per tab.
 *
 * Guarded on being online, because there is nothing to refill from otherwise;
 * offline the honest move is to leave the wreckage alone and repair on the next
 * connected boot.
 */
export async function repairShellCache(): Promise<boolean> {
  if (await shellCached()) return true;
  if (!("serviceWorker" in navigator)) return false;
  // `navigator.onLine` false is a reliable "definitely offline"; true only means
  // "an interface is up". That asymmetry is the right way round here — the cost
  // of a wrong `true` is an install that fails and is not retried until the next
  // page load.
  if (!navigator.onLine) return false;
  // One per document. A repair that did not work will not work on a retry
  // either, and the next boot gets its own attempt for free.
  if (repairsStarted > 0) return false;

  const reg = await navigator.serviceWorker.getRegistration();
  // Whichever worker the registration knows about — its script URL is where the
  // build actually put `sw.js`, which is the plugin's business rather than ours.
  const script = reg?.active ?? reg?.waiting ?? reg?.installing;
  if (!reg || !script) return false;

  repairsStarted += 1;
  const url = new URL(script.scriptURL);
  url.searchParams.set("shell-repair", String(repairsStarted));

  let installing: ServiceWorker | null = null;
  try {
    // `register()` resolves when the job is accepted, not when the worker has
    // finished installing, and it is the install that does the refilling — so
    // what this waits on afterwards is the new worker, not the registration.
    const next = await navigator.serviceWorker.register(url.href, { scope: reg.scope });
    installing = next.installing ?? next.waiting ?? next.active;
  } catch {
    return false;
  }
  if (!installing) return false;
  if (!(await awaitInstalled(installing, 30_000))) return false;

  if (!(await shellCached())) return false;
  if (claimReload()) location.reload();
  return true;
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
