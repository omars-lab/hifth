import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/preact";
import type { AppState } from "@hifth/core";
import { useHashRouter } from "./useHashRouter";
import { clearSteps, recentSteps } from "./step-log";

/**
 * The shell has no address bar, so the hash router tells it two things: when
 * the app is ready to take a route, and every route it then shows. Those two
 * messages are what the shell's route label, window title, screenshots and
 * native tests all hang off, so they are pinned here at the hook.
 */

type Shelled = Window & {
  __HIFTH_NATIVE__?: unknown;
  webkit?: {
    messageHandlers?: Record<string, { postMessage: (m: unknown) => void }>;
  };
};
const w = window as Shelled;

afterEach(() => {
  delete w.__HIFTH_NATIVE__;
  delete w.webkit;
  window.history.replaceState(null, "", "#");
});

/**
 * Backlog app-link-it-cannot-place: a link naming no place there is used to do
 * nothing at all. The router now says so through `onNowhere`, and puts back the
 * address of what is still on screen, so the same bad link a second time is a
 * change of address again and is answered again.
 */
describe("useHashRouter and a link that points nowhere", () => {
  const p19: AppState = { edition: "hafs-kfqc", select: null, page: 19 };

  function open(hash: string, onRestore: (s: AppState) => boolean | void = () => {}) {
    window.history.replaceState(null, "", hash);
    let nowhere = 0;
    const view = renderHook(
      ({ state, ready }: { state: AppState | null; ready: boolean }) =>
        useHashRouter(state, onRestore, ready, () => void nowhere++),
      { initialProps: { state: null as AppState | null, ready: false } },
    );
    view.rerender({ state: p19, ready: true });
    return { count: () => nowhere };
  }

  it("a link no place can be read from says so", () => {
    expect(open("#/x").count()).toBe(1);
    expect(open("#/nowhere").count()).toBe(1);
  });

  it("an empty address, a bare #/ and the moved site's hand-over only open the app", () => {
    for (const hash of ["#", "#/", "#/carry", "#/carry?v=1"]) expect(open(hash).count(), hash).toBe(0);
  });

  it("a link the app refuses says so, and does not count as the place it landed", () => {
    const seen = open("#/hafs-kfqc/2:999", () => false);
    expect(seen.count()).toBe(1);
    // The first view writes its own address, since the link was not followed.
    expect(window.location.hash).toBe("#/hafs-kfqc/p19");
  });

  it("the same bad link twice is answered twice, and the address goes back each time", () => {
    const seen = open("#/hafs-kfqc/p19");
    expect(seen.count()).toBe(0);
    for (const n of [1, 2]) {
      window.location.hash = "#/x";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      expect(seen.count()).toBe(n);
      expect(window.location.hash).toBe("#/hafs-kfqc/p19");
    }
  });
});

