import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import {
  checkKept,
  forgetSurah,
  keepInProgress,
  keepSupported,
  keptSurahs,
  startKeeping,
  stopKeeping,
  useKeptChanges,
  type KeptStatus,
} from "../recitation-keep";
import styles from "./PackShelf.module.css";

/**
 * The surahs whose recitation is kept on this device (docs/PLAN.md, item 101),
 * in the info panel: each with its size, a way to remove it, and a way to save
 * the rest when the device has let some of its files go. A surah is kept from
 * the menu on its name at the top of the page; this is where the reader sees
 * what that has cost them, and takes it back.
 *
 * Shown inside the iPad and Mac app too: the app carries every page, but not
 * the recitation, which streams like it does in the browser.
 *
 * It says what the files are, not what the claim says: a claimed surah whose
 * files are partly gone is named "incomplete" (the juz shelf's rule, for the
 * same reason: that is the state most likely to pass for working).
 */

/** Bytes as the phone's storage settings count them: 10^6 to the MB. */
function megabytes(bytes: number): number {
  return bytes / 1_000_000;
}

export function RecitationShelf(): JSX.Element {
  const { t } = useT();
  const changes = useKeptChanges();
  // `undefined` while the files are being looked at: "still looking" is not
  // "nothing kept".
  const [statuses, setStatuses] = useState<readonly KeptStatus[] | undefined>(undefined);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const next = await Promise.all(keptSurahs().map((k) => checkKept(k)));
    if (live.current) setStatuses(next);
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh, changes]);

  const saving = keepInProgress();
  const kept = statuses ?? [];

  return (
    <section className={styles.shelf} aria-labelledby="colophon-recitations">
      <h3 className={styles.head} id="colophon-recitations">
        {t.recShelfHead}
      </h3>
      {!keepSupported() ? (
        <p className={styles.note}>{t.recShelfUnsupported}</p>
      ) : (
        <>
          <p className={styles.note}>{t.recShelfHint}</p>
          {saving && (
            <div className={styles.offer}>
              <span className={styles.progress} role="status">
                {t.recSaving(t.surahName(saving.surah), saving.done, saving.total)}
              </span>
              <button type="button" className={styles.secondary} onClick={stopKeeping}>
                {t.packStop}
              </button>
            </div>
          )}
          {statuses === undefined ? null : kept.length === 0 ? (
            !saving && <p className={styles.note}>{t.recShelfNone}</p>
          ) : (
            <ul className={styles.list} aria-label={t.recShelfHead}>
              {kept.map((s) => {
                const name = t.surahName(s.surah);
                return (
                  <li key={s.surah} className={styles.row} data-health={s.health}>
                    <span className={styles.label}>
                      {s.health === "whole"
                        ? t.recWhole(name, megabytes(s.bytes))
                        : s.health === "torn"
                          ? t.recTorn(name, s.present, s.total)
                          : t.recGone(name)}
                    </span>
                    {s.health !== "whole" && (
                      <button
                        type="button"
                        className={styles.primary}
                        disabled={saving !== null}
                        onClick={() => void startKeeping(s.surah)}
                      >
                        {t.recRepin}
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.secondary}
                      aria-label={t.recRemoveSurah(name)}
                      disabled={saving?.surah === s.surah}
                      onClick={() => void forgetSurah(s.surah)}
                    >
                      {t.packRemove}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
