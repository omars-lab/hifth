import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The shell serves the app from its own bundle: there is nothing for a service
 * worker to cache and no browser to install into. Registering one anyway would
 * fail noisily on a custom scheme (no secure context), and an install prompt
 * for an app that is already installed is nonsense. So inside the shell
 * `initPwa()` does nothing at all.
 */

const sw = vi.hoisted(() => ({ registered: 0 }));
vi.mock("virtual:pwa-register", () => ({
  registerSW: () => {
    sw.registered += 1;
    return async () => {};
  },
}));

type Shelled = Window & { __HIFTH_NATIVE__?: unknown };
const w = window as Shelled;

afterEach(() => {
  delete w.__HIFTH_NATIVE__;
  sw.registered = 0;
  vi.restoreAllMocks();
});

describe("initPwa in the native shell", () => {
  it("registers no service worker and captures no install prompt", async () => {
    w.__HIFTH_NATIVE__ = { platform: "macos", publicBase: "https://x/" };
    const add = vi.spyOn(window, "addEventListener");
    vi.resetModules();
    const { initPwa } = await import("./pwa");
    initPwa();
    expect(sw.registered).toBe(0);
    const events = add.mock.calls.map((c) => c[0]);
    expect(events).not.toContain("beforeinstallprompt");
    expect(events).not.toContain("appinstalled");
  });

  it("registers the worker in a browser, as before", async () => {
    vi.resetModules();
    const { initPwa } = await import("./pwa");
    initPwa();
    expect(sw.registered).toBe(1);
  });
});
