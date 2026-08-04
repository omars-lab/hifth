import { useCallback, useEffect, useState } from "react";
import {
  dismissNotice,
  isNoticeDismissed,
  readStorageStatus,
  requestPersistentStorage,
  storageSupported,
  type Durability,
} from "../storage";
import { isIosDevice, isStandalone, onInstallAvailability, promptInstall } from "../pwa";
import { packStatuses } from "../packs";
import { useT } from "../i18n";
import styles from "./OfflineNotice.module.css";

/**
 * The offline-durability state, as UI (PLAN §Loop 6a; research §5).
 *
 * Everything the service worker caches is at the mercy of two things script
 * cannot control: eviction (mitigated by a *silent, heuristic*
 * `navigator.storage.persist()` grant) and, on iOS, ITP's 7-day deletion of
 * script storage for origins the user hasn't opened in a week — which only a
 * Home-Screen install is exempt from. So a denial is not a console warning;
 * it is a state this app has to be able to render, with a sentence per case
 * that says what the user can actually do about it.
 *
 * It is one banner and it appears at most once per problem: an offline warning
 * that returns every launch is an offline warning nobody reads.
 */

/*
 * The four states, and the copy for each, live in `i18n`'s `notices`:
 *
 *   • `capped` — a small quota. It outranks everything else: no install and no
 *     persist() grant survives it, so pointing at the install button here would
 *     be advice that does not work. Both causes are named in the copy because
 *     script cannot tell them apart (see storage.ts), and naming only one would
 *     send half the readers to a setting that is not their problem.
 *   • `install-ios` — install IS the offline mechanism on iOS, so the copy names
 *     the benefit and the exact menu path; there is no prompt to fire (§5a).
 *   • `install-prompt` — Android/Chromium handed us a deferred prompt, so the
 *     action button fires the real one.
 *   • `best-effort` — persist denied and no install path to offer. Honest, not
 *     alarming: the pages are cached, they are simply first in line if the
 *     device runs short.
 *   • `pack-gone` — a juz the reader deliberately kept is no longer whole. The
 *     only one of the five that reports something that has *already happened*
 *     rather than a risk, which is why it outranks even `capped`, and the only
 *     one whose action opens a sheet instead of firing an install prompt.
 *
 * This union is declared here, where the ordering below decides between them,
 * and the bundles' `notices` record is indexed by it — so a fifth state cannot
 * be added without both languages growing an entry for it.
 */
type NoticeKind = "pack-gone" | "capped" | "install-ios" | "install-prompt" | "best-effort";

/**
 * Pick the one thing worth saying. Order is by what blocks offline hardest:
 * a loss already taken beats a quota cap, a quota cap beats a missing install,
 * a missing install beats a denied persist() (installing is usually what
 * *earns* the grant).
 */
function pickNotice(
  swept: boolean,
  durability: Durability,
  installable: boolean,
  standalone: boolean,
  ios: boolean,
): NoticeKind | null {
  // First, and ahead of `capped` on purpose. Every other notice warns about
  // storage that *may* be taken; this one says storage the reader asked for has
  // been taken, and it is the only one where reading the mus'haf offline has
  // already stopped working.
  if (swept) return "pack-gone";
  if (durability === "capped") return "capped";
  if (durability === "persisted") return null;
  // An installed app already sits in the platform's durable tier — on iOS that
  // is the ITP exemption, which `persisted()` never reports. Nagging it about
  // best-effort storage would be both noisy and wrong.
  if (standalone) return null;
  if (ios) return "install-ios";
  if (installable) return "install-prompt";
  // No StorageManager at all: we could not verify anything, and with no install
  // path there is no action to offer. Say nothing rather than guess.
  if (durability === "unsupported") return null;
  return "best-effort";
}

interface OfflineNoticeProps {
  /**
   * Stay silent for now — something with a better claim on the reader is on
   * screen. The banner is an in-flow strip, so two of them stack and take a
   * third of a phone's stage between them; this is how the composition is
   * resolved, in the one place that can see both (App). It suppresses the
   * *banner* only: the read and the `persist()` request below still run, so a
   * grant that arrives while held is already reflected when the strip lifts.
   */
  readonly hold?: boolean;
  /**
   * Open the shelf of what is kept — the revision map at juz scope.
   *
   * The `pack-gone` action deliberately does *not* re-download. A banner tap
   * that starts a multi-megabyte fetch, with no size shown and possibly on
   * cellular, is the shape of a thing readers learn not to press. It takes them
   * to the place that lists each juz, its state and its size, and the re-pin
   * button sits there beside the number it will cost.
   */
  readonly onShowPacks?: () => void;
}

