import { Suspense, useState } from "react";
import { arrangePassages, orderForHifz, qulVerseUrlFromKey, wordDiff, type Edge } from "@hifth/core";
import { edgeNote } from "../edge-note";
import { useT } from "../i18n";
import { usePassageRows } from "../passage-rows";
// Loaded the first time a look-alike is opened out (see ./later.tsx).
import { DiffView } from "./later";
import { LookalikeReason } from "./SharedPreview";
import styles from "./HopPopover.module.css";

export interface HopRowsProps {
  /** One group's look-alikes, in any order: they are listed nearest first. */
  edges: readonly Edge[];
  /** The verse they are look-alikes of — the comparison's "here". */
  fromKey: string | null;
  /** Whether a look-alike's page is carried (loadable). Not carried → link out instead. */
  canHop: (toKey: string) => boolean;
  /** Go to a look-alike. */
  onHop: (edge: Edge) => void;
}

/**
 * The rows of one group of look-alikes: each a "hop there" arrow and a line
 * that opens to show *why* the pair is confusable, the shared words marked.
 * Shared by the card the rail's chips open and the look-alike sections inside
 * the verse's drawer, so the two never drift apart. Which row is opened out is
 * kept here, so it starts closed each time the list is drawn afresh.
 */
export function HopRows({ edges, fromKey, canHop, onHop }: HopRowsProps): JSX.Element {
  const { t, lang } = useT();
  const passageRows = usePassageRows();
  const [expanded, setExpanded] = useState<string | null>(null);
  // A passage listed beside a verse inside it is laid out as the reader chose (item 47).
  const rows = arrangePassages(orderForHifz(edges), passageRows);

  return (
    <ul className={styles.list}>
      {rows.map(({ edge, inside }) => {
        const enabled = canHop(edge.to);
        // A look-alike that is a whole passage is named as the passage.
        const label = (edge.through ? t.rangeLabel(edge.to, edge.through) : t.ayahLabel(edge.to)) ?? edge.to;
        // When we do not carry the target's page, the leap is honestly
        // disabled — but the verse still exists, so we link out to it on the
        // outside library rather than dead-ending (the qul-reliance
        // decision's "link back to it" half). Ships a URL, not bytes.
        const qulUrl = enabled ? null : qulVerseUrlFromKey(edge.to);
        // A pair that matches in more than one place names no words, so
        // there is nothing to lay side by side: its row does not offer to open.
        const comparable = fromKey !== null && wordDiff(edge, fromKey) !== null;
        const isOpen = comparable && expanded === edge.to;
        const note = edgeNote(edge, lang);
        const diffId = `diff-${edge.to.replace(/[^\w-]/g, "-")}`;
        return (
          <li key={edge.to} className={styles.row} data-inside={inside || undefined}>
            <div className={styles.rowMain}>
              <button
                type="button"
                className={styles.rowText}
                aria-expanded={comparable ? isOpen : undefined}
                aria-controls={comparable ? diffId : undefined}
                onClick={comparable ? () => setExpanded((k) => (k === edge.to ? null : edge.to)) : undefined}
              >
                <span className={styles.rowLabel}>
                  {label}
                  {edge.twin && <span className={styles.badge}>{t.twin}</span>}
                  {edge.root && <span className={styles.root}>{edge.root}</span>}
                  {comparable && (
                    <span className={styles.caret} data-open={isOpen || undefined} aria-hidden="true">
                      ⌄
                    </span>
                  )}
                </span>
                {note && (
                  <span className={styles.note} lang={note.lang} dir={note.dir}>
                    {note.text}
                  </span>
                )}
                <LookalikeReason edge={edge} open={isOpen} className={styles.note} />
                {!enabled && <span className={styles.unavailable}>{t.pageUnavailable}</span>}
              </button>
              {qulUrl ? (
                <a
                  className={styles.qul}
                  href={qulUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t.openOnQulAria(label)}
                >
                  <span className={styles.qulLabel}>{t.openOnQul}</span>
                  <span aria-hidden="true">{"↗︎"}</span>
                </a>
              ) : (
                <button
                  type="button"
                  className={styles.hop}
                  disabled={!enabled}
                  onClick={() => onHop(edge)}
                  aria-label={t.hopTo(label)}
                >
                  <span aria-hidden="true">{"↪︎"}</span>
                </button>
              )}
            </div>
            {isOpen && fromKey !== null && (
              <div id={diffId}>
                <Suspense fallback={null}>
                  <DiffView edge={edge} fromKey={fromKey} />
                </Suspense>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
