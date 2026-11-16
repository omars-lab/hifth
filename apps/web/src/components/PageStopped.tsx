import { Component, type ReactNode } from "react";
import { noteFault } from "../fault-log";
import { useT } from "../i18n";
import { ReportProblem } from "./ReportProblem";
import styles from "./PageStopped.module.css";

/**
 * What the reader sees when a part of the page throws while it draws.
 *
 * Without it, one part failing took the whole page with it and left a blank
 * screen with nothing to press (launch item 15). This says the page stopped,
 * says the reader's notes and marks are safe (they are kept on the device as
 * they are made, not in the page), and offers the one thing that helps:
 * opening the page again. Under it, "Report a problem" (launch item 18) shows
 * the reader a report that already holds what went wrong (kept for it in
 * `fault-log.ts`), and sends nothing unless they choose to mail it.
 *
 * It sits inside the language provider, so it speaks the reader's language.
 * A part that only fails to load (a tool's file missing offline) is caught
 * closer by `Later`, and the page keeps working without that one tool.
 */
export class PageStopped extends Component<
  { children: ReactNode; reload?: () => void },
  { stopped: boolean }
> {
  override state = { stopped: false };

  static getDerivedStateFromError(): { stopped: boolean } {
    return { stopped: true };
  }

  override componentDidCatch(error: unknown): void {
    noteFault("drawing", error);
  }

  override render(): ReactNode {
    if (!this.state.stopped) return this.props.children;
    return <StoppedScreen reload={this.props.reload ?? (() => window.location.reload())} />;
  }
}

function StoppedScreen({ reload }: { reload: () => void }): JSX.Element {
  const { t } = useT();
  return (
    <main className={styles.screen}>
      <div className={styles.card} role="alert">
        <h1 className={styles.title}>{t.pageStoppedTitle}</h1>
        <p className={styles.body}>{t.pageStoppedBody}</p>
        <button type="button" className={styles.reload} onClick={reload}>
          {t.pageStoppedReload}
        </button>
        <ReportProblem headingLevel={2} />
      </div>
    </main>
  );
}
