import { useRef, useState } from "react";
import { useT } from "../i18n";
import { applyWordPen, PENS, rememberWordPen, savedWordPen, type Pen } from "../pen";
import styles from "./PenPicker.module.css";

/**
 * The highlighter's four pens, offered in the tools bar while the highlighter
 * is on (the owner, 2026-09-30: "selectable from the toolbar for the
 * highlighter"). The pen picked colours the passage the highlighter paints;
 * pen.ts remembers it and puts it on the page.
 *
 * Beside them, the same four for the words you hold (the owner, 2026-10-12,
 * docs/design/highlight-texture-options.md ⑤), drawn as short bands, the shape
 * a few held words make, so the two rows are not told apart by place alone.
 * That pick is kept here rather than in App: nothing else reads it, and App
 * only puts the remembered one on the page when it starts.
 *
 * One tab stop and arrow keys along each row, like the tools beside them: the
 * pens are radios because exactly one is picked. The pick is said by a ring as
 * well as by the colour, so colour is never the only sign of it.
 */
export function PenPicker({ pen, onPen }: { pen: Pen; onPen: (pen: Pen) => void }): JSX.Element {
  const { t } = useT();
  const [wordPen, setWordPen] = useState<Pen>(() => savedWordPen());
  const chooseWordPen = (next: Pen) => {
    rememberWordPen(next);
    applyWordPen(next);
    setWordPen(next);
  };
  return (
    <div className={styles.both}>
      <PenRow label={t.penLabel} pen={pen} onPen={onPen} />
      <PenRow label={t.penWordsLabel} pen={wordPen} onPen={chooseWordPen} words />
    </div>
  );
}

function PenRow({
  label,
  pen,
  onPen,
  words = false,
}: {
  label: string;
  pen: Pen;
  onPen: (pen: Pen) => void;
  words?: boolean;
}): JSX.Element {
  const { t } = useT();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const name: Record<Pen, string> = { green: t.penGreen, blue: t.penBlue, yellow: t.penYellow, pink: t.penPink };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const at = PENS.indexOf(pen);
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    let to: number | null = null;
    if (e.key === forward || e.key === "ArrowDown") to = (at + 1) % PENS.length;
    else if (e.key === back || e.key === "ArrowUp") to = (at - 1 + PENS.length) % PENS.length;
    if (to === null) return;
    // The pens sit inside the tools bar, whose own arrows move between tools.
    e.stopPropagation();
    e.preventDefault();
    onPen(PENS[to]!);
    buttons.current[to]?.focus();
  };

  return (
    <div
      className={styles.pens}
      role="radiogroup"
      aria-label={label}
      data-words={words ? "" : undefined}
      onKeyDown={onKeyDown}
    >
      {PENS.map((x, i) => (
        <button
          key={x}
          ref={(el) => {
            buttons.current[i] = el;
          }}
          type="button"
          role="radio"
          className={styles.pen}
          aria-checked={pen === x}
          aria-label={name[x]}
          title={words ? `${label}: ${name[x]}` : name[x]}
          tabIndex={pen === x ? 0 : -1}
          onClick={() => onPen(x)}
        >
          <span className={styles.swatch} style={{ background: `var(--pen-${x})` }} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
