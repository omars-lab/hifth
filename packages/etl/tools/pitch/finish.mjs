/**
 * The last steps of one verse's note, in the order that matters: put back the
 * stops the print has (breaks.mjs), then drop the stray pieces (strays.mjs),
 * then rejoin sentences a column or page break split (splits.mjs). Strays go
 * first, or a cut-short copy can be rejoined to a stray piece of the previous
 * verse's note and neither is recognised any more. Last, put back the closing
 * stop the print has on the note's last sentence (ends.mjs), once that sentence
 * is whole, and finish first a note the capture cut short (also ends.mjs).
 */
import { restoreBreaks } from "./breaks.mjs";
import { restoreCutTail, restoreLastStop } from "./ends.mjs";
import { joinSplits } from "./splits.mjs";
import { dropStrayBlocks } from "./strays.mjs";

/**
 * `blocks` is this verse's joined paragraphs, `previous` the previous verse's
 * before this step. Returns the finished paragraphs, the ones to hand on as
 * `previous`, and which hand-read entries matched.
 */
export function finishNote(verse, blocks, previous, { marks, joins, words, ends = [], tails = [] }) {
  const restored = restoreBreaks(verse, blocks, marks);
  const split = joinSplits(verse, dropStrayBlocks(restored.blocks, previous), words, joins);
  const whole = restoreCutTail(split.blocks, tails);
  const closed = restoreLastStop(whole.blocks, ends);
  return {
    blocks: closed.blocks,
    handOn: restored.blocks,
    usedMarks: restored.used,
    usedJoins: split.used,
    usedEnds: closed.used,
    usedTails: whole.used,
  };
}
