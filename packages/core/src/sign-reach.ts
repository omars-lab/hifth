/**
 * Reaching a vowel-sign on a page — the rules behind the sign tool and the word
 * tool (harakah-pick = D, docs/decisions/harakah-pick.md#so-what-was-decided).
 *
 * The sign tool's magnifier follows the pointer and rings the sign nearest it;
 * a click takes that sign. The word tool opens a word into one copy per sign.
 * Both read the page's sign data as it ships (`MarkShard`), where each sign is
 * a position on the print and a name, never the verse's text.
 */

import type { MarkShard, WireMark } from "./mark-diff.js";

/** One sign as the tools use it: its verse, its place in the verse's list, and its data. */
export interface ReachedSign {
  /** The verse, bare ("2:38"), as the sign data is keyed. */
  readonly ayah: string;
  /** Its place in the verse's list of signs: the note's `mark`. */
  readonly index: number;
  readonly word: number;
  readonly name: string;
  /** Its box on the page, in the page's own units: x, y, width, height. */
  readonly r: readonly [number, number, number, number];
}

function reached(ayah: string, index: number, m: WireMark): ReachedSign {
  return { ayah, index, word: m.w, name: m.n, r: [m.r[0], m.r[1], m.r[2], m.r[3]] };
}

/**
 * The sign on the page whose middle is nearest (x, y), or null when none is
 * within `reach` page units. The reach keeps a pointer resting in a margin, or
 * between two lines, from ringing a sign far away.
 */
export function nearestSignOnPage(shard: MarkShard, x: number, y: number, reach: number): ReachedSign | null {
  let best: ReachedSign | null = null;
  let bestD = reach * reach;
  for (const [ayah, list] of Object.entries(shard.marks)) {
    list.forEach((m, i) => {
      const dx = m.r[0] + m.r[2] / 2 - x;
      const dy = m.r[1] + m.r[3] / 2 - y;
      const d = dx * dx + dy * dy;
      if (d <= bestD) {
        bestD = d;
        best = reached(ayah, i, m);
      }
    });
  }
  return best;
}

/**
 * The signs on one word, in reading order: right to left by the middle of each
 * box, then top to bottom, so the first is the one a reader meets first.
 */
export function signsOfWord(shard: MarkShard, ayah: string, word: number): ReachedSign[] {
  const list = shard.marks[ayah] ?? [];
  return list
    .map((m, i) => reached(ayah, i, m))
    .filter((s) => s.word === word)
    .sort((a, b) => b.r[0] + b.r[2] / 2 - (a.r[0] + a.r[2] / 2) || a.r[1] - b.r[1]);
}
