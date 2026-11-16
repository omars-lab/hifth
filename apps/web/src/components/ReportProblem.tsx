import { useState } from "react";
import { useT } from "../i18n";
import { SUPPORT_ADDRESS, gatherFacts, mailLink, reportText } from "../problem-report";
import styles from "./ReportProblem.module.css";

/**
 * "Report a problem" (launch item 18), in the info panel and on the card the
 * reader sees when the page stops.
 *
 * Closed, it is one button. Pressed, it builds the report then and there (so
 * the latest error is in it) and shows every line of it, says where it goes,
 * and offers two ways out that both leave the choice with the reader: open it
 * in their own mail app, where they still press send, or copy it. Copy shows
 * only where the page may use the clipboard; inside the apps it may not, and
 * the mail link is the way.
 *
 * Nothing here reads the reader's notes, marks or pages; `problem-report.ts`
 * says what goes in, and both its test and this one check that made-up notes
 * kept on the device never show up.
 */
export function ReportProblem({ headingLevel = 3 }: { headingLevel?: 2 | 3 | 4 }): JSX.Element {
  const { t } = useT();
  const [report, setReport] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (report === null) {
    return (
      <button
        type="button"
        className={styles.open}
        onClick={() => {
          setCopied(false);
          setReport(reportText(gatherFacts()));
        }}
      >
        {t.reportOpen}
      </button>
    );
  }

  const Heading = headingLevel === 2 ? "h2" : headingLevel === 4 ? "h4" : "h3";
  const canCopy = typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function";

  return (
    <div className={styles.panel} data-report-problem>
      <Heading className={styles.title}>{t.reportTitle}</Heading>
      <p className={styles.body}>{t.reportBody}</p>
      <p className={styles.to}>
        {t.reportTo} <bdi className={styles.address}>{SUPPORT_ADDRESS}</bdi>
      </p>
      <textarea
        className={styles.text}
        aria-label={t.reportTextLabel}
        readOnly
        dir="ltr"
        rows={10}
        value={report}
      />
      <div className={styles.actions}>
        <a className={styles.send} href={mailLink(report, t.reportMailIntro)}>
          {t.reportSend}
        </a>
        {canCopy && (
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              void navigator.clipboard.writeText(report).then(() => setCopied(true), () => setCopied(false));
            }}
          >
            {copied ? t.reportCopied : t.reportCopy}
          </button>
        )}
        <button type="button" className={styles.secondary} onClick={() => setReport(null)}>
          {t.reportClose}
        </button>
      </div>
    </div>
  );
}