export function OfflineNotice({
  hold = false,
  onShowPacks,
}: OfflineNoticeProps): JSX.Element | null {
  const { t } = useT();
  // Starts at "unsupported" — the honest pre-reading state. It renders nothing
  // on its own except on iOS, where install is the right advice with or without
  // a StorageManager to ask.
  const [durability, setDurability] = useState<Durability>("unsupported");
  const [installable, setInstallable] = useState(false);
  // Kinds hidden for this session. The durable half of the memory lives in
  // localStorage (`isNoticeDismissed`); this set is what re-renders on dismiss.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  // Whether any pinned juz is no longer whole. Read once, on mount: a sweep
  // happens while the tab is closed, so there is nothing to watch for — and the
  // shelf, not this strip, is where the state is followed as it changes.
  const [swept, setSwept] = useState(false);

  // Cold start: read only. `persist()` is a request, and requests made before
  // the user has done anything are the ones browsers refuse.
  useEffect(() => {
    if (!storageSupported()) return; // nothing to ask, nothing to correct
    let live = true;
    void readStorageStatus().then((s) => {
      if (live) setDurability(s.durability);
    });
    return () => {
      live = false;
    };
  }, []);

  // The right moment to ask: the first real interaction. It is the earliest
  // point the engagement heuristics behind the grant have anything to weigh,
  // and by then the first page is on screen and the first assets are cached —
  // i.e. there is finally something worth keeping.
  useEffect(() => {
    if (!storageSupported()) return;
    let live = true;
    const ask = (): void => {
      window.removeEventListener("pointerdown", ask);
      window.removeEventListener("keydown", ask);
      void requestPersistentStorage().then((s) => {
        if (live) setDurability(s.durability);
      });
    };
    window.addEventListener("pointerdown", ask, { passive: true });
    window.addEventListener("keydown", ask, { passive: true });
    return () => {
      live = false;
      window.removeEventListener("pointerdown", ask);
      window.removeEventListener("keydown", ask);
    };
  }, []);

  // `beforeinstallprompt` may land at any time (Chromium fires it once its own
  // heuristics are satisfied), and `appinstalled` clears it.
  useEffect(() => onInstallAvailability(setInstallable), []);

  // `torn` counts as swept. A pack missing four of its twenty-three pages opens
  // most of the juz, which is precisely why it needs saying out loud: the reader
  // finds the hole in aeroplane mode, at the page they were revising.
  useEffect(() => {
    let live = true;
    void packStatuses().then((all) => {
      if (live) setSwept(all.some((s) => s.health !== "whole"));
    });
    return () => {
      live = false;
    };
  }, []);

  const kind = pickNotice(swept, durability, installable, isStandalone(), isIosDevice());
  // `pack-gone` is an event, not a standing condition, so it is never written to
  // the durable dismissal store: a reader who hid it in March would otherwise
  // never be told about the sweep that takes the next juz. Hiding it lasts for
  // this session, and the shelf keeps the answer for anyone who goes looking.
  const dismissed =
    kind !== null && (hidden.has(kind) || (kind !== "pack-gone" && isNoticeDismissed(kind)));

  const handleDismiss = useCallback(() => {
    if (!kind) return;
    if (kind !== "pack-gone") dismissNotice(kind);
    setHidden((s) => new Set(s).add(kind));
  }, [kind]);

  const handleInstall = useCallback(() => {
    void promptInstall().then((outcome) => {
      // An accepted install fires `appinstalled` (which clears availability),
      // but `display-mode: standalone` only becomes true in the *installed*
      // window — so hide the banner here for this session too. A dismissed
      // prompt leaves it in hand, and the banner stays, honestly.
      if (outcome === "accepted") setHidden((s) => new Set(s).add("install-prompt"));
    });
  }, []);

  if (hold || !kind || dismissed) return null;
  const notice = t.notices[kind];

  return (
    // A plain <div>, not an <aside>: `role="status"` is the load-bearing part
    // (the banner appears after load, so it has to announce itself), and
    // overriding <aside>'s implicit `complementary` role with it is an
    // aria-allowed-role violation — caught by the Lighthouse a11y gate.
    <div className={styles.notice} role="status" data-notice={kind}>
      <div className={styles.text}>
        <strong className={styles.title}>{notice.title}</strong>
        <span className={styles.body}>{notice.body}</span>
      </div>
      <div className={styles.actions}>
        {notice.action && (
          <button
            type="button"
            className={styles.primary}
            onClick={kind === "pack-gone" ? onShowPacks : handleInstall}
          >
            {notice.action}
          </button>
        )}
        <button
          type="button"
          className={styles.dismiss}
          onClick={handleDismiss}
          aria-label={t.dismissNotice}
        >
          {t.dismiss}
        </button>
      </div>
    </div>
  );
}
