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

/** True when running as an installed standalone PWA. */
export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
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
