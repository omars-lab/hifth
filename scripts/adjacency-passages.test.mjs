/**
 * The outside look-alike list pairs whole passages — two verses here with two
 * verses there — and every verse of the first links to the start of the
 * second. The build used to drop where the second passage ends, so a reader
 * standing on the first passage's later verse saw a row named only by the
 * other passage's opening verse, with no reason it was there (2026-10-09, the
 * iPad walk). The shipped links now carry the passage's last verse.
 *
 * Reads the committed look-alike data, by verse numbers only.
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ADJ = fileURLToPath(new URL("../apps/web/public/assets/adj/hafs-kfqc", import.meta.url));
const bare = (key) => key.replace(/^quran\/[^/]+\//, "").replace(/#.*$/, "");
const split = (ref) => ref.split(":").map(Number);

function* edges() {
  for (const file of readdirSync(ADJ).filter((f) => /^\d+\.json$/.test(f))) {
    const surah = Number(file.replace(".json", ""));
    const shard = JSON.parse(readFileSync(`${ADJ}/${file}`, "utf8"));
    for (const [ayah, adj] of Object.entries(shard)) {
      for (const edge of adj.edges) yield { from: `${surah}:${ayah}`, edge };
    }
  }
}

test("a look-alike from inside a matched passage names where the other passage ends", () => {
  // 2:47–48 and 2:122–123 are one such pair in the outside list.
  const row = [...edges()].find(
    ({ from, edge }) => from === "2:48" && edge.type === "mutashabih" && bare(edge.to) === "2:122",
  );
  assert.ok(row, "2:48 no longer links to 2:122");
  assert.equal(row.edge.through && bare(row.edge.through), "2:123");
});

test("a passage's end is a later verse of the same surah, and never on a word-for-word twin", () => {
  let passages = 0;
  for (const { from, edge } of edges()) {
    if (!edge.through) continue;
    passages += 1;
    const [s, a] = split(bare(edge.to));
    const [ts, ta] = split(bare(edge.through));
    assert.equal(ts, s, `${from} → ${edge.to}: the passage leaves its surah`);
    assert.ok(ta > a, `${from} → ${edge.to}: the passage ends before it starts`);
    assert.ok(!edge.twin, `${from} → ${edge.to}: a twin is one verse, not a passage`);
  }
  assert.ok(passages > 0, "no link names a passage");
});
