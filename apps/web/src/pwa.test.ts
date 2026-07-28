import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type * as Pwa from "./pwa";

/**
 * `repairShellCache()` is the app's answer to a storage eviction, and the thing
 * it is easy to get wrong is *when it is allowed to say it worked*. Workbox
 * writes the precache one entry at a time inside the service worker's `install`
 * handler; `index.html` lands first and the app's own scripts land last. So a
 * repair that stops as soon as the shell is back has stopped in the middle: the
 * next offline boot serves the shell, finds no scripts, and renders a blank
 * page — which is a worse failure than the empty cache it replaced, because it
 * looks like a working app that lost its contents.
 *
 * The e2e (`e2e/offline.spec.ts`, follow-up ④) evicts a real origin over CDP
 * and proves the repair survives it end to end, but it cannot pin *this*: it
 * waits for the tab to go quiet, which hides the difference between finishing
 * the install and merely starting it. That distinction is what these tests are.
 *
 * The reload is deliberately out of scope — jsdom has no navigation, and the
 * reload's job (refilling the *runtime* caches, which only a real fetch can do)
 * is the e2e's to prove. Every test here spends the reload flag up front so the
 * repair takes its no-reload path.
 */

type WorkerState = "installing" | "installed" | "activating" | "activated" | "redundant";

/** A service worker whose state this test moves by hand. */
class FakeWorker extends EventTarget {
  state: WorkerState = "installing";
  constructor(readonly scriptURL: string) {
    super();
  }
  advance(state: WorkerState): void {
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}

const SCRIPT = "http://localhost/sw.js";
const RELOAD_FLAG = "hifth:shell-repair";

interface Harness {
  /** Script URLs passed to `register()`, in order. */
  registered: string[];
  /** The worker the last `register()` created, so a test can install it. */
  installing: FakeWorker | null;
  /** Whether `caches.match("index.html")` finds anything. */
  shell: boolean;
}

function stub(h: Harness, opts: { onLine?: boolean; hasRegistration?: boolean } = {}): void {
  const active = new FakeWorker(SCRIPT);
  active.state = "activated";
  const registration = { scope: "http://localhost/", active, waiting: null, installing: null };
  const present = opts.hasRegistration ?? true;

  Object.defineProperty(navigator, "onLine", {
    value: opts.onLine ?? true,
    configurable: true,
  });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      ready: Promise.resolve(registration),
      getRegistration: async () => (present ? registration : undefined),
      register: async (url: string) => {
        h.registered.push(url);
        h.installing = new FakeWorker(url);
        return { ...registration, installing: h.installing };
      },
    },
  });
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    // Only the presence of an answer matters; `shellCached()` compares against
    // `undefined` and never reads the body.
    value: { match: async () => (h.shell ? ({} as Response) : undefined) },
  });
}

/** Fresh module state per test — the one-repair-per-document guard is module-level. */
async function load(): Promise<typeof Pwa> {
  vi.resetModules();
  return await import("./pwa");
}

/** Let every pending microtask and zero-delay timer run. */
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Long enough that a repair which *polls* for the shell would have noticed it
 * by now. Asserting "still unsettled" one tick after the shell reappears is not
 * an assertion — any poll interval at all would pass it.
 */
const pollingWindow = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 50));

let h: Harness;

beforeEach(() => {
  h = { registered: [], installing: null, shell: false };
  window.sessionStorage.setItem(RELOAD_FLAG, "1");
});

afterEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("repairShellCache", () => {
  it("waits for the install to finish, not for the shell to reappear", async () => {
    stub(h);
    const { repairShellCache } = await load();

    let settled: boolean | null = null;
    const repair = repairShellCache().then((ok) => (settled = ok));

    // The precache's first entry — the shell — is back almost immediately. That
    // is the false summit: nine more entries, including every script the app
    // needs to render, are still being written.
    await tick();
    h.shell = true;
    await pollingWindow();
    expect(settled).toBeNull();

    h.installing?.advance("installed");
    await repair;
    expect(settled).toBe(true);
  });

  it("a failed install is not a repair, however full the cache looks", async () => {
    stub(h);
    const { repairShellCache } = await load();

    const repair = repairShellCache();
    await tick();
    // A partial write can leave the shell behind even when the install as a
    // whole was discarded, so `redundant` outranks a present `index.html`.
    h.shell = true;
    h.installing?.advance("redundant");
    expect(await repair).toBe(false);
  });

  it("registers a script URL the registration has never seen", async () => {
    stub(h);
    const { repairShellCache } = await load();

    const repair = repairShellCache();
    await tick();
    h.shell = true;
    h.installing?.advance("installed");
    await repair;

    // Same bytes, different name. Re-registering the *same* URL is answered
    // with the already-activated worker and no `install` at all, which is how
    // the repair used to do nothing while reporting success.
    expect(h.registered).toHaveLength(1);
    expect(h.registered[0]).not.toBe(SCRIPT);
    expect(h.registered[0]).toMatch(new RegExp(`^${SCRIPT}\\?`));
  });

  it("tries once per document, so a dead repair does not loop", async () => {
    stub(h);
    const { repairShellCache } = await load();

    const first = repairShellCache();
    await tick();
    h.installing?.advance("redundant");
    expect(await first).toBe(false);

    // Still evicted, and this document has spent its attempt. The next boot
    // gets a fresh one for free, which is where a retry belongs.
    expect(await repairShellCache()).toBe(false);
    expect(h.registered).toHaveLength(1);
  });

  it("leaves an intact shell alone", async () => {
    h.shell = true;
    stub(h);
    const { repairShellCache } = await load();

    expect(await repairShellCache()).toBe(true);
    expect(h.registered).toHaveLength(0);
  });

  it("does not try to rebuild a cache from a network that is not there", async () => {
    stub(h, { onLine: false });
    const { repairShellCache } = await load();

    expect(await repairShellCache()).toBe(false);
    expect(h.registered).toHaveLength(0);
  });

  it("does nothing when there is no registration to copy a script URL from", async () => {
    stub(h, { hasRegistration: false });
    const { repairShellCache } = await load();

    expect(await repairShellCache()).toBe(false);
    expect(h.registered).toHaveLength(0);
  });
});