describe("useHashRouter in the native shell", () => {
  it("posts ready on the ready edge, then every route it writes", () => {
    const sent: unknown[] = [];
    w.__HIFTH_NATIVE__ = { platform: "ios", publicBase: "https://x/" };
    w.webkit = {
      messageHandlers: { hifth: { postMessage: (m) => sent.push(m) } },
    };

    const a: AppState = {
      edition: "hafs-kfqc",
      select: { surah: 2, ayah: 255 },
    };
    const b: AppState = { edition: "hafs-kfqc", select: null, page: 45 };
    const { rerender } = renderHook(
      ({ state, ready }: { state: AppState | null; ready: boolean }) =>
        useHashRouter(state, () => {}, ready),
      { initialProps: { state: null as AppState | null, ready: false } },
    );
    expect(sent).toEqual([]);

    rerender({ state: a, ready: true });
    rerender({ state: b, ready: true });

    expect(sent).toEqual([
      { type: "ready" },
      { type: "route", hash: "#/hafs-kfqc/2:255" },
      { type: "route", hash: "#/hafs-kfqc/p45" },
    ]);
  });

  /**
   * Item ⑧ of native-shell.md: opened cold at a verse, the shell heard
   * "page 1" first and the verse second, because the app's first view (page
   * 1, nothing selected) exists in the same moment the link is read, and was
   * reported — and written over the link in the address bar — before the
   * restore had moved the view. The window title flickered, and a `current`
   * request queued before the first route was answered with page 1.
   */
  describe("opened cold at a link", () => {
    function shell() {
      const sent: unknown[] = [];
      w.__HIFTH_NATIVE__ = { platform: "macos", publicBase: "https://x/" };
      w.webkit = {
        messageHandlers: { hifth: { postMessage: (m) => sent.push(m) } },
      };
      return sent;
    }
    const pageOne: AppState = { edition: "hafs-kfqc", select: null, page: 1 };
    const verse: AppState = { edition: "hafs-kfqc", select: { surah: 2, ayah: 255 } };

    it("the first route the shell hears is the verse the link named, not page 1", () => {
      const sent = shell();
      window.history.replaceState(null, "", "#/hafs-kfqc/2:255");
      const restored: AppState[] = [];
      const { rerender } = renderHook(
        ({ state, ready }: { state: AppState | null; ready: boolean }) =>
          useHashRouter(state, (s) => void restored.push(s), ready),
        { initialProps: { state: null as AppState | null, ready: false } },
      );
      // The resolver arrives: the app's first view is page 1, and the link is
      // read in the same moment. The restore has not moved the view yet.
      rerender({ state: pageOne, ready: true });
      expect(restored).toEqual([verse]);
      expect(sent).toEqual([{ type: "ready" }]);
      expect(window.location.hash).toBe("#/hafs-kfqc/2:255");
      // The restore lands.
      rerender({ state: verse, ready: true });
      expect(sent).toEqual([{ type: "ready" }, { type: "route", hash: "#/hafs-kfqc/2:255" }]);
    });

    it("a link to the page already showing is reported at once, since no restore will move the view", () => {
      const sent = shell();
      window.history.replaceState(null, "", "#/hafs-kfqc/p1?open=jump");
      const { rerender } = renderHook(
        ({ state, ready }: { state: AppState | null; ready: boolean }) =>
          useHashRouter(state, () => {}, ready),
        { initialProps: { state: null as AppState | null, ready: false } },
      );
      rerender({ state: pageOne, ready: true });
      expect(sent).toEqual([{ type: "ready" }, { type: "route", hash: "#/hafs-kfqc/p1" }]);
    });

    it("with no link at all, the first view is reported as before", () => {
      const sent = shell();
      const { rerender } = renderHook(
        ({ state, ready }: { state: AppState | null; ready: boolean }) =>
          useHashRouter(state, () => {}, ready),
        { initialProps: { state: null as AppState | null, ready: false } },
      );
      rerender({ state: pageOne, ready: true });
      expect(sent).toEqual([{ type: "ready" }, { type: "route", hash: "#/hafs-kfqc/p1" }]);
      expect(window.location.hash).toBe("#/hafs-kfqc/p1");
    });

    // Design page app-links-editions-and-builder.md ②: the app refuses a link
    // naming a mus'haf it does not ship, but the website has no caller to
    // answer, so it shows the mus'haf it ships and puts that in the address.
    it("a link naming a mus'haf the site does not have lands on the one it ships, address rewritten", () => {
      const sent = shell();
      window.history.replaceState(null, "", "#/warsh-libya/2:255");
      const restored: AppState[] = [];
      const { rerender } = renderHook(
        ({ state, ready }: { state: AppState | null; ready: boolean }) =>
          useHashRouter(state, (s) => void restored.push(s), ready),
        { initialProps: { state: null as AppState | null, ready: false } },
      );
      rerender({ state: pageOne, ready: true });
      expect(restored).toEqual([verse]);
      rerender({ state: verse, ready: true });
      expect(sent).toEqual([{ type: "ready" }, { type: "route", hash: "#/hafs-kfqc/2:255" }]);
      expect(window.location.hash).toBe("#/hafs-kfqc/2:255");
    });

    it("the skip is spent on the cold open only: a later link is reflected as it lands", () => {
      const sent = shell();
      window.history.replaceState(null, "", "#/hafs-kfqc/2:255");
      const { rerender } = renderHook(
        ({ state, ready }: { state: AppState | null; ready: boolean }) =>
          useHashRouter(state, () => {}, ready),
        { initialProps: { state: null as AppState | null, ready: false } },
      );
      rerender({ state: pageOne, ready: true });
      rerender({ state: verse, ready: true });
      const later: AppState = { edition: "hafs-kfqc", select: null, page: 45 };
      rerender({ state: later, ready: true });
      expect(sent).toEqual([
        { type: "ready" },
        { type: "route", hash: "#/hafs-kfqc/2:255" },
        { type: "route", hash: "#/hafs-kfqc/p45" },
      ]);
    });
  });
});

/**
 * Launch item 19: the problem report lists the reader's last steps by name.
 * The router sees every change of view, so it is where they are noted. A link
 * that moves the view is one step, "opened a link", not also the page turn or
 * verse it lands on.
 */
describe("useHashRouter notes the reader's steps for the problem report", () => {
  // Before, not after: the tests above this block also note steps.
  beforeEach(() => clearSteps());
  const pageOne: AppState = { edition: "hafs-kfqc", select: null, page: 1 };
  const verse: AppState = { edition: "hafs-kfqc", select: { surah: 2, ayah: 255 } };
  const names = () => recentSteps().map((s) => `${s.name}${s.count > 1 ? ` ×${s.count}` : ""}`);
  function mount(initialHash = "#") {
    window.history.replaceState(null, "", initialHash);
    return renderHook(
      ({ state, ready }: { state: AppState | null; ready: boolean }) => useHashRouter(state, () => {}, ready),
      { initialProps: { state: null as AppState | null, ready: false } },
    );
  }

  it("notes the app opening, then each change the reader makes", () => {
    const { rerender } = mount();
    rerender({ state: pageOne, ready: true });
    rerender({ state: { ...pageOne, page: 2 }, ready: true });
    rerender({ state: { ...pageOne, page: 3 }, ready: true });
    rerender({ state: verse, ready: true });
    expect(names()).toEqual(["open", "turn ×2", "verse"]);
  });

  it("opened cold at a link, the landing is not counted as a step of its own", () => {
    const { rerender } = mount("#/hafs-kfqc/2:255");
    rerender({ state: pageOne, ready: true });
    rerender({ state: verse, ready: true });
    expect(names()).toEqual(["open"]);
  });

  it("a link followed while the app is open is one step", () => {
    const { rerender } = mount();
    rerender({ state: pageOne, ready: true });
    window.history.replaceState(null, "", "#/hafs-kfqc/2:255");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    rerender({ state: verse, ready: true });
    rerender({ state: { ...verse, page: 45, select: null }, ready: true });
    expect(names()).toEqual(["open", "link", "unselect"]);
  });
});
