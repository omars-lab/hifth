import { Suspense } from "react";
import type { Edge } from "@hifth/core";
import { useT } from "../i18n";
import { sharedRun, useLookalikePreview } from "../lookalike-preview";
// Loaded the first time a look-alike list opens (see ./later.tsx).
import { SharedWords } from "./later";

/**
 * Under a look-alike row's name, the words the two verses share, as the reader
 * set it in the info panel (lookalike-rows ⑥): cut from the page, counted, or
 * not shown. Both look-alike lists draw it, so the two cannot disagree.
 *
 * The picture steps aside while the row is open, because the comparison under
 * it shows the same words larger; the count is a line of the row's own text
 * and stays.
 */
export function SharedPreview({
  edge,
  open,
  className,
}: {
  edge: Edge;
  /** Whether the row's comparison is showing. */
  open: boolean;
  /** The row's note style, for the count. */
  className: string | undefined;
}): JSX.Element | null {
  const { t } = useT();
  const way = useLookalikePreview();
  const run = sharedRun(edge);
  if (!run || way === "none") return null;
  if (way === "count") return <span className={className}>{t.sharesWords(run.words)}</span>;
  if (open) return null;
  return (
    <span data-shared-words aria-hidden="true">
      <Suspense fallback={null}>
        <SharedWords run={run} edition={edge.to.split("/")[1] ?? "hafs-kfqc"} />
      </Suspense>
    </span>
  );
}

/**
 * Why a look-alike row is listed, under its name: which verse inside a passage
 * is the alike one, a likeness that is loose or repeats, a pair the next verse
 * tells apart, then the shared words. All three lists that show look-alikes
 * draw it (the two look-alike lists, and a note's related verses when the book
 * wrote no line for the row), so a row says the same thing wherever it is.
 */
export function LookalikeReason({
  edge,
  open,
  className,
}: {
  edge: Edge;
  /** Whether the row's comparison is showing. */
  open: boolean;
  /** The row's note style. */
  className: string | undefined;
}): JSX.Element {
  const { t } = useT();
  return (
    <>
      {/* A passage is measured against the verse inside it that matches best;
          the closed row says which, so the reader knows where to look. */}
      {edge.through && edge.like && (
        <span className={className}>{t.likeVerse(t.ayahRef(edge.like.to) ?? edge.like.to)}</span>
      )}
      {/* With no words to mark, the row still says why it is listed. */}
      {edge.match && <span className={className}>{edge.match === "repeat" ? t.matchRepeat : t.matchLoose}</span>}
      {edge.ctx && <span className={className}>{t.nextTellsApart}</span>}
      {/* The words the two share, before the row is opened: after every
          caption, so it sits in the same place on every row. */}
      <SharedPreview edge={edge} open={open} className={className} />
    </>
  );
}
