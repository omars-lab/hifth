import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The shell serves the app from its own bundle: there is nothing for a service
 * worker to cache and no browser to install into. Registering one anyway would
 * fail noisily on a custom scheme (no secure context), and an install prompt
 * for an app that is already installed is nonsense. So inside the shell
 * `initPwa()` does nothing at all.
 */

const sw = vi.hoisted(() => ({ registered: [] as [string, RegistrationOptions | undefined][] }));
// The app registers its worker itself (2026-11-12): the helper library it used
// before weighed 2.3 KB and did nothing this app asks of it.
Object.defineProperty(navigator, "serviceWorker", {
  configurable: true,
  value: {
    register: async (url: string, opts?: RegistrationOptions) => {
      sw.registered.push([url, opts]);
      return {};
    },
    ready: new Promise(() => {}),
  },
});

type Shelled = Window & { __HIFTH_NATIVE__?: unknown };
const w = window as Shelled;

afterEach(() => {
  delete w.__HIFTH_NATIVE__;
  sw.registered = [];
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("initPwa in the native shell", () => {
  it("registers no service worker and captures no install prompt", async () => {
    w.__HIFTH_NATIVE__ = { platform: "macos", publicBase: "https://x/" };
    const add = vi.spyOn(window, "addEventListener");
    vi.resetModules();
    const { initPwa } = await import("./pwa");
    vi.stubEnv("PROD", true);
    initPwa();
    expect(sw.registered).toHaveLength(0);
    const events = add.mock.calls.map((c) => c[0]);
    expect(events).not.toContain("beforeinstallprompt");
    expect(events).not.toContain("appinstalled");
  });

  it("registers the worker in a browser, as before, at the build's own address", async () => {
    vi.stubEnv("PROD", true);
    vi.resetModules();
    const { initPwa } = await import("./pwa");
    initPwa();
    expect(sw.registered).toEqual([["./sw.js", { scope: "./" }]]);
  });

  it("registers nothing on the dev server, which serves no worker", async () => {
    vi.stubEnv("PROD", false);
    vi.resetModules();
    const { initPwa } = await import("./pwa");
    initPwa();
    expect(sw.registered).toHaveLength(0);
  });
});
