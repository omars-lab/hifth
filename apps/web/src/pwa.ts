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
}
