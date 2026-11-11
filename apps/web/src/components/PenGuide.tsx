import { useLayoutEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { TOUCH_QUERY, useMediaQuery } from "../useMediaQuery";
import { isMarkAim, toolsFor, type MarkAim, type MarkTools } from "../mark-tools";
import { PENS, savedPen, savedWordPen, type Pen } from "../pen";
import type { TipPens } from "../pen-ring";
import type { PageTool } from "./PageStage";
import { TOOLS, ToolIcon, toolHint, toolName } from "./PageToolbar";
import { PenHomeHere } from "./PenHomes";
import styles from "./PenGuide.module.css";

type Words = ReturnType<typeof useT>["t"];

/** When a hafiz would reach for a tool: the half of its line the bars have no room for. */
function toolWhen(t: Words, x: PageTool): string {
  switch (x) {
    case "read":
      return t.penGuideWhenRead;
    case "select":
      return t.penGuideWhenSelect;
    case "highlight":
      return t.penGuideWhenHighlight;
    case "bookmark":
      return t.penGuideWhenBookmark;
    case "note":
      return t.penGuideWhenNote;
    case "sign":
      return t.penGuideWhenSign;
    case "word":
      return t.penGuideWhenWord;
    case "mistake":
      return t.penGuideWhenMistake;
    case "crop":
      return t.penGuideWhenCrop;
    case "jump":
      return t.penGuideWhenJump;
    default:
      return "";
  }
}

const lineId = (x: PageTool): string => `pen-guide-${x}`;
const PENS_ID = "pen-guide-pens";
const WORD_PENS_ID = "pen-guide-word-pens";

/**
 * A page in the info panel that shows the pens an Apple Pencil opens at its
 * tip and says what each does (.claude/plans/open-work-2026-11.md, 3b; the
 * owner, 2026-11-10).
 *
 * The pens are the ones the iPad opens (`PenHomeHere`, the same inside as
 * `PenHomeAt`), in the layout the reader set, and they work. They run on this
 * page's own tool, lock and pens, never the app's: a press here is for
 * trying, so nothing lands on the mus'haf page and nothing is remembered.
 *
 * What a tool does is the line its hover label and the bar's help line already
 * say (`toolHint`), so the three cannot disagree; when to reach for it is
 * added here, where there is room.
 */
export function PenGuide({ layout, marks, onBack }: { layout: TipPens; marks: MarkTools; onBack: () => void }): JSX.Element {
  const { t } = useT();
  const touch = useMediaQuery(TOUCH_QUERY);
  const [tool, setTool] = useState<PageTool>("select");
  const [locked, setLocked] = useState(false);
  const [pen, setPen] = useState<Pen>(() => savedPen());
  const [wordPen, setWordPen] = useState<Pen>(() => savedWordPen());
  const [lastAim, setLastAim] = useState<MarkAim>("note");
  const aim = marks === "one" ? (isMarkAim(tool) ? tool : lastAim) : undefined;
  const tools = toolsFor(TOOLS, marks, aim ?? "note");
  const onTool = (next: PageTool, lock?: boolean) => {
    if (isMarkAim(next)) setLastAim(next);
    setTool(next);
    setLocked(!!lock);
  };
  const back = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    back.current?.focus({ preventScroll: true });
  }, []);
  const line = (x: PageTool) => `${toolHint(t, x, touch)}. ${toolWhen(t, x)}`;

  return (
    <div
      className={styles.guide}
      data-pen-guide=""
      onKeyDown={(e) => {
        // One Escape goes back to the info panel; the next closes it.
        if (e.key !== "Escape") return;
        e.stopPropagation();
        onBack();
      }}
    >
      <div className={styles.top}>
        <button ref={back} type="button" className={styles.back} onClick={onBack}>
          <svg className={styles.chevron} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 3L5 8l5 5" />
          </svg>
          <span>{t.penGuideBack}</span>
        </button>
        <h3 className={styles.title}>{t.penGuideSection}</h3>
      </div>

      <section className={styles.part} aria-labelledby="pen-guide-how">
        <h4 className={styles.head} id="pen-guide-how">
          {t.penGuideHowTitle}
        </h4>
        <ul className={styles.how}>
          <li>{t.penGuideHowSqueeze}</li>
          <li>{t.penGuideHowDoubleTap}</li>
        </ul>
        <p className={styles.text}>{t.penGuideHowSettings}</p>
      </section>

      <section className={styles.part} aria-labelledby="pen-guide-try">
        <h4 className={styles.head} id="pen-guide-try">
          {t.penGuideTryTitle}
        </h4>
        <p className={styles.text}>{t.penGuideTry}</p>
        <div className={styles.stand}>
          <PenHomeHere
            layout={layout}
            tool={tool}
            locked={locked}
            onTool={onTool}
            pen={pen}
            onPen={setPen}
            tools={tools}
            aim={aim}
            words={{ pen: wordPen, onPen: setWordPen }}
            explained={{ tool: lineId, pen: PENS_ID, words: WORD_PENS_ID }}
          />
        </div>
        {/* What the pen just pressed does, under the pens, so the reader need
            not look for its line in the list. */}
        <p className={styles.now} aria-live="polite" data-pen-guide-now={tool}>
          <strong>{toolName(t, tool)}</strong>
          <span>{line(tool)}</span>
        </p>
      </section>

      <section className={styles.part} aria-labelledby="pen-guide-list">
        <h4 className={styles.head} id="pen-guide-list">
          {t.penGuideListTitle}
        </h4>
        <ul className={styles.list}>
          {TOOLS.map(({ tool: x }) => (
            <li key={x} className={styles.row} data-explains={x} data-on={tool === x || undefined}>
              <span className={styles.icon} aria-hidden="true">
                <ToolIcon tool={x} />
              </span>
              <span className={styles.says}>
                <strong>{toolName(t, x)}</strong>
                <span id={lineId(x)}>{line(x)}</span>
              </span>
            </li>
          ))}
          <li className={styles.row} data-explains="pens">
            <span className={styles.swatches} aria-hidden="true">
              {PENS.map((x) => (
                <span key={x} className={styles.swatch} style={{ background: `var(--pen-${x})` }} />
              ))}
            </span>
            <span className={styles.says}>
              <strong>{t.penLabel}</strong>
              <span id={PENS_ID}>{t.penGuidePens}</span>
            </span>
          </li>
          <li className={styles.row} data-explains="word-pens">
            <span className={styles.swatches} data-words="" aria-hidden="true">
              {PENS.map((x) => (
                <span key={x} className={styles.swatch} style={{ background: `var(--pen-${x})` }} />
              ))}
            </span>
            <span className={styles.says}>
              <strong>{t.penWordsLabel}</strong>
              <span id={WORD_PENS_ID}>{t.penGuideWordPens}</span>
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
