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

/** The flag in pwa.ts and the watcher in pwa-update.ts, fresh and sharing one copy of the flag. */
async function loadUpdate() {
  const pwa = await load();
  const update = await import("./pwa-update");
  return { ...pwa, ...update };
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

describe("initPwa", () => {
  it("asks the browser to keep the pages the moment the app is installed", async () => {
    // Installing is the strongest sign the browser weighs when it decides
    // whether to promise the offline pages will stay.
    let granted = false;
    const persist = vi.fn(async () => (granted = true));
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: { persist, persisted: async () => granted, estimate: async () => ({ usage: 0, quota: 1 }) },
    });
    const { initPwa } = await load();
    initPwa();
    expect(persist).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("appinstalled"));
    await vi.waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
  });
});

/** A worker this test moves by hand, which remembers what it was sent. */
class SentWorker extends FakeWorker {
  sent: unknown[] = [];
  postMessage(m: unknown): void {
    this.sent.push(m);
  }
}

/**
 * A registration and worker container for the update watcher. `controller` is
 * the worker running this page; null on a first visit.
 */
function stubUpdate(opts: { controller: boolean; waiting?: SentWorker | null }) {
  const container = new EventTarget() as EventTarget & { controller: object | null };
  container.controller = opts.controller ? new FakeWorker(SCRIPT) : null;
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: container });
  const reg = new EventTarget() as EventTarget & { waiting: SentWorker | null; installing: SentWorker | null };
  reg.waiting = opts.waiting ?? null;
  reg.installing = null;
  /** A new release's worker arriving while the page is open. */
  const arrive = (url = SCRIPT): SentWorker => {
    const w = new SentWorker(url);
    reg.installing = w;
    reg.dispatchEvent(new Event("updatefound"));
    return w;
  };
  return { container, reg: reg as unknown as ServiceWorkerRegistration, arrive };
}

describe("a new version is ready", () => {
  it("says so when a new release is waiting behind the one running the page", async () => {
    const waiting = new SentWorker(SCRIPT);
    waiting.state = "installed";
    const { reg } = stubUpdate({ controller: true, waiting });
    const { watchForUpdate, onUpdateReady } = await loadUpdate();
    const seen: boolean[] = [];
    onUpdateReady((r) => seen.push(r));
    watchForUpdate(reg);
    expect(seen.at(-1)).toBe(true);
  });

  it("says so when the new release finishes installing while the page is open", async () => {
    const { reg, arrive } = stubUpdate({ controller: true });
    const { watchForUpdate, onUpdateReady } = await loadUpdate();
    let ready = false;
    onUpdateReady((r) => (ready = r));
    watchForUpdate(reg);
    const w = arrive();
    expect(ready).toBe(false);
    w.advance("installed");
    expect(ready).toBe(true);
  });

  it("says nothing on a first visit, when there was no old version to replace", async () => {
    const { reg, arrive } = stubUpdate({ controller: false });
    const { watchForUpdate, onUpdateReady } = await loadUpdate();
    let ready = false;
    onUpdateReady((r) => (ready = r));
    watchForUpdate(reg);
    arrive().advance("installed");
    expect(ready).toBe(false);
  });

  it("says nothing about the shell repair's second copy of the same release", async () => {
    const { reg, arrive } = stubUpdate({ controller: true });
    const { watchForUpdate, onUpdateReady } = await loadUpdate();
    let ready = false;
    onUpdateReady((r) => (ready = r));
    watchForUpdate(reg);
    arrive(`${SCRIPT}?shell-repair=1`).advance("installed");
    expect(ready).toBe(false);
  });

  it("Reload asks the waiting release to take over, then opens the page again once it has", async () => {
    const waiting = new SentWorker(SCRIPT);
    waiting.state = "installed";
    const { container, reg } = stubUpdate({ controller: true, waiting });
    const { watchForUpdate, applyUpdate } = await loadUpdate();
    watchForUpdate(reg);
    const reload = vi.fn();
    applyUpdate(reload);
    expect(waiting.sent).toEqual([{ type: "SKIP_WAITING" }]);
    // Not before the new release is running the page, or the reload would come
    // back to the old one.
    expect(reload).not.toHaveBeenCalled();
    container.dispatchEvent(new Event("controllerchange"));
    expect(reload).toHaveBeenCalledTimes(1);
    // A second press while it switches does not send it twice.
    applyUpdate(reload);
    expect(waiting.sent).toHaveLength(1);
  });

  it("a tab left on the old release after Reload in another tab is told too, and Reload only reopens it", async () => {
    const { container, reg } = stubUpdate({ controller: true });
    const { watchForUpdate, onUpdateReady, applyUpdate } = await loadUpdate();
    let ready = false;
    onUpdateReady((r) => (ready = r));
    watchForUpdate(reg);
    container.dispatchEvent(new Event("controllerchange"));
    expect(ready).toBe(true);
    const reload = vi.fn();
    applyUpdate(reload);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("the first visit's worker taking over is not an update", async () => {
    const { container, reg } = stubUpdate({ controller: false });
    const { watchForUpdate, onUpdateReady } = await loadUpdate();
    let ready = false;
    onUpdateReady((r) => (ready = r));
    watchForUpdate(reg);
    container.controller = new FakeWorker(SCRIPT);
    container.dispatchEvent(new Event("controllerchange"));
    expect(ready).toBe(false);
  });
});
