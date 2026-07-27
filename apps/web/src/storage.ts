/**
 * Durable offline storage: ask for it, verify it, and be honest when it is not
 * granted (PLAN §4 rule 4, research §5).
 *
 * The research's finding is that **quota is a non-issue and eviction is the
 * issue**, so this module never asks "is there room?" — it asks "will what we
 * cached still be here tomorrow?". Three answers are possible, and the UI owes
 * the user a different sentence for each:
 *
 *   persisted     `navigator.storage.persist()` was granted → the origin is
 *                 exempt from LRU eviction under storage pressure.
 *   best-effort   not granted. Grants are **silent and heuristic** (WebKit
 *                 grants primarily to Home-Screen apps; Chromium scores site
 *                 engagement; Firefox prompts), so a denial is normal and must
 *                 degrade gracefully rather than throw or warn to the console.
 *   capped        the browser is offering this origin a small quota. Two very
 *                 different causes produce it — Chromium's "clear cookies and
 *                 site data when you close all windows" (or a private window),
 *                 and a device that is simply nearly out of disk, since a
 *                 normal quota is a share of *free* space. We cannot tell them
 *                 apart from script, so the state is named for what we actually
 *                 observe and the copy names both. Either way `persist()` can't
 *                 save it and "you're offline-ready" would be a lie.
 *
 * Deliberately NOT here: iOS's ITP 7-day script-storage deletion. It is not
 * observable from script and `persist()` is not documented to stop its timer —
 * on iOS the durable-offline mechanism is Home-Screen install, which is why the
 * install flow (see `pwa.ts`) is a feature and not a nicety.
 */

/** What we can promise the user about data we cache. */
export type Durability = "persisted" | "best-effort" | "capped" | "unsupported";

export interface StorageStatus {
  readonly durability: Durability;
  /** Bytes this origin is using, per `estimate()`. Null when unavailable. */
  readonly usageBytes: number | null;
  /** Bytes this origin may use, per `estimate()`. Null when unavailable. */
  readonly quotaBytes: number | null;
}

/**
 * Below this reported quota, offline is not something we can promise. Chromium's
 * clear-on-exit setting caps an origin at ~300 MB (research §5c) and private
 * windows cap similarly — but a healthy quota is ~60% of *free disk*, so a phone
 * with under ~700 MB free lands here too, with no cap set at all.
 *
 * That ambiguity is why the threshold decides a *state* and not a *cause*. An
 * earlier version of this called the state "clear-on-exit" and told the user to
 * go change a privacy setting; on a full phone that is confidently wrong advice
 * about a setting they never touched. The user-visible copy now names both
 * causes, because either one makes the cached mushaf a poor bet.
 *
 * The Chrome 133+ reporting quirk (an `estimate()` that under-reports as
 * usage + 10 GiB) cannot trip this: that shape still reports ≥ 10 GiB.
 */
const CAPPED_QUOTA_BYTES = 400 * 1024 * 1024;

function manager(): StorageManager | null {
  const sm = typeof navigator !== "undefined" ? navigator.storage : undefined;
  // Old WebKit ships `navigator.storage` without persist/persisted; treat a
  // partial implementation as absent rather than crashing on the call.
  return sm && typeof sm.persisted === "function" ? sm : null;
}

/** Whether this browser can be asked about durability at all. */
export function storageSupported(): boolean {
  return manager() !== null;
}

async function estimate(sm: StorageManager): Promise<{ usage: number | null; quota: number | null }> {
  if (typeof sm.estimate !== "function") return { usage: null, quota: null };
  try {
    const e = await sm.estimate();
    return { usage: e.usage ?? null, quota: e.quota ?? null };
  } catch {
    // Some engines reject estimate() in private mode. Not knowing the numbers
    // is not an error condition for us — it only costs us the capped-quota tell.
    return { usage: null, quota: null };
  }
}

function classify(persisted: boolean, quota: number | null): Durability {
  // Order matters: a capped quota outranks a persist() grant. Whether the cap
  // comes from the clear-on-exit setting or from a full disk, it is enforced
  // regardless of what the grant said.
  if (quota !== null && quota <= CAPPED_QUOTA_BYTES) return "capped";
  return persisted ? "persisted" : "best-effort";
}

/**
 * Read durability without asking for anything. Safe on cold start — it is a
 * pure query, so it can drive first paint of the offline UI.
 */
export async function readStorageStatus(): Promise<StorageStatus> {
  const sm = manager();
  if (!sm) return { durability: "unsupported", usageBytes: null, quotaBytes: null };
  try {
    const [persisted, { usage, quota }] = await Promise.all([sm.persisted(), estimate(sm)]);
    return { durability: classify(persisted, quota), usageBytes: usage, quotaBytes: quota };
  } catch {
    return { durability: "unsupported", usageBytes: null, quotaBytes: null };
  }
}

/**
 * Ask for persistent storage, then **verify** it (research §5b: never assume
 * the request succeeded — the return value and the later `persisted()` reading
 * are allowed to disagree, and only the latter is what the browser will act on).
 *
 * Call this after a real interaction, never on cold start: the engagement
 * heuristics that decide the grant have nothing to go on before the user has
 * touched the app, and asking during boot only competes with first paint.
 */
export async function requestPersistentStorage(): Promise<StorageStatus> {
  const sm = manager();
  if (!sm || typeof sm.persist !== "function") return readStorageStatus();
  try {
    if (!(await sm.persisted())) await sm.persist();
  } catch {
    // A rejected persist() is a denial like any other; the verify below is what
    // decides what we tell the user.
  }
  return readStorageStatus();
}

/*
 * Notice dismissal memory.
 *
 * "Do not nag" is a hard rule for this app: an offline warning that reappears
 * every launch trains the user to ignore the one time it matters. Dismissal is
 * remembered per *kind*, so a genuinely new problem (install → capped)
 * still gets one chance to speak.
 */
const DISMISS_PREFIX = "hifth.notice.";

/** localStorage throws in some private modes; a notice is never worth a crash. */
export function isNoticeDismissed(kind: string): boolean {
  try {
    return window.localStorage.getItem(DISMISS_PREFIX + kind) === "1";
  } catch {
    return false;
  }
}

export function dismissNotice(kind: string): void {
  try {
    window.localStorage.setItem(DISMISS_PREFIX + kind, "1");
  } catch {
    // Forgetting a dismissal is a nuisance; failing to render is a bug.
  }
}
