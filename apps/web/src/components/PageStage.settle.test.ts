/**
 * Every road onto a page settles through one step — kept by counting.
 *
 * The desktop thread that produced this fixed four leaf-placement defects one
 * road at a time (a juz jump, a turn's landing, a tap, a zoom), each a copy of
 * the same three lines that one road had dropped or reordered. The fix that
 * reaches the *next* road is structural: `arrive` in PageStage is the only
 * place a road may reveal-and-centre, and `centerCurrent` may be called from
 * exactly two places — `arrive`, and `crossFade`, which has to reveal the
 * incoming leaf itself so both leaves can fade.
 *
 * This reads the source rather than rendering it because the claim is about
 * the source: a fifth road that centres by hand would render correctly today
 * and be the next defect found by eye. The behavioural half of the same claim
 * is the desktop e2e "every road onto a page lands the leaves level".
 */
import { describe, it, expect } from "vitest";
import src from "./PageStage.tsx?raw";

describe("PageStage · one settle step", () => {
  it("centres a leaf from arrive and from the fade under a turn's band, nowhere else", () => {
    const calls = src.match(/\bcenterCurrent\(\);/g) ?? [];
    expect(
      calls,
      "a road centred the leaf by hand — route it through arrive(next) instead",
    ).toHaveLength(2);
  });

  it("brings every road onto a page through arrive", () => {
    // The four roads: a turn's landing, a hop, a deep link, the cold mount.
    const roads = src.match(/\barrive\((next|loc\.page|page)\);/g) ?? [];
    expect(roads, "a road onto a page skipped the settle step").toHaveLength(4);
  });
});
