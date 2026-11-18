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
 *  - `ask`: a question the page waits on (`askApp`), for what only the app
 *    can do, such as Apple's sign-in sheet. The app always answers, through
 *    `window.__HIFTH_ANSWER__`, with the question's id; WebKit's own way of
 *    replying to a message was not relied on, since Apple's page does not say
 *    how the page receives it (sign-in ⑤).
 *
 * What the page needs from the shell: `publicBase`, the site's real address.
 * A link built from `location.origin` inside the shell would read
 * `hifth-app://app/…` and be dead for everyone it was sent to.
 *
 * And the one thing the shell asks of the page: turn it. The Mac's Page menu
 * (Next Page ⌘←, Previous Page ⌘→) cannot send a key the app would take —
 * modified keys are ignored on purpose, see core's keymap — so the page hands
 * the shell its own `stepPage` under `window.__HIFTH_PAGE__`, inside the
 * shell only, and the shell calls it by name (`ShellModel.stepPage`).
 * The iPad app hands the Apple Pencil's double-tap and squeeze the same way,
 * to `pencil`, since a web page never hears either (`ShellModel.pencil`,
 * pencil.ts).
 */

export interface NativeInfo {
  readonly platform: "ios" | "macos";
  /** The public site's base, e.g. `https://blog.bytesofpurpose.com/hifth/`. */
  readonly publicBase: string;
  /**
   * The app's version and build, e.g. `0.1.0 (1)`, for the reader's problem
   * report (`problem-report.ts`). Optional: an app built before it was added
   * leaves it out, and the report then says no version.
   */
  readonly appVersion?: string;
}

export type NativeMessage =
  | { type: "ready" }
  | { type: "route"; hash: string }
  | { type: "share"; url: string; title: string; text: string }
  | { type: "ask"; id: string; name: string; text?: string };

type Handler = { postMessage: (m: unknown) => void };
type Shelled = Window & {
  __HIFTH_NATIVE__?: unknown;
  __HIFTH_PAGE__?: PageApi;
  __HIFTH_ANSWER__?: (id: string, answer: unknown) => void;
  webkit?: { messageHandlers?: Record<string, Handler | undefined> };
};

/** What the page lets the shell do to it. */
export interface PageApi {
  /** Turn one page: `1` is the next page (to the left), `-1` the previous. */
  readonly stepPage: (step: 1 | -1) => void;
  /** A pencil gesture, as the app sends it: checked by `pencilGesture`. */
  readonly pencil: (gesture: unknown) => void;
}

/** The shell's marker, if it is well-formed; `null` in a browser. */
export function nativeInfo(): NativeInfo | null {
  const raw = (window as Shelled).__HIFTH_NATIVE__;
  if (!raw || typeof raw !== "object") return null;
  const { platform, publicBase, appVersion } = raw as Partial<NativeInfo>;
  if (platform !== "ios" && platform !== "macos") return null;
  if (typeof publicBase !== "string" || publicBase === "") return null;
  return typeof appVersion === "string" && appVersion !== ""
    ? { platform, publicBase, appVersion }
    : { platform, publicBase };
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

/**
 * Questions waiting for the app's answer, by id. The id starts with a mark
 * picked once per page load, so an answer meant for a page that has since
 * reloaded never settles a new question that happens to share its number.
 * The ids only have to differ from each other, not be hard to guess.
 */
const waiting = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (e: Error) => void }
>();
const loadMark = Math.random().toString(36).slice(2, 8);
let asked = 0;

/** The door the app answers through, from Swift: `ShellModel.answerScript`. */
function receiveAnswer(id: string, answer: unknown): void {
  const question = waiting.get(id);
  if (!question) return; // nobody is waiting: a stray, or a second answer
  waiting.delete(id);
  const a = answer as { ok?: unknown; value?: unknown; error?: unknown } | null;
  if (a && typeof a === "object" && a.ok === true) question.resolve(a.value);
  else if (a && typeof a === "object" && a.ok === false)
    question.reject(new Error(typeof a.error === "string" ? a.error : "no"));
  else question.reject(new Error("bad-answer"));
}

/**
 * Ask the app a question and wait for its answer (sign-in step 7). The app
 * answers every question it is sent, a no included, so by default this waits
 * as long as it takes: a question like signing in waits on a person at
 * Apple's sheet. `waitMs` gives up sooner, for a question that should be quick.
 * Outside the app it fails at once with `not-in-app`. `text` is one short line
 * the question carries, such as the invite code a tester typed with `sign-in`.
 *
 * The answer comes back through `window.__HIFTH_ANSWER__`, put in place here
 * before the first question leaves, never through `__HIFTH_PAGE__`, which the
 * page's own handlers take down and put back between renders.
 */
export function askApp(
  name: string,
  { waitMs, text }: { waitMs?: number; text?: string } = {},
): Promise<unknown> {
  if (!isNative()) return Promise.reject(new Error("not-in-app"));
  const w = window as Shelled;
  w.__HIFTH_ANSWER__ = receiveAnswer;
  asked += 1;
  const id = `${loadMark}-${asked}`;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    if (waitMs !== undefined)
      setTimeout(() => {
        if (waiting.delete(id)) reject(new Error("no-answer"));
      }, waitMs);
    if (!post(text === undefined ? { type: "ask", id, name } : { type: "ask", id, name, text })) {
      waiting.delete(id);
      reject(new Error("not-in-app"));
    }
  });
}

/**
 * Let the shell turn the page. Returns the teardown; outside the shell it
 * exposes nothing and the teardown does nothing. A later exposure replaces an
 * earlier one, and only its own teardown removes it, so a re-render that
 * exposes fresh handlers before the old effect cleans up never leaves the
 * menu pointing at nothing.
 */
export function exposeToShell(api: PageApi): () => void {
  if (!isNative()) return () => {};
  const w = window as Shelled;
  w.__HIFTH_PAGE__ = api;
  return () => {
    if (w.__HIFTH_PAGE__ === api) delete w.__HIFTH_PAGE__;
  };
}
