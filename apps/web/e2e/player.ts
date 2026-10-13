import type { Page } from "@playwright/test";

/**
 * A stand-in for the browser's player: no sound in a test runner, so play and
 * pause flip a flag and send the events a real player sends, and the test ends
 * or fails the verse when it chooses. `files` lists each file the app asked for.
 *
 * A run fetches its next verse's file early (docs/PLAN.md, item 63). The page
 * answers that itself, with `recitation` as the file's bytes (none unless
 * given), because a page the offline helper controls can send a fetch past
 * the test's own network on some browsers. `asked` lists the files fetched so.
 * A browser the test has taken offline is refused every file, as it would be.
 */
export async function fakePlayer(
  page: Page,
  { recitation = "" }: { recitation?: string } = {},
): Promise<{
  files: () => Promise<string[]>;
  asked: () => Promise<string[]>;
  end: () => Promise<void>;
  fail: () => Promise<void>;
}> {
  await page.addInitScript((recitation: string) => {
    const w = window as unknown as { __files: string[]; __asked: string[]; __player?: HTMLMediaElement };
    w.__files = [];
    w.__asked = [];
    const fetched = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (!url.startsWith("https://verses.quran.com/")) return fetched(input, init);
      w.__asked.push(url.replace(/^.*\//, ""));
      // A browser the test has taken offline gets no file, as a real one would not.
      if (!navigator.onLine) return Promise.reject(new TypeError("Failed to fetch"));
      return Promise.resolve(new Response(recitation, { status: 200, headers: { "content-type": "audio/mpeg" } }));
    };
    const still = new WeakMap<HTMLMediaElement, boolean>();
    const failed = new WeakMap<HTMLMediaElement, MediaError>();
    const proto = HTMLMediaElement.prototype;
    Object.defineProperty(proto, "paused", {
      configurable: true,
      get(this: HTMLMediaElement) {
        return still.get(this) ?? true;
      },
    });
    Object.defineProperty(proto, "error", {
      configurable: true,
      get(this: HTMLMediaElement) {
        return failed.get(this) ?? null;
      },
    });
    proto.play = function (this: HTMLMediaElement) {
      w.__player = this;
      still.set(this, false);
      setTimeout(() => this.dispatchEvent(new Event("playing")), 0);
      return Promise.resolve();
    };
    proto.pause = function (this: HTMLMediaElement) {
      if (still.get(this) === false) {
        still.set(this, true);
        this.dispatchEvent(new Event("pause"));
      }
    };
    // The made-up bytes are not sound, and the real element says so with an
    // error of its own; only a failure the test asks for is passed on.
    const listen = proto.addEventListener;
    proto.addEventListener = function (this: HTMLMediaElement, type: string, fn: EventListenerOrEventListenerObject, opts?: boolean | AddEventListenerOptions) {
      if (type !== "error" || typeof fn !== "function") return listen.call(this, type, fn, opts);
      return listen.call(this, type, function (this: HTMLMediaElement, e: Event) {
        if (failed.has(this)) fn.call(this, e);
      }, opts);
    } as typeof proto.addEventListener;
    const src = Object.getOwnPropertyDescriptor(proto, "src")!;
    Object.defineProperty(proto, "src", {
      ...src,
      set(this: HTMLMediaElement, v: string) {
        w.__files.push(String(v).replace(/^.*\//, ""));
        failed.delete(this);
        src.set!.call(this, v);
      },
    });
    (w as unknown as { __fail: () => void }).__fail = () => {
      const el = w.__player!;
      still.set(el, true);
      failed.set(el, { code: 2, message: "network" } as MediaError);
      el.dispatchEvent(new Event("error"));
    };
  }, recitation);
  await page.route("https://verses.quran.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "audio/mpeg", body: "" }),
  );
  return {
    files: () => page.evaluate(() => (window as unknown as { __files: string[] }).__files),
    asked: () => page.evaluate(() => (window as unknown as { __asked: string[] }).__asked),
    end: () =>
      page.evaluate(() => {
        const el = (window as unknown as { __player: HTMLMediaElement }).__player;
        el.pause();
        el.dispatchEvent(new Event("ended"));
      }),
    fail: () => page.evaluate(() => (window as unknown as { __fail: () => void }).__fail()),
  };
}
