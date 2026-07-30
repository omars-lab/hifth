import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  dayOf,
  daysBetween,
  lastSeen,
  scopesOf,
  type PageMeta,
  type RevisionEvent,
  type RevisionScope,
} from "@hifth/core";
import { useT } from "../i18n";
import { readRecord, revisionStoreSupported, type RevisionRecord } from "../revision-store";
import styles from "./RevisionMap.module.css";

interface RevisionMapProps {
  /** Whether the sheet is open. Reading the record is deferred until it is. */
  open: boolean;
  onClose: () => void;
  /**
   * Every page this build vendored, with the ayahs on it. Not a page-number
   * list: the ayahs are what makes "absent" answerable at hizb and juz scope,
   * where the question is which *divisions* we hold paper for.
   */
  pages: readonly PageMeta[];
  /** How long the print is — 604 for the Madani mus'haf, not what we vendored. */
  totalPages: number;
  /** The page on the stage, ringed on the map so the reader can find themselves. */
  page: number;
  /**
   * Today, in the reader's own clock. Optional: the sheet resolves it on open if
   * nobody passes one. Tests pass it, so a warmth assertion is arithmetic rather
   * than a mocked global — the same reason `revision.ts` is clockless.
   */
  today?: string;
}

/** How many divisions the whole book has, at each scope. */
const SPAN: Readonly<Record<RevisionScope, (totalPages: number) => number>> = {
  page: (totalPages) => totalPages,
  hizb: () => 60,
  juz: () => 30,
};

/**
 * Warmth bands, in days since a division was last opened.
 *
 * A first guess, and named as one: the bands want a hafiz's judgment rather than
 * a developer's, which is why `docs/design/revision-record.md` lists them as an
 * open question instead of a settled number. What is *not* a guess is that the
 * axis is recency and not frequency — `lastSeen` exists separately from `rollUp`
 * because "what have I not touched in weeks" does not depend on how many times
 * something was opened.
 */
const BANDS = [2, 7, 30] as const;

function warmth(days: number): 1 | 2 | 3 | 4 {
  if (days < BANDS[0]) return 4;
  if (days < BANDS[1]) return 3;
  if (days < BANDS[2]) return 2;
  return 1;
}

/** Focusable descendants of `root`, in tab order. Colophon's helper, verbatim. */
function focusables(root: HTMLElement): HTMLElement[] {
  const sel =
    'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll<HTMLElement>(sel));
}

/**
 * The divisions this build holds paper for, at one scope.
 *
 * Every ayah on a vendored page becomes a pseudo-event and goes through
 * `scopesOf` — **the same function that files a recorded look**. Two
 * implementations of "which hizb is this ayah in?" would eventually disagree, and
 * the disagreement would be invisible: a division drawn as absent while the
 * record was quietly colouring it warm. One code path cannot drift from itself.
 *
 * Per ayah rather than one pseudo-event spanning the page's first and last: that
 * shorter version assumes `polygons` is in mus'haf order, which nothing in the
 * manifest's type promises and no gate checks. It would be right today and wrong
 * the first time the extractor emitted a page's ayahs in document order — with
 * the failure showing up as a *quietly missing* division rather than as an error.
 */
export function coverage(pages: readonly PageMeta[], scope: RevisionScope): Set<number> {
  const held = new Set<number>();
  for (const meta of pages) {
    for (const polygon of meta.polygons) {
      const probe: RevisionEvent = { key: polygon.key, page: meta.page, at: 0, tz: 0 };
      for (const id of scopesOf(probe, scope)) held.add(id);
    }
  }
  return held;
}

/**
 * The revision map — a picture of what a hafiz has *opened*, by page, hizb or juz.
 *
 * ## The title is the design
 *
 * Not "revision calendar". A tap is evidence someone looked at an ayah; it is not
 * evidence they recited it, and the distance between those two is why this sheet
 * says the gap out loud, once, under the title. A heatmap titled "revision" over a
 * log of glances is the same class of defect this codebase has already paid for
 * twice — an interface stating something the data cannot back.
 *
 * ## Absent is not cold
 *
 * Three of 604 pages are vendored. If the un-visitable 601 render as the same grey
 * as "here, and never opened", the picture tells a hafiz they have abandoned 99.5%
 * of the Qur'an — false, and entirely an artefact of the build. So absent is a
 * different treatment *in kind*: no fill at all, a dashed hairline, reading as "no
 * paper here" rather than "paper you neglected". Absent cells are counted out of
 * every total, and the sheet carries the inventory line the page bar established
 * («المتوفّر ٣ من ٦٠٤ صفحة»), in whatever unit is on screen.
 *
 * ## It says how old it is
 *
 * iOS deletes script-writable storage after seven days without interaction, so the
 * record of the weeks a hafiz did not open the app is deleted *because* they did
 * not open it — and it resets to empty, which reads as "you have revised nothing",
 * said to someone about their own worship. `since` is stored at first open rather
 * than derived from the oldest event, precisely so an emptied record renders as a
 * *young* one. Which is why the line is always shown, never only when non-empty.
 *
 * ## A11y: Colophon's contract
 *
 * Modal dialog, focus in, Tab trapped, Escape closes, focus restored to the page
 * chip that opened it.
 */
