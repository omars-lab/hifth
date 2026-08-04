import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  comparableEvents,
  dayOf,
  daysBetween,
  lastSeen,
  scopesOf,
  type EditionId,
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
  /**
   * The edition on the stage — which *print* the page numbers below refer to.
   *
   * Not derived from `pages[0].edition`, though it always agrees with it. The
   * pages say which paper this build holds; this says which paper the record is
   * being read against, and they are two different claims that happen to have
   * one answer while exactly one edition is vendored. Deriving it would make the
   * distinction disappear on the day it starts to matter.
   */
  edition: EditionId;
  /** How long the print is — 604 for the Madani mus'haf, not what we vendored. */
  totalPages: number;
  /** The page on the stage, ringed on the map so the reader can find themselves. */
  page: number;
  /**
   * Open a page — the app's own `goToPage`, handed over unchanged.
   *
   * The map is the only surface in the app that shows the *whole* mus'haf at
   * once, so it is the natural place to reach from, and until now it was the one
   * picture you could not touch (`docs/design/revision-record.md` ②). A press on
   * a cell lands on the division's first vendored page and closes the sheet.
   *
   * The app's function rather than a page number and a callback of our own,
   * because everything a turn owes — refusing an unvendored page, cancelling an
   * in-flight one, announcing the landing — already lives in it. A second path
   * to a page is a second announcer, and the two would drift.
   *
   * `said` is what the announcer reads. This sheet passes one at hizb and juz
   * scope because the reader pressed a *division* and arrives on a *page*, and a
   * landing that only says the page number leaves them to work out whether it is
   * the right juz. At page scope the two are the same fact and `goToPage`'s own
   * wording is already exactly right.
   */
  onGoToPage: (page: number, said?: string) => void;
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

/**
 * Focusable descendants of `root`, in tab order. Colophon's helper, with one
 * clause added — and the clause is the point.
 *
 * The grid's cells are real `<button>`s, and all but one of them carry
 * `tabindex="-1"` (see the roving cursor below). Colophon's version matches
 * `button:not([disabled])` outright, so it would have collected all 604 of them
 * and handed the Tab trap a `last` element somewhere in the middle of the map.
 * A helper copied verbatim is only verbatim until one of its callers grows a
 * widget, and this is that caller.
 */
function focusables(root: HTMLElement): HTMLElement[] {
  const sel =
    'button:not([disabled]):not([tabindex="-1"]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll<HTMLElement>(sel));
}

/**
 * The divisions this build holds paper for, at one scope, and where each opens.
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
 *
 * ## The value, which is where a tap lands
 *
 * The **lowest vendored page** carrying any ayah of the division — the page the
 * division opens on, for every edition that holds it whole, and the earliest
 * paper we have for it in one that does not. That is the destination of a press
 * on the cell (`docs/design/revision-record.md` ②).
 *
 * Lowest rather than first-encountered, for the same reason the sweep is per
 * ayah: `pages` is not promised ascending anywhere, and a landing that depended
 * on array order would be right today and wrong the first time a manifest was
 * written in another order — arriving as a jump to the wrong end of a juz rather
 * than as an error anyone could see.
 *
 * Derived from the manifest rather than looked up in `HIZB_STARTS`, which is the
 * other thing it could have been. The start table knows which *ayah* opens a
 * hizb; it does not know which page of this build that ayah is printed on, or
 * whether this build has that page at all. Reading the division's page off the
 * pages we actually hold makes an unreachable landing unrepresentable instead of
 * a case to remember to handle.
 */
