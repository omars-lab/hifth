/**
 * The web app's one window onto the Mac / iPad shell (`native/`).
 *
 * The shell injects `window.__HIFTH_NATIVE__` at document start — before any
 * of our script runs — and registers a single WebKit message handler named
 * `hifth`. Everything that differs inside the shell goes through this file, so
 * a reader of `pwa.ts` or `ShareSheet.tsx` sees one `isNative()` branch and
 * can follow it here. In a browser every function is a no-op that says so.
 *
 * What the shell needs from the page, and why:
 *  - `ready`: the resolver exists, so a route set from Swift will actually
 *    turn to the verse instead of being parsed into nothing. The shell holds a
 *    `hifth://` link that arrived early until it hears this.
 *  - `route`: every hash the app shows. The shell mirrors it into a native
 *    label and the window title, which is what screenshots and the native
 *    tests wait on — they cannot read the page's own URL bar, there is none.
 *  - `share`: the shell's own share sheet. Inside a custom-scheme origin the
 *    page is not a secure context, so `navigator.share` and the clipboard are
 *    both missing, and a share button that silently did nothing would be the
 *    first thing a tester pressed.
 *
 * What the page needs from the shell: `publicBase`, the site's real address.
 * A link built from `location.origin` inside the shell would read
 * `hifth-app://app/…` and be dead for everyone it was sent to.
 */

export interface NativeInfo {
  readonly platform: "ios" | "macos";
  /** The public site's base, e.g. `https://blog.bytesofpurpose.com/hifth/`. */
  readonly publicBase: string;
}

export type NativeMessage =
  | { type: "ready" }
  | { type: "route"; hash: string }
  | { type: "share"; url: string; title: string; text: string };

type Handler = { postMessage: (m: unknown) => void };
type Shelled = Window & {
  __HIFTH_NATIVE__?: unknown;
  webkit?: { messageHandlers?: Record<string, Handler | undefined> };
};

/** The shell's marker, if it is well-formed; `null` in a browser. */
export function nativeInfo(): NativeInfo | null {
  const raw = (window as Shelled).__HIFTH_NATIVE__;
  if (!raw || typeof raw !== "object") return null;
  const { platform, publicBase } = raw as Partial<NativeInfo>;
  if (platform !== "ios" && platform !== "macos") return null;
  if (typeof publicBase !== "string" || publicBase === "") return null;
  return { platform, publicBase };
}

export function isNative(): boolean {
  return nativeInfo() !== null;
}

/**
 * Where a shared link starts: this page's own address in a browser, the
 * public site inside the shell. Always ends in `/`, so callers append the
 * serialized hash and nothing else.
 */
export function shareBase(): string {
  const info = nativeInfo();
  if (!info) return window.location.origin + window.location.pathname;
  return info.publicBase.endsWith("/")
    ? info.publicBase
    : info.publicBase + "/";
}

function post(message: NativeMessage): boolean {
  if (!isNative()) return false;
  const handler = (window as Shelled).webkit?.messageHandlers?.hifth;
  if (!handler) return false;
  handler.postMessage(message);
  return true;
}

/** Ask the shell to show its share sheet. `false` means "not in the shell". */
export function nativeShare(data: {
  url: string;
  title: string;
  text: string;
}): boolean {
  return post({
    type: "share",
    url: data.url,
    title: data.title,
    text: data.text,
  });
}

/** The app can now take a route (its resolver exists). */
export function postReady(): void {
  post({ type: "ready" });
}

/** The hash the app is showing, every time it changes. */
export function postRoute(hash: string): void {
  post({ type: "route", hash });
}