export function RevisionMap({
  open,
  onClose,
  pages,
  totalPages,
  page,
  today,
}: RevisionMapProps): JSX.Element | null {
  const { t, dir } = useT();
  const sheetRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const [scope, setScope] = useState<RevisionScope>("hizb");
  // `undefined` while the read is in flight, so "still opening" is a different
  // state from "opened, and empty" — the second is a real answer and deserves
  // its own words.
  const [record, setRecord] = useState<RevisionRecord | undefined>(undefined);
  // Resolved when the sheet opens, not when the app mounts: a tab left open
  // overnight would otherwise measure "days ago" from yesterday, and quietly
  // report every division one day fresher than it is.
  const [resolvedToday, setResolvedToday] = useState<string | null>(null);
  const asOf = today ?? resolvedToday;

  useEffect(() => {
    if (!open) return;
    restoreRef.current = (document.activeElement as HTMLElement | null) ?? null;
    const sheet = sheetRef.current;
    if (sheet) (focusables(sheet)[0] ?? sheet).focus();
    return () => {
      restoreRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Through `dayOf`, not through a hand-rolled `toISOString().slice(0, 10)`:
    // the record's days were resolved in the reader's own clock, and comparing
    // them against a UTC day would put every evening east of Greenwich one day
    // in the future.
    setResolvedToday(
      dayOf({ key: "", page: 0, at: Date.now(), tz: -new Date().getTimezoneOffset() }),
    );
    let live = true;
    void readRecord().then((r) => {
      if (live) setRecord(r);
    });
    return () => {
      live = false;
    };
  }, [open]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const sheet = sheetRef.current;
      if (!sheet) return;
      const items = focusables(sheet);
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const el = document.activeElement;
      if (e.shiftKey && el === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && el === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  const held = useMemo(() => coverage(pages, scope), [pages, scope]);
  const seen = useMemo(
    () => lastSeen(record?.events ?? [], scope),
    [record, scope],
  );
  // The division the stage is currently showing, so the reader can find
  // themselves on a grid of sixty identical squares.
  const here = useMemo(() => {
    const only = pages.find((p) => p.page === page);
    return only ? [...coverage([only], scope)] : [];
  }, [pages, page, scope]);

  if (!open) return null;

  const span = SPAN[scope](totalPages);
  const ids = Array.from({ length: span }, (_, i) => i + 1);
  const label = (id: number): string =>
    scope === "page" ? t.pageN(id) : scope === "hizb" ? t.hizbN(id) : t.juzN(id);

  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={t.mapTitle}
        dir={dir}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className={styles.grip} aria-hidden="true" />
        <header className={styles.head}>
          <span className={styles.glyph} aria-hidden="true">
            ۩
          </span>
          <h2 className={styles.title}>{t.mapTitle}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t.close}>
            ✕
          </button>
        </header>

        {/* Said once, here, and never repeated per cell. A caveat restated on
            every square becomes wallpaper; stated once under the title it is
            part of what the picture *is*. */}
        <p className={styles.caveat}>{t.mapCaveat}</p>

        <div className={styles.scopeRow} role="radiogroup" aria-label={t.mapScopeGroup}>
          {(["page", "hizb", "juz"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              className={styles.scope}
              aria-checked={scope === s}
              onClick={() => setScope(s)}
            >
              {s === "page" ? t.scopePage : s === "hizb" ? t.scopeHizb : t.scopeJuz}
            </button>
          ))}
        </div>

        {!revisionStoreSupported() ? (
          <p className={styles.body}>{t.mapNoStore}</p>
        ) : record === undefined ? (
          <p className={styles.body}>{t.mapLoading}</p>
        ) : (
          <>
            {/* The grid is mus'haf furniture — division 1 sits at the right and
                the book runs leftward, the same direction the page bar and the
                stage run in both UI languages. `ul`/`li` rather than a bare div
                so the count is announced before the cells are walked. */}
            <ul className={styles.grid} data-scope={scope} dir="rtl" aria-label={t.mapGrid}>
              {ids.map((id) => {
                const absent = !held.has(id);
                const day = seen.get(id);
                const days = day && asOf ? daysBetween(day, asOf) : null;
                const state = absent ? "absent" : day ? "seen" : "cold";
                return (
                  <li
                    key={id}
                    className={styles.cell}
                    data-state={state}
                    data-warmth={
                      state === "seen" && days !== null && !Number.isNaN(days)
                        ? warmth(days)
                        : undefined
                    }
                    data-here={here.includes(id) || undefined}
                    aria-label={
                      absent
                        ? t.mapCellAbsent(label(id))
                        : days !== null && !Number.isNaN(days)
                          ? t.mapCellSeen(label(id), days)
                          : t.mapCellNever(label(id))
                    }
                  />
                );
              })}
            </ul>

            {/* The inventory, in the unit on screen — the page bar's
                `pagesVendored` generalised. Counted from `held`, so an absent
                cell is never quietly folded into a total that reads as coverage. */}
            <p className={styles.inventory}>{t.mapHeld(held.size, span, scope)}</p>

            <ul className={styles.legend} aria-label={t.mapLegend}>
              <li className={styles.legendRow}>
                <span className={styles.cell} data-state="absent" aria-hidden="true" />
                {t.mapAbsent}
              </li>
              <li className={styles.legendRow}>
                <span className={styles.cell} data-state="cold" aria-hidden="true" />
                {t.mapNeverOpened}
              </li>
              <li className={styles.legendRow}>
                <span className={styles.cell} data-state="seen" data-warmth={4} aria-hidden="true" />
                {t.mapRecent}
              </li>
            </ul>

            {/* Always shown, empty record or not. This is the line that keeps an
                ITP wipe from reading as "you have revised nothing": a record
                dated this morning is visibly a new one. */}
            {record.since && <p className={styles.note}>{t.mapSince(record.since)}</p>}
          </>
        )}
      </div>
    </>
  );
}
