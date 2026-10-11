import { useEffect, useState } from "react";
import { useT, type Strings } from "../i18n";
import { rollUpUse, type UseFeature, type UseRow } from "../usage";
import { forgetUse, readUse, type UseRecord } from "../usage-store";
import styles from "./UsageReadout.module.css";

/**
 * The owner's own count of how often each part of the app is used, in the info
 * panel (docs/design/feature-usage.md). Read once when the panel opens: the
 * panel is a pause, and a list that moved while it was being read would be
 * counting its own reading.
 */

function nameOf(t: Strings, feature: UseFeature): string {
  switch (feature) {
    case "turn-page": return t.useTurnPage;
    case "lookalikes": return t.useLookalikes;
    case "commentary": return t.useCommentary;
    case "roots": return t.useRoots;
    case "listen": return t.useListen;
    case "share": return t.useShare;
    case "go-to": return t.useGoTo;
    case "zoom": return t.useZoom;
    case "verse-menu": return t.useVerseMenu;
    case "word-parts": return t.useWordParts;
    case "opened-map": return t.useOpenedMap;
    case "tajweed-key": return t.useTajweedKey;
    case "edition": return t.useEdition;
    case "info-panel": return t.useInfoPanel;
    case "pen-note": return t.usePen(t.toolNote);
    case "pen-highlight": return t.usePen(t.toolHighlight);
    case "pen-bookmark": return t.usePen(t.toolBookmark);
    case "pen-sign": return t.usePen(t.toolSign);
    case "pen-word": return t.usePen(t.toolWord);
    case "pen-mistake": return t.usePen(t.toolMistake);
    case "pen-crop": return t.usePen(t.toolCrop);
    case "pen-jump": return t.usePen(t.toolJump);
  }
}

function Strip({ row, label }: { row: UseRow; label: string }): JSX.Element {
  const most = Math.max(1, ...row.recent);
  return (
    <span className={styles.strip} role="img" aria-label={label}>
      {row.recent.map((n, i) => (
        <span
          key={i}
          className={n > 0 ? styles.bar : styles.empty}
          style={n > 0 ? { blockSize: `${Math.max(15, Math.round((n / most) * 100))}%` } : undefined}
        />
      ))}
    </span>
  );
}

export function UsageReadout(): JSX.Element {
  const { t } = useT();
  const [record, setRecord] = useState<UseRecord | null>(null);

  useEffect(() => {
    let live = true;
    void readUse().then((r) => {
      if (live) setRecord(r);
    });
    return () => {
      live = false;
    };
  }, []);

  const forget = () => {
    void forgetUse()
      .then(() => readUse())
      .then(setRecord);
  };

  const rows = record ? rollUpUse(record.days, record.today) : [];
  const used = rows.filter((r) => r.total > 0);
  const never = rows.filter((r) => r.total === 0);

  return (
    <section className={styles.block} aria-labelledby="colophon-usage" data-testid="usage-readout">
      <h3 className={styles.subhead} id="colophon-usage">
        {t.useTitle}
      </h3>
      {record && used.length === 0 && <p className={styles.note}>{t.useEmpty}</p>}
      {used.length > 0 && (
        <ol className={styles.rows}>
          {used.map((row) => (
            <li key={row.feature} className={styles.row} data-feature={row.feature}>
              <span className={styles.name}>{nameOf(t, row.feature)}</span>
              <span className={styles.times} data-total={row.total}>
                {t.useTimes(row.total)}
              </span>
              <Strip row={row} label={t.useStripAria} />
              {row.lastDay && <span className={styles.last}>{t.useLast(row.lastDay)}</span>}
            </li>
          ))}
        </ol>
      )}
      {never.length > 0 && record && used.length > 0 && (
        <details className={styles.never}>
          <summary>{t.useNeverHead(never.length)}</summary>
          <p className={styles.note}>{never.map((r) => nameOf(t, r.feature)).join(" · ")}</p>
        </details>
      )}
      {record?.since && <p className={styles.note}>{t.useSince(record.since)}</p>}
      <p className={styles.note}>{t.useNote}</p>
      {used.length > 0 && (
        <button type="button" className={styles.forget} onClick={forget} data-testid="usage-forget">
          {t.useForget}
        </button>
      )}
    </section>
  );
}
