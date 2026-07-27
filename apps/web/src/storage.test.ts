import { describe, it, expect, vi, afterEach } from "vitest";
import {
  dismissNotice,
  isNoticeDismissed,
  readStorageStatus,
  requestPersistentStorage,
} from "./storage";

/**
 * The durability classifier is the whole point of `storage.ts`: it turns three
 * platform behaviours the user cannot see (a silent grant, a silent denial, a
 * quota cap) into the three sentences the UI is allowed to say. These tests are
 * the boundary table for that mapping.
 */

const GB = 1024 * 1024 * 1024;

/** Install a fake StorageManager; `null` removes it (old WebKit). */
function stubStorage(sm: Partial<StorageManager> | null): void {
  Object.defineProperty(navigator, "storage", {
    value: sm ?? undefined,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  stubStorage(null);
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("readStorageStatus", () => {
  it("reports 'unsupported' when the browser has no StorageManager", async () => {
    stubStorage(null);
    const s = await readStorageStatus();
    expect(s.durability).toBe("unsupported");
    expect(s.quotaBytes).toBeNull();
  });

  it("reports 'unsupported' for a partial implementation (no persisted())", async () => {
    stubStorage({ estimate: async () => ({ usage: 0, quota: 40 * GB }) });
    expect((await readStorageStatus()).durability).toBe("unsupported");
  });

  it("reports 'persisted' when the grant is already in place", async () => {
    stubStorage({
      persisted: async () => true,
      estimate: async () => ({ usage: 2e6, quota: 40 * GB }),
    });
    const s = await readStorageStatus();
    expect(s.durability).toBe("persisted");
    expect(s.usageBytes).toBe(2e6);
  });

  it("reports 'best-effort' when the origin is not persisted", async () => {
    stubStorage({
      persisted: async () => false,
      estimate: async () => ({ usage: 0, quota: 40 * GB }),
    });
    expect((await readStorageStatus()).durability).toBe("best-effort");
  });

  it("a capped quota outranks a persist() grant", async () => {
    // ~300 MB is the documented cap for "clear site data when you close all
    // windows"; nothing survives the browser closing, grant or no grant.
    stubStorage({
      persisted: async () => true,
      estimate: async () => ({ usage: 1e6, quota: 300 * 1024 * 1024 }),
    });
    expect((await readStorageStatus()).durability).toBe("capped");
  });

  it("the Chrome 133 under-reporting quirk does not read as a cap", async () => {
    // The quirk reports quota as usage + 10 GiB — far above the cap ceiling, so
    // a normal browser is never mistaken for a capped one.
    stubStorage({
      persisted: async () => false,
      estimate: async () => ({ usage: 5e6, quota: 5e6 + 10 * GB }),
    });
    expect((await readStorageStatus()).durability).toBe("best-effort");
  });

  it("survives an estimate() that rejects (private mode)", async () => {
    stubStorage({
      persisted: async () => false,
      estimate: async () => {
        throw new Error("nope");
      },
    });
    const s = await readStorageStatus();
    expect(s.durability).toBe("best-effort");
    expect(s.quotaBytes).toBeNull();
  });
});

describe("requestPersistentStorage", () => {
  it("asks once, then reports the verified grant", async () => {
    let granted = false;
    const persist = vi.fn(async () => {
      granted = true;
      return true;
    });
    stubStorage({
      persist,
      persisted: async () => granted,
      estimate: async () => ({ usage: 0, quota: 40 * GB }),
    });
    expect((await requestPersistentStorage()).durability).toBe("persisted");
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("trusts persisted(), not persist()'s return value", async () => {
    // The "never assume it succeeded" rule (research §5b): a persist() that
    // resolves true while persisted() still says false is a denial.
    stubStorage({
      persist: async () => true,
      persisted: async () => false,
      estimate: async () => ({ usage: 0, quota: 40 * GB }),
    });
    expect((await requestPersistentStorage()).durability).toBe("best-effort");
  });

  it("does not re-ask when the grant already exists", async () => {
    const persist = vi.fn(async () => true);
    stubStorage({
      persist,
      persisted: async () => true,
      estimate: async () => ({ usage: 0, quota: 40 * GB }),
    });
    await requestPersistentStorage();
    expect(persist).not.toHaveBeenCalled();
  });

  it("treats a rejected persist() as a denial, not a crash", async () => {
    stubStorage({
      persist: async () => {
        throw new Error("denied");
      },
      persisted: async () => false,
      estimate: async () => ({ usage: 0, quota: 40 * GB }),
    });
    expect((await requestPersistentStorage()).durability).toBe("best-effort");
  });
});

describe("notice dismissal memory", () => {
  it("remembers a dismissal per kind", () => {
    expect(isNoticeDismissed("install-ios")).toBe(false);
    dismissNotice("install-ios");
    expect(isNoticeDismissed("install-ios")).toBe(true);
    // A different problem still gets its one chance to speak.
    expect(isNoticeDismissed("capped")).toBe(false);
  });

  it("never throws when localStorage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    expect(() => dismissNotice("best-effort")).not.toThrow();
    expect(isNoticeDismissed("best-effort")).toBe(false);
  });
});
