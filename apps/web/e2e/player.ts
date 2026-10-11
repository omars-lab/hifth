import type { Page } from "@playwright/test";

/**
 * A stand-in for the browser's player: no sound in a test runner, so play and
 * pause flip a flag and send the events a real player sends, and the test ends
 * or fails the verse when it chooses. `files` lists each file the app asked for.
 */
export async function fakePlayer(page: Page): Promise<{
  files: () => Promise<string[]>;
  end: () => Promise<void>;
  fail: () => Promise<void>;
}> {
  await page.addInitScript(() => {
    const w = window as unknown as { __files: string[]; __player?: HTMLMediaElement };
    w.__files = [];
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
  });
  await page.route("https://verses.quran.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "audio/mpeg", body: "" }),
  );
  return {
    files: () => page.evaluate(() => (window as unknown as { __files: string[] }).__files),
    end: () =>
      page.evaluate(() => {
        const el = (window as unknown as { __player: HTMLMediaElement }).__player;
        el.pause();
        el.dispatchEvent(new Event("ended"));
      }),
    fail: () => page.evaluate(() => (window as unknown as { __fail: () => void }).__fail()),
  };
}