export function holdings(
  pages: readonly PageMeta[],
  scope: RevisionScope,
): Map<number, number> {
  const held = new Map<number, number>();
  for (const meta of pages) {
    for (const polygon of meta.polygons) {
      const probe: RevisionEvent = { key: polygon.key, page: meta.page, at: 0, tz: 0 };
      for (const id of scopesOf(probe, scope)) {
        const first = held.get(id);
        if (first === undefined || meta.page < first) held.set(id, meta.page);
      }
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
 * This was written when three of 604 pages were vendored: if the un-visitable 601
 * rendered as the same grey as "here, and never opened", the picture told a hafiz
 * they had abandoned 99.5% of the Qur'an — false, and entirely an artefact of the
 * build. So absent is a different treatment *in kind*: no fill at all, a dashed
 * hairline, reading as "no paper here" rather than "paper you neglected". Absent
 * cells are counted out of every total, and the sheet carries the inventory line
 * the page bar established («المتوفّر ٦٠٤ من ٦٠٤ صفحة»), in whatever unit is on
 * screen.
 *
 * Loop 4b vendored the print, so on today's build no cell is absent — and that is
 * exactly when this rule is easiest to lose. It is not a workaround for a partial
 * corpus: it is what the map owes any edition that does not carry the whole
 * mus'haf, and the next one may not. `RevisionMap.test.tsx` holds it against a
 * fixture, and `e2e/revision.spec.ts` against a trimmed manifest.
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
 * ## The picture is also a way in
 *
 * Pressing a cell opens that division — its first vendored page — and closes the
 * sheet. The sheet was a read-only picture for two loops because the page behind
 * a cell might not have been in the build, and a control that navigates
 * somewhere else is the failure this repo names most often; Loop 4b vendored the
 * print and removed the reason to wait. Even so the destination is read off
 * `pages` rather than off a division-start table, so an unreachable landing
 * stays unrepresentable — see `holdings`.
 *
 * **Absent cells are not pressed.** They are the one part of this grid with no
 * paper behind them, so they stay plain list items: an affordance that refuses
 * is worse than no affordance, and it is exactly the confusion between "absent"
 * and "cold" this component is otherwise built to prevent, restated in the
 * cursor.
 *
 * ## A11y: Colophon's contract, plus one composite widget
 *
 * Modal dialog, focus in, Tab trapped, Escape closes, focus restored to the page
 * chip that opened it.
 *
 * The grid is where that contract needed more than a copy. At page scope it is
 * 604 cells, and 604 buttons is 604 tab stops inside a trapped dialog — a reader
 * on a keyboard would be pressing Tab for a minute to get past a picture. So the
 * grid is a **roving tabindex**: one cell carries `tabindex="0"` and the rest
 * carry `-1`, the arrows move the cursor, Home and End go to the ends, and the
 * whole map is one stop. The cursor starts on the division the reader is already
 * in, because that is where they are.
 *
 * Left and right step one division through the book — the grid is `dir="rtl"`,
 * so ArrowLeft advances, the same direction the page bar and the stage run. Up
 * and down move by a row, and the row is *measured* rather than known: the phone
 * lays these cells out with `auto-fill`, so the column count is the browser's
 * answer to the window and nothing in the DOM has it. A stride guessed from the
 * scope would be right on a desktop and quietly wrong on every phone.
 *
 * The cells are small — 16px at page scope — which is under WCAG 2.5.8's 24px
 * and is not fixable here: a map of 604 pages drawn at 24px is no longer a map
 * you can see at once, which is the only reason to open it. The criterion's
 * *equivalent control* exception is what carries it, and the equivalent is real
 * rather than argued: the jumper in the chrome goes to any page in the print,
 * with a text field. Hizb (26px) and juz (40px) clear the threshold outright.
 */
export function RevisionMap({
  open,
  onClose,
  pages,
  edition,
  totalPages,
  page,
  onGoToPage,
  today,
}: RevisionMapProps): JSX.Element | null {
  const { t, dir } = useT();
  const sheetRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLUListElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const [scope, setScope] = useState<RevisionScope>("hizb");
  // Which cell holds the grid's single tab stop, or `null` for "wherever the
  // reader is standing" — resolved at render, because `here` is not known until
  // the pages and the scope are both in hand. Cleared on a scope change: hizb 47
  // and juz 47 are different places, and carrying the number across would leave
  // the cursor somewhere the reader never put it.
  const [cursor, setCursor] = useState<number | null>(null);
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

  const held = useMemo(() => holdings(pages, scope), [pages, scope]);
  // Through `comparableEvents`, never straight from the record. A record outlives
  // the build that wrote it, so the day a second edition is vendored the looks
  // already stored are another print's page numbers — and at page scope those
  // are different ayahs wearing the same integer. Juz and hizb pass through
  // untouched, and that is not an oversight: those divisions are the same in
  // every print, so filtering them would drop looks that really do belong to the
  // square. The asymmetry lives in core (`revision.ts`), not here.
  const seen = useMemo(
    () => lastSeen(comparableEvents(record?.events ?? [], scope, edition), scope),
    [record, scope, edition],
  );
  // The division the stage is currently showing, so the reader can find
  // themselves on a grid of sixty identical squares.
  const here = useMemo(() => {
    const only = pages.find((p) => p.page === page);
    return only ? [...holdings([only], scope).keys()] : [];
  }, [pages, page, scope]);

  if (!open) return null;

  const span = SPAN[scope](totalPages);
  const ids = Array.from({ length: span }, (_, i) => i + 1);
  const label = (id: number): string =>
    scope === "page" ? t.pageN(id) : scope === "hizb" ? t.hizbN(id) : t.juzN(id);

  /**
   * The next cell with paper behind it, `delta` away and then onward.
   *
   * One helper for every move because they differ only in the size of the first
   * hop: after that, all of them walk one cell at a time until they find a
   * division this build holds. Landing *on* an absent cell would put the tab
   * stop on something that cannot be pressed, and skipping past it silently is
   * what a reader means by an arrow key.
   */
  const step = (from: number, delta: number): number | null => {
    const dir = delta > 0 ? 1 : -1;
    for (let id = from + delta; id >= 1 && id <= span; id += dir) {
      if (held.has(id)) return id;
    }
    return null;
  };

  // Where the tab stop is: the reader's own division while they have not moved
  // the cursor, and failing that the first cell with paper behind it.
  const cursorId = cursor ?? here[0] ?? step(0, 1);

  /**
   * How many cells to a row — asked of the browser, not of the scope.
   *
   * On a phone the grid is `auto-fill`, so the column count is whatever the
   * window allowed; only the laid-out DOM knows it. The first cell whose
   * `offsetTop` differs from the first cell's is the start of row two, and its
   * index is the stride. A grid that has not been laid out (jsdom) answers "one
   * row", which turns ArrowDown into End — wrong, but wrong in the harness
   * rather than in a browser, and `e2e/revision.spec.ts` drives the real thing.
   */
  const rowStride = (): number => {
    const kids = Array.from(gridRef.current?.children ?? []) as HTMLElement[];
    const top = kids[0]?.offsetTop;
    for (let i = 1; i < kids.length; i += 1) {
      if (kids[i]!.offsetTop !== top) return i;
    }
    return Math.max(kids.length, 1);
  };

  const onGridKey = (e: React.KeyboardEvent<HTMLUListElement>): void => {
    if (cursorId === null) return;
    let next: number | null;
    switch (e.key) {
      // The grid is `dir="rtl"`, so the book runs leftward and ArrowLeft is the
      // next division. Said here once; the sides are not restated anywhere else
      // in this file.
      case "ArrowLeft":
        next = step(cursorId, 1);
        break;
      case "ArrowRight":
        next = step(cursorId, -1);
        break;
      case "ArrowDown":
        next = step(cursorId, rowStride());
        break;
      case "ArrowUp":
        next = step(cursorId, -rowStride());
        break;
      case "Home":
        next = step(0, 1);
        break;
      case "End":
        next = step(span + 1, -1);
        break;
      default:
        return;
    }
    // Claimed even when the move found nothing: inside a grid widget ArrowDown
    // is a cursor move, and letting it fall through to scroll the sheet at the
    // last row is the reader's page jumping under a key that did nothing.
    e.preventDefault();
    if (next === null) return;
    setCursor(next);
    // Focus now rather than in an effect. The button already exists — only its
    // `tabindex` is about to change — and an effect that focused on every
    // `cursor` change would also fire on the mount that set it from `here`,
    // stealing focus from the close button the sheet opens on.
    gridRef.current?.querySelector<HTMLElement>(`[data-id="${next}"]`)?.focus();
  };

  /** A press on a cell: open that division, and get out of the way. */
  const openDivision = (id: number, at: number): void => {
    onGoToPage(at, scope === "page" ? undefined : t.mapWentTo(label(id), at));
    // After the navigation, so the announcer's line is queued before the sheet
    // tears down and hands focus back to the page chip.
    onClose();
  };

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
              onClick={() => {
                setScope(s);
                // Hizb 47 and juz 47 are different places. A cursor carried
                // across a scope change would sit somewhere the reader never
                // put it, and the next arrow key would move from there.
                setCursor(null);
              }}
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
            <ul
              ref={gridRef}
              className={styles.grid}
              data-scope={scope}
              dir="rtl"
              aria-label={t.mapGrid}
              onKeyDown={onGridKey}
            >
              {ids.map((id) => {
                const at = held.get(id);
                const day = seen.get(id);
                const days = day && asOf ? daysBetween(day, asOf) : null;
                const state = at === undefined ? "absent" : day ? "seen" : "cold";
                // Every cell says the same four things, whether or not it can be
                // pressed. Written once so the two branches below cannot drift
                // into describing the same square differently.
                const marks = {
                  "data-state": state,
                  "data-warmth":
                    state === "seen" && days !== null && !Number.isNaN(days)
                      ? warmth(days)
                      : undefined,
                  "data-here": here.includes(id) || undefined,
                  "aria-label":
                    at === undefined
                      ? t.mapCellAbsent(label(id))
                      : days !== null && !Number.isNaN(days)
                        ? t.mapCellSeen(label(id), days)
                        : t.mapCellNever(label(id)),
                };
                // No paper behind it, so nothing to press — and no button, which
                // is the whole distinction: a control that refuses is worse than
                // an outline that never offered.
                if (at === undefined) return <li key={id} className={styles.cell} {...marks} />;
                return (
                  <li key={id} className={styles.slot}>
                    <button
                      type="button"
                      className={styles.cell}
                      data-id={id}
                      {...marks}
                      tabIndex={id === cursorId ? 0 : -1}
                      onClick={() => openDivision(id, at)}
                    />
                  </li>
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
