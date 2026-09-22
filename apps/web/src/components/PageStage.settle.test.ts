/**
 * Every road onto a page settles through one step — kept by counting.
 *
 * The desktop thread that produced this fixed four leaf-placement defects one
 * road at a time (a juz jump, a turn's landing, a tap, a zoom), each a copy of
 * the same three lines that one road had dropped or reordered. The fix that
 * reaches the *next* road is structural: `arrive` in PageStage is the only
 * place a road may reveal-and-settle, and a leaf is settled from exactly two
 * places — `arrive`, and `crossFade`, which has to reveal the incoming leaf
 * itself so both leaves can fade.
 *
 * There are two settle primitives, not one: `centerCurrent` snaps a relocation
 * back to the whole page, and `reclampCurrent` carries the reader's zoom across
 * a turn (§4.5). Both are settle steps and the same rule binds them — only
 * `arrive` (which picks between them on its `carry` flag) and `crossFade` (the
 * turn's own reveal, which always carries) may call either.
 *
 * This reads the source rather than rendering it because the claim is about
 * the source: a fifth road that settled by hand would render correctly today
 * and be the next defect found by eye. The behavioural half of the same claim
 * is the desktop e2e "every road onto a page lands the leaves level".
 */
import { describe, it, expect } from "vitest";
import src from "./PageStage.tsx?raw";

describe("PageStage · one settle step", () => {
  it("settles a leaf only from arrive and from the fade under a turn's band, nowhere else", () => {
    // arrive picks one of the two (carry ? reclamp : center) — two calls in its
    // body — and crossFade carries — one. Any more means a road settled by hand.
    const calls = src.match(/\b(?:centerCurrent|reclampCurrent)\(\);/g) ?? [];
    expect(
      calls,
      "a road settled the leaf by hand — route it through arrive(next) instead",
    ).toHaveLength(3);
  });

  it("brings every road onto a page through arrive", () => {
    // The four roads: a turn's landing (which carries), a hop, a deep link, the
    // cold mount. The turn passes a second arg, the relocations do not.
    const roads = src.match(/\barrive\((?:next|loc\.page|page)\b/g) ?? [];
    expect(roads, "a road onto a page skipped the settle step").toHaveLength(4);
  });
});
