/**
 * Every look-alike row says why it is there. A row can name the words the two
 * verses share (a single matching stretch), carry a hand-written note, or be a
 * word-for-word twin. About four hundred did none of these, because the two
 * verses share no stretch of words in one place only: either nothing word for
 * word, or a stretch that comes more than once. Those now say which, so the
 * list never shows a bare verse name (2026-10-09).
 *
 * A row naming a whole passage is held to the same rule, measured against the
 * verse inside the passage that matches this one best (`like`), which is often
 * not the passage's first.
 *
 * Reads the committed look-alike data, by verse numbers only.
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sharedRuns } from "../packages/etl/scripts/lib/shared-runs.mjs";
import { openPrintWords } from "../packages/etl/scripts/lib/print-words.mjs";

const ADJ = fileURLToPath(new URL("../apps/web/public/assets/adj/hafs-kfqc", import.meta.url));
const bare = (key) => key.replace(/^quran\/[^/]+\//, "").replace(/#.*$/, "");
// The verse a row was measured against: for a passage row, the one inside it it matches.
const against = (edge) => bare(edge.like?.to ?? edge.to);

function* edges() {
  for (const file of readdirSync(ADJ).filter((f) => /^\d+\.json$/.test(f))) {
    const surah = Number(file.replace(".json", ""));
    const shard = JSON.parse(readFileSync(`${ADJ}/${file}`, "utf8"));
    for (const [ayah, adj] of Object.entries(shard)) {
      for (const edge of adj.edges) yield { from: `${surah}:${ayah}`, edge };
    }
  }
}

test("every look-alike row carries a reason it is there", () => {
  const bareRows = [];
  for (const { from, edge } of edges()) {
    if (edge.type !== "mutashabih") continue;
    // Naming a passage is not a reason: 47 passage rows said nothing else (lookalike-rows ①).
    if (edge.span || edge.note || edge.twin || edge.match) continue;
    bareRows.push(`${from} → ${bare(edge.to)}${edge.through ? `–${bare(edge.through)}` : ""}`);
  }
  assert.deepEqual(bareRows.slice(0, 5), [], `${bareRows.length} rows give no reason`);
});

// A passage row is measured against the verse inside the passage that shares the
// longest run of words with this one. It names that verse (`like`) when it is
// not the passage's first; a tie, or nothing shared with any of them, keeps the
// first. Measured on the same print words the build reads.
test("a passage row is measured against the verse inside it that matches best", () => {
  const words = openPrintWords();
  const ids = (key) => words.get(key).map((w) => w.id);
  const wrong = [];
  let named = 0;
  for (const { from, edge } of edges()) {
    if (edge.type !== "mutashabih" || !edge.through || edge.twin) continue;
    const [s, first] = bare(edge.to).split(":").map(Number);
    const last = Number(bare(edge.through).split(":")[1]);
    const runs = [];
    for (let a = first; a <= last; a++) runs.push({ key: `${s}:${a}`, len: sharedRuns(ids(from), ids(`${s}:${a}`)).len });
    const best = Math.max(...runs.map((r) => r.len));
    const top = runs.filter((r) => r.len === best);
    const want = best > 0 && top.length === 1 && top[0].key !== bare(edge.to) ? top[0].key : undefined;
    const got = edge.like ? bare(edge.like.to) : undefined;
    if (got !== want) wrong.push(`${from} → ${bare(edge.to)}–${bare(edge.through)}: names ${got}, matches ${want}`);
    if (edge.like) {
      named++;
      assert.ok(Number.isInteger(edge.like.page), `${from}: no page for the verse it is measured against`);
    }
  }
  assert.deepEqual(wrong.slice(0, 5), [], `${wrong.length} passage rows measured against the wrong verse`);
  assert.ok(named > 30, `only ${named} passage rows name the verse they match`);
});

test("a row's reason is one of the two kinds, and never sits beside a matching stretch", () => {
  const kinds = new Set();
  for (const { from, edge } of edges()) {
    if (!edge.match) continue;
    kinds.add(edge.match);
    assert.ok(["loose", "repeat"].includes(edge.match), `${from}: unknown reason ${edge.match}`);
    assert.ok(!edge.span, `${from} → ${bare(edge.to)}: names its words and says it cannot`);
  }
  assert.deepEqual([...kinds].sort(), ["loose", "repeat"]);
});

test("the reason is the same read from either verse", () => {
  const seen = new Map();
  for (const { from, edge } of edges()) {
    if (edge.type === "mutashabih") seen.set(`${from}>${against(edge)}`, edge.match ?? null);
  }
  for (const [pair, match] of seen) {
    const [a, b] = pair.split(">");
    const back = seen.get(`${b}>${a}`);
    if (back === undefined || match === null || back === null) continue;
    assert.equal(back, match, `${pair}: the two directions disagree`);
  }
});

// A "repeat" row can be opened with every shared stretch marked, so it carries
// them: on both sides, in order, never overlapping, and the same pair read
// from the other verse carries the same stretches the other way round.
test("a row whose shared words repeat carries every stretch, on both sides", () => {
  const seen = new Map();
  let rows = 0;
  for (const { from, edge } of edges()) {
    const where = `${from} → ${bare(edge.to)}`;
    if (edge.match !== "repeat") {
      assert.ok(!edge.stretches, `${where}: carries stretches without repeating`);
      continue;
    }
    rows++;
    const s = edge.stretches;
    assert.ok(s?.from?.length && s?.to?.length, `${where}: no stretches to mark`);
    for (const side of [s.from, s.to]) {
      let last = 0;
      for (const [lo, hi] of side) {
        assert.ok(lo >= 1 && hi >= lo, `${where}: a stretch runs backwards`);
        assert.ok(lo > last, `${where}: stretches out of order or overlapping`);
        last = hi;
      }
    }
    seen.set(`${from}>${against(edge)}`, s);
  }
  assert.ok(rows > 100, `only ${rows} repeat rows`);
  for (const [pair, s] of seen) {
    const [a, b] = pair.split(">");
    const back = seen.get(`${b}>${a}`);
    if (!back) continue;
    assert.deepEqual(back.from, s.to, `${pair}: the two directions mark different words`);
  }
});
