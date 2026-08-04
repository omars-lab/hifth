import { useCallback, useEffect, useRef, useState } from "react";
import { juzOfPage, planPack, type EditionId, type PageMeta } from "@hifth/core";
import { useT } from "../i18n";
import { packUrls } from "../assets";
import {
  packStatuses,
  packsSupported,
  pinPack,
  repinPack,
  unpinPack,
  type PackStatus,
} from "../packs";
import styles from "./PackShelf.module.css";

/**
 * What is kept on this phone — the pin control, and the shelf it lives on.
 *
 * ## Why it is inside the revision map, at juz scope
 *
 * A pack is a juz, and the map at juz scope is already the picture of the
 * thirty. The reader is looking at exactly the right unit, they opened the
 * sheet from the page chip so they already know where they are, and the chrome
 * has no room for a sixth button — `e2e/chrome-fit` holds the header inside
 * 320px with seventeen pixels of slack, which is what put the colophon behind
 * the wordmark.
 *
 * ## The pin state is not painted onto the cells
 *
 * The obvious move is a corner dot on each pinned juz. It is refused for the
 * reason the map exists: the cells already carry warmth, and *absent* is
 * already a treatment in kind rather than a colour. A third meaning on the same
 * square is one meaning too many, and the one that would be misread is the one
 * that matters — a swept pack looking pinned. So the shelf says it in words, in
 * a list, where "incomplete" can be a sentence rather than a shade.
 *
 * ## Three states, and the middle one is the point
 *
 * `whole` is what the reader asked for. `gone` is a sweep. **`torn`** is the
 * one worth the extra line: a partly swept pack opens most of its pages, so it
 * is the state most likely to pass for working, and the difference between it
 * and a pin only shows in the place where nothing can be done about it. It is
 * named, counted, and offered the same repair as `gone`.
 *
 * ## Absent ayahs are on the label, not in the small print
 *
 * `planPack` counts what this build has no paper for. On today's corpus it is
 * zero everywhere, which is exactly when the rule is easiest to drop — the map
 * made the same argument about absent cells. Silence about a hole reads as an
 * assurance.
 */

interface PackShelfProps {
  /** The print the pages belong to — the pack's other half of its identity. */
  readonly edition: EditionId;
  /** The manifest's pages. The pack is read off these, never off `JUZ_STARTS`. */
  readonly pages: readonly PageMeta[];
  /** The page on the stage, which is what decides the juz being offered. */
  readonly page: number;
}

/** In-flight pin, so the button can become a progress line and a stop. */
interface Pinning {
  readonly juz: number;
  readonly done: number;
  readonly total: number;
}

/**
 * Bytes as a number a reader can weigh a phone against. MB in the sense the
 * phone's own storage settings use it — 10^6, not 2^20 — because the number is
 * there to be compared against "12.4 GB free", not against a block count. The
 * rounding to one decimal belongs to `tenths` in the i18n layer, which also
 * knows what character Arabic puts before the tenths digit.
 */
function megabytes(bytes: number): number {
  return bytes / 1_000_000;
}

export function PackShelf({ edition, pages, page }: PackShelfProps): JSX.Element {
  const { t } = useT();
  // `undefined` while the register is being read: "still opening" is not the
  // same answer as "nothing is kept here", and only the second is worth a line.
  const [statuses, setStatuses] = useState<readonly PackStatus[] | undefined>(undefined);
  const [pinning, setPinning] = useState<Pinning | null>(null);
  const abort = useRef<AbortController | null>(null);
  const live = useRef(true);

  const refresh = useCallback(async () => {
    const next = await packStatuses();
    if (live.current) setStatuses(next);
  }, []);

  useEffect(() => {
    live.current = true;
    void refresh();
    return () => {
      live.current = false;
      // A pin the reader walked away from stops fetching. What it already wrote
      // stays written and the pack reports itself torn — which is true, and is
      // one press away from whole.
      abort.current?.abort();
    };
  }, [refresh]);

  const run = useCallback(
    async (juz: number, urls: readonly string[] | null) => {
      const controller = new AbortController();
      abort.current = controller;
      setPinning({ juz, done: 0, total: urls?.length ?? 0 });
      const onProgress = (p: { done: number; total: number }): void => {
        if (live.current) setPinning({ juz, done: p.done, total: p.total });
      };
      const plan = urls === null ? null : planPack(juz, pages);
      await (urls === null
        ? repinPack(edition, juz, { onProgress, signal: controller.signal })
        : pinPack(edition, juz, urls, plan?.absentAyahs ?? 0, {
            onProgress,
            signal: controller.signal,
          }));
      abort.current = null;
      if (!live.current) return;
      setPinning(null);
      await refresh();
    },
    [edition, pages, refresh],
  );

  const here = juzOfPage(page, pages);
  const plan = here === null ? null : planPack(here, pages);
  const kept = statuses ?? [];
  const alreadyHere = kept.some((s) => s.juz === here);

  return (
    <section className={styles.shelf} aria-labelledby="packs-head">
      <h3 className={styles.head} id="packs-head">
        {t.packsHead}
      </h3>

      {!packsSupported() ? (
        <p className={styles.note}>{t.packsUnsupported}</p>
      ) : (
        <>
          <p className={styles.note}>{t.packsHint}</p>

          {/* The offer, for the juz the reader is standing in. `juzOfPage` names
              the earlier juz on a leaf that straddles a boundary — the one being
              read, not the one about to be reached. */}
          {here !== null && !alreadyHere && (
            <div className={styles.offer}>
              {pinning?.juz === here ? (
                <>
                  <span className={styles.progress} role="status">
                    {t.packKeeping(here, pinning.done, pinning.total)}
                  </span>
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={() => abort.current?.abort()}
                  >
                    {t.packStop}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={styles.primary}
                  disabled={pinning !== null}
                  onClick={() => void run(here, packUrls(edition, plan!))}
                >
                  {t.packKeep(here)}
                </button>
              )}
              {/* Said before the download, not after it. A reader deciding
                  whether to spend the bytes is owed the hole up front. */}
              {plan !== null && plan.absentAyahs > 0 && (
                <span className={styles.gap}>{t.packAbsent(plan.absentAyahs)}</span>
              )}
            </div>
          )}

          {statuses === undefined ? (
            <p className={styles.note}>{t.packsLoading}</p>
          ) : kept.length === 0 ? (
            <p className={styles.note}>{t.packsNone}</p>
          ) : (
            <ul className={styles.list} aria-label={t.packsHead}>
              {kept.map((s) => (
                <li key={s.juz} className={styles.row} data-health={s.health}>
                  <span className={styles.label}>
                    {s.health === "whole"
                      ? t.packWhole(s.juz, megabytes(s.bytes))
                      : s.health === "torn"
                        ? t.packTorn(s.juz, s.present, s.total)
                        : t.packGone(s.juz)}
                  </span>
                  {s.health !== "whole" &&
                    (pinning?.juz === s.juz ? (
                      <span className={styles.progress} role="status">
                        {t.packKeeping(s.juz, pinning.done, pinning.total)}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={styles.primary}
                        disabled={pinning !== null}
                        onClick={() => void run(s.juz, null)}
                      >
                        {t.packRepin}
                      </button>
                    ))}
                  <button
                    type="button"
                    className={styles.secondary}
                    aria-label={t.packRemoveJuz(s.juz)}
                    disabled={pinning !== null}
                    onClick={() => void unpinPack(edition, s.juz).then(refresh)}
                  >
                    {t.packRemove}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
