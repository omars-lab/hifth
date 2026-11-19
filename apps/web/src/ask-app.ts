/**
 * Questions the page asks the app and waits on (sign-in step 7), such as
 * Apple's sign-in sheet. The message shape and the door it leaves by are in
 * native-bridge.ts; this half lives in its own file so it loads with the
 * account section, which is its only user, and not with the first page
 * (the start-up size check, scripts/gate-budget.mjs).
 */
import { isNative, post } from "./native-bridge";

type Answered = Window & { __HIFTH_ANSWER__?: (id: string, answer: unknown) => void };

/**
 * Questions waiting for the app's answer, by id. The id starts with a mark
 * picked once per page load, so an answer meant for a page that has since
 * reloaded never settles a new question that happens to share its number.
 * The ids only have to differ from each other, not be hard to guess.
 */
const waiting = new Map<string, { resolve: (value: unknown) => void; reject: (e: Error) => void }>();
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
 * Ask the app a question and wait for its answer. The app answers every
 * question it is sent, a no included, so by default this waits as long as it
 * takes: a question like signing in waits on a person at Apple's sheet.
 * `waitMs` gives up sooner, for a question that should be quick. Outside the
 * app it fails at once with `not-in-app`. `text` is one short line the
 * question carries, such as the invite code a tester typed with `sign-in`.
 *
 * The answer comes back through `window.__HIFTH_ANSWER__`, put in place here
 * before the first question leaves, never through `__HIFTH_PAGE__`, which the
 * page's own handlers take down and put back between renders.
 */
export function askApp(name: string, { waitMs, text }: { waitMs?: number; text?: string } = {}): Promise<unknown> {
  if (!isNative()) return Promise.reject(new Error("not-in-app"));
  (window as Answered).__HIFTH_ANSWER__ = receiveAnswer;
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
