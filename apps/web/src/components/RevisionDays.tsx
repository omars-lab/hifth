import { useMemo, useState } from "react";
import { daysOf, editionOf, type DayCount, type DayStamp, type RevisionEvent } from "@hifth/core";
import { useT } from "../i18n";
import styles from "./RevisionDays.module.css";

/*
 * The record, day by day (docs/design/revision-record.md ⑤): what was opened on
 * each day and which mistakes were marked, drawn two ways. "month" is a calendar
 * month, one square a day, with the day pressed spelled out under it; "days" is
 * the days that have anything on them, newest first, each spelled out in full.
 * Both read the same counts (`daysOf`), so they cannot disagree.
 *
 * Counted from the device's own record, never from the marks on the page: the
 * record carries the reader's clock, keeps a mistake whose mark was cleared, and
 * cannot be filled by a file loaded from another device.
 */

export type DaysLayout = "month" | "days";

export interface RevisionDaysProps {
  layout: DaysLayout;
  events: readonly RevisionEvent[];
  /** The day the record began, or null when the store could not say. */
  since: DayStamp | null;
  /** Today by the reader's clock. */
  today: DayStamp;
  edition: string;
  /** Open a verse and close the sheet. */
  onGoToVerse?: ((key: string) => void) | undefined;
}

const two = (n: number): string => String(n).padStart(2, "0");

export function RevisionDays({ layout, events, since, today, edition, onGoToVerse }: RevisionDaysProps): JSX.Element {
  const { t } = useT();
  const days = useMemo(() => daysOf(events, edition), [events, edition]);
  const byDay = useMemo(() => new Map(days.map((d) => [d.day, d])), [days]);
  // The record's first day: where it says it began, or its oldest look if that is earlier.
  const oldest = days[days.length - 1]?.day;
  const first = [since, oldest, today].filter((d): d is DayStamp => !!d).sort()[0]!;
  const [month, setMonth] = useState(today.slice(0, 7));
  const [picked, setPicked] = useState<DayStamp | null>(null);

  const headline = (d: DayCount): string =>
    d.mistakes.length > 0 ? t.mapCellSlips(t.dayLong(d.day), d.mistakes.length) : t.dayOpened(d.day);

  const kindOf = (m: RevisionEvent): string =>
    m.what === "sign"
      ? t.toolSign
      : m.what === "letter"
        ? t.mistakeKindLetter
        : m.what === "rule"
          ? t.mistakeKindRule
          : m.what === "verse"
            ? t.dayKindVerse
            : t.mistakeWholeWord;

  const body = (d: DayCount): JSX.Element => (
    <>
      {/* A look the book cannot place (a key from a print long gone) counts as a
          look and nothing else, so a day of only those has no line to show. */}
      {d.verses > 0 && (
        <p className={styles.line}>
          {[
            t.noteVerses(d.verses),
            d.pages.length > 0 && t.pagesN(d.pages.length),
            ...d.juz.map((j) => t.juzN(j)),
          ]
            .filter(Boolean)
            .join(t.sep)}
        </p>
      )}
      {d.mistakes.length > 0 && (
        <>
          <p className={styles.line}>
            {[
              d.kinds.word > 0 && `${t.mistakeWholeWord} ${t.num(d.kinds.word)}`,
              d.kinds.sign > 0 && `${t.toolSign} ${t.num(d.kinds.sign)}`,
              d.kinds.letter > 0 && `${t.mistakeKindLetter} ${t.num(d.kinds.letter)}`,
              d.kinds.rule > 0 && `${t.mistakeKindRule} ${t.num(d.kinds.rule)}`,
              d.kinds.verse > 0 && `${t.dayKindVerse} ${t.num(d.kinds.verse)}`,
              ...d.mistakePages.map((p) => t.pageN(p)),
            ]
              .filter(Boolean)
              .join(t.sep)}
          </p>
          <ul className={styles.mistakes}>
            {d.mistakes.map((m) => {
              const said = `${t.ayahLabel(m.key) ?? m.key}${t.sep}${kindOf(m)}`;
              return (
                <li key={`${m.at}:${m.key}`}>
                  {onGoToVerse && editionOf(m) === edition ? (
                    <button type="button" className={styles.mistake} data-mistake="" onClick={() => onGoToVerse(m.key)}>
                      {said}
                    </button>
                  ) : (
                    <span className={styles.mistake} data-mistake="">
                      {said}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );

  if (layout === "days") {
    return days.length === 0 ? (
      <p className={styles.line}>{t.daysNone}</p>
    ) : (
      <ul className={styles.days} aria-label={t.mapViewDays}>
        {days.map((d) => (
          <li key={d.day} className={styles.day}>
            <h3 className={styles.dayHead}>{headline(d)}</h3>
            {body(d)}
          </li>
        ))}
      </ul>
    );
  }

  const year = Number(month.slice(0, 4));
  const mon = Number(month.slice(5, 7));
  const length = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(year, mon - 1, 1)).getUTCDay() - t.weekStart + 7) % 7;
  const step = (by: number) => {
    const to = new Date(Date.UTC(year, mon - 1 + by, 1));
    setMonth(`${to.getUTCFullYear()}-${two(to.getUTCMonth() + 1)}`);
    setPicked(null);
  };
  const shown = picked ? byDay.get(picked) : undefined;

  return (
    <>
      <div className={styles.monthHead}>
        <button
          type="button"
          className={styles.step}
          aria-label={t.monthEarlier}
          disabled={month <= first.slice(0, 7)}
          onClick={() => step(-1)}
        >
          ‹
        </button>
        <span className={styles.monthName} aria-hidden="true">
          {t.monthLong(year, mon)}
        </span>
        <button
          type="button"
          className={styles.step}
          aria-label={t.monthLater}
          disabled={month >= today.slice(0, 7)}
          onClick={() => step(1)}
        >
          ›
        </button>
      </div>
      <div className={styles.month} role="group" aria-label={t.monthLong(year, mon)}>
        {t.weekdays.map((name) => (
          <span key={name} className={styles.weekday} aria-hidden="true">
            {name}
          </span>
        ))}
        {Array.from({ length }, (_, i) => {
          const stamp = `${month}-${two(i + 1)}`;
          const d = byDay.get(stamp);
          const outside = stamp < first || stamp > today;
          const count = d?.mistakes.length ?? 0;
          return (
            <button
              key={stamp}
              type="button"
              className={styles.square}
              style={i === 0 ? { gridColumnStart: lead + 1 } : undefined}
              data-day={stamp}
              data-state={outside ? "outside" : d ? "worked" : "idle"}
              data-mistakes={count > 0 ? count : undefined}
              data-today={stamp === today ? "" : undefined}
              aria-pressed={picked === stamp}
              aria-label={outside ? t.dayOutside(stamp) : d ? headline(d) : t.dayNothing(stamp)}
              disabled={outside}
              onClick={() => setPicked(stamp)}
            >
              <span>{t.num(i + 1)}</span>
              {count > 0 && (
                <span className={styles.count} aria-hidden="true">
                  {t.num(count)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className={styles.picked} aria-live="polite">
        {!picked ? (
          <p className={styles.line}>{t.dayPick}</p>
        ) : shown ? (
          <>
            <h3 className={styles.dayHead}>{headline(shown)}</h3>
            {body(shown)}
          </>
        ) : (
          <p className={styles.line}>{t.dayNothing(picked)}</p>
        )}
      </div>
    </>
  );
}
