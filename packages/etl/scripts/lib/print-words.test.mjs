/**
 * The look-alike runs, found in the print's words, against the corpus's.
 *
 * Decision `adjacency-span-source` = D moved the spans and the whole-verse twins
 * off the Quranic Arabic Corpus and onto the print's own words, with each lone
 * "and" glued on. It was chosen on one measurement: glued, the print keeps every
 * span the corpus gave, on the same words, and the same twin clusters. This file
 * is that measurement kept running, so the day a rebuild or an upstream move
 * loses one, a test goes red rather than a hafiz finding a verse with no wash.
 *
 * The corpus is read here and only here: as a second witness in a test, never as
 * an input to what ships.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { glueAnd, openPrintWords } from "./print-words.mjs";
import { sharedRuns } from "./shared-runs.mjs";
import { openAlignment } from "./segmentation.mjs";
import { wordsByAyah } from "../morphology.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ETL = join(HERE, "..", "..");
const ADJ = join(ETL, "..", "..", "apps", "web", "public", "assets", "adj", "hafs-kfqc");

describe("glueAnd", () => {
  const w = (idx, skel) => ({ idx, skel });

  it("joins a lone 'and' onto the word after it, spanning both positions", () => {
    expect(glueAnd([w(1, "qAl"), w(2, "w"), w(3, "qAl")], "w")).toEqual([
      { first: 1, last: 1, skel: "qAl" },
      { first: 2, last: 3, skel: "wqAl" },
    ]);
  });

  it("keeps positions across a skipped pause mark", () => {
    expect(glueAnd([w(4, "w"), w(6, "lA")], "w")).toEqual([{ first: 4, last: 6, skel: "wlA" }]);
  });

  it("leaves an 'and' that ends the verse on its own", () => {
    expect(glueAnd([w(1, "qAl"), w(2, "w")], "w")).toEqual([
      { first: 1, last: 1, skel: "qAl" },
      { first: 2, last: 2, skel: "w" },
    ]);
  });

  it("does not glue a word that merely starts with the letter", () => {
    expect(glueAnd([w(1, "wqAl"), w(2, "lhm")], "w")).toEqual([
      { first: 1, last: 1, skel: "wqAl" },
      { first: 2, last: 2, skel: "lhm" },
    ]);
  });
});

/** Every shipped look-alike edge: `[from, to, edge]`. */
function shippedEdges() {
  const out = [];
  for (const file of readdirSync(ADJ)) {
    if (!file.endsWith(".json")) continue;
    const shard = JSON.parse(readFileSync(join(ADJ, file), "utf8"));
    for (const [ayah, node] of Object.entries(shard)) {
      for (const edge of node.edges) {
        if (edge.type !== "mutashabih") continue;
        const to = edge.to.slice(edge.to.lastIndexOf("/") + 1);
        out.push([`${file.slice(0, -5)}:${ayah}`, to, edge]);
      }
    }
  }
  return out;
}

describe("the shipped spans, against the corpus", () => {
  it("keeps every span the corpus finds, on the same print words", () => {
    // The rule the spans were built by until 2026-09-26: the corpus's longest
    // shared run, only where it is unique on both sides, converted to print
    // positions through the alignment.
    const qac = wordsByAyah();
    const align = openAlignment();
    const range = (key, first, len) => {
      const head = align.printWordsOf(key, first);
      const tail = align.printWordsOf(key, first + len - 1);
      if (!head?.length || !tail?.length) return null;
      return [Math.min(...head), Math.max(...tail)];
    };
    let held = 0;
    const lost = [];
    for (const [from, to, edge] of shippedEdges()) {
      if (align.exception(from) || align.exception(to)) continue;
      const { len, runs } = sharedRuns(qac.get(from), qac.get(to));
      if (len === 0 || runs.length !== 1) continue;
      const want = [range(from, runs[0].a, len), range(to, runs[0].b, len)];
      if (!want[0] || !want[1]) continue;
      const got = [edge.span?.from, edge.toSpan?.from];
      if (JSON.stringify(got) === JSON.stringify(want)) held += 1;
      else lost.push(`${from} → ${to}: corpus ${JSON.stringify(want)}, shipped ${JSON.stringify(got)}`);
    }
    expect(lost).toEqual([]);
    // Measured when the switch was made: 3,708 one-way spans.
    expect(held).toBe(3708);
  });

  it("finds the same whole-verse twins the corpus does", () => {
    const corpus = JSON.parse(
      readFileSync(join(ETL, "data", "mutashabihat", "verbatim-twins.json"), "utf8"),
    );
    const pairs = new Set();
    // A pair counts once, whichever way it is marked: a reverse that the
    // pairings dataset already had keeps the dataset's fields, not `twin`.
    const pair = (x, y) => [x, y].sort().join("~");
    for (const [from, to, edge] of shippedEdges()) if (edge.twin) pairs.add(pair(from, to));
    const want = new Set();
    for (const cluster of corpus.twins) {
      for (const a of cluster) for (const b of cluster) if (a !== b) want.add(pair(a, b));
    }
    // Every corpus twin pair ships as a twin; the curated seed may add a few
    // hand-marked ones of its own, so the check is one way.
    expect([...want].filter((p) => !pairs.has(p))).toEqual([]);
  });

  it("covers every verse of the mus'haf", () => {
    expect(openPrintWords().size).toBe(6236);
  });
});
