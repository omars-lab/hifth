/**
 * The arithmetic behind the words "we looked at all of them".
 *
 * Somebody asked to validate the remaining marks until we are at 100%, and the only
 * way a person gets to say that at the end is if the files they sat really were the
 * population — every mark in exactly one of them. That is a property of how the
 * pages are cut, it is invisible from inside any single page, and it fails silently:
 * sixteen files that between them miss forty marks look exactly like sixteen files
 * that do not, and the shortfall is discovered — if ever — by somebody re-deriving
 * it months later, after the claim has been written into a register.
 *
 * So the partition is checked here rather than by eye, and it is checked by reading
 * the ids back out of the built pages rather than by re-running the selection: the
 * artifact a person sits is the thing the claim is about. Re-running the chooser and
 * comparing it against itself would pass for a builder that writes empty files.
 *
 * The band tests are here for a different reason. A band is how the sitting plan
 * proposes to spend forty hours on the marks the machine is least sure of, so a band
 * that quietly included a mark from outside it, or that overlapped its neighbour,
 * would corrupt the one comparison the whole plan turns on.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { markPageFile, marksOf } from "./lib/marks.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "build-mark-report.mjs");

const RADIUS = 3;
const IOU = 0.55;

/**
 * Sixty marks on one line of page 1 — one line so the line-tilt correction clears
 * its twenty-mark floor and the refused marks are drawn by a fit that actually ran,
 * and page 1 because the builder reads that page's real ink and a made-up page
 * number has none. The spread of `iouBest` is deliberate: it puts marks in every
 * band the sitting plan cuts, so a band test has something to be wrong about.
 *
 * The index and the name are the print's own, not invented, because the builder now
 * looks up which letters each mark was drawn on in order to caption it, and refuses
 * a row whose name does not match the mark that index names. A fixture of sixty
 * hand-written kasras would fail that check on the first card — correctly, which is
 * the point of the check, and uselessly, which is why the fixture reads them. The
 * geometry stays synthetic: the boxes are what puts the marks on one line and in
 * every band, and nothing here is measuring where they really are.
 */
const REAL = existsSync(markPageFile(1)) ? marksOf(1).slice(0, 60) : [];
const ROWS = REAL.map((m, k) => ({
  page: 1,
  k: m.k,
  line: 1,
  name: m.name,
  box: [180 - k * 2.5, 40, 5.6, 3.6],
  ink: 0.1,
  dx: k % 17 === 0 ? RADIUS : 0.5,
  dy: -0.25,
  iou0: 0,
  iouBest: 0.4 + (k % 12) * 0.05,
  phi0: 0,
  nullPhi: 0,
}));

/**
 * The ligature corpus is a 380 MB cache that is not in the repo, and the builder
 * cannot caption a mark without it. Skipping says so out loud rather than failing
 * on a machine that was never going to be able to run this.
 */
const haveCorpus = ROWS.length === 60;

const atEdge = (r) => Math.abs(Math.abs(r.dx) - RADIUS) < 1e-6 || Math.abs(Math.abs(r.dy) - RADIUS) < 1e-6;
const isPlaced = (r) => r.iouBest >= IOU && !atEdge(r);
const id = (r) => `${r.page}:${r.k}`;

let dir;
let rowsPath;
let nth = 0;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "hifth-build-"));
  rowsPath = join(dir, "rows.json");
  writeFileSync(rowsPath, JSON.stringify(ROWS));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Build one page and hand back what a reader would be shown, read off the page. */
function build(...flags) {
  const out = join(dir, `page-${(nth += 1)}.html`);
  execFileSync(process.execPath, [SCRIPT, "--rows", rowsPath, "--out", out, ...flags], {
    encoding: "utf8",
    stdio: "pipe",
  });
  const html = readFileSync(out, "utf8");
  return {
    html,
    ids: [...html.matchAll(/"id":"(\d+:\d+)"/g)].map((m) => m[1]),
    head: JSON.parse(/^const HEAD = (\{.*\});$/m.exec(html)[1]),
    cards: JSON.parse(/^const CARDS = (\[.*\]);$/m.exec(html)[1]),
  };
}

describe.skipIf(!haveCorpus)("cutting a population into parts somebody can finish", () => {
  it("makes the parts add up to the population exactly", () => {
    const want = ROWS.filter((r) => !isPlaced(r)).map(id);
    const seen = new Map();
    let cards = 0;
    for (let n = 1; n <= 5; n += 1) {
      const got = build("--set", "fallback", "--part", `${n}/5`);
      cards += got.ids.length;
      for (const one of got.ids) seen.set(one, n);
    }
    // Three separate claims, because they fail differently: nothing shown twice,
    // nothing left out, and no mark shown that was never in the population.
    expect(cards).toBe(seen.size);
    expect([...seen.keys()].sort()).toEqual([...want].sort());
    expect(seen.size).toBe(want.length);
  });

  it("gives each part its own place to keep answers", () => {
    // Same fingerprint, same set, same seed — only the part differs. If that did not
    // reach the storage key, part 2 would open showing part 1's answers already
    // given, and the reader would page past marks nobody ever looked at.
    const a = build("--set", "fallback", "--part", "1/5");
    const b = build("--set", "fallback", "--part", "2/5");
    expect(a.head.slice).not.toBe(b.head.slice);
  });

  it("leaves the key alone when no part and no band were asked for", () => {
    // A sitting banked before these flags existed is keyed without them. Adding a
    // flag must not orphan somebody's finished half-hour.
    expect(build("--set", "fallback", "--count", "5").head.slice).toBe("");
  });

  it("puts the slice into the storage key", () => {
    // The key is assembled at runtime from the head, so the tests above compare
    // slices rather than keys. This is the other half: that the slice reaches the
    // key at all. Rebuilding the formula here instead would go on passing happily
    // the day somebody drops it, which is the only failure worth catching.
    expect(build("--set", "fallback", "--count", "5").html).toMatch(/const KEY = .*HEAD\.slice/);
  });

  it("refuses a part that is not one of m", () => {
    expect(() => build("--set", "fallback", "--part", "6/5")).toThrow();
    expect(() => build("--set", "fallback", "--part", "0/5")).toThrow();
  });
});

describe.skipIf(!haveCorpus)("drawing one band of confidence at a time", () => {
  it("shows only marks whose match falls inside the band", () => {
    const got = build("--set", "placed", "--band", "0.65,0.75", "--count", "100");
    const inside = new Set(
      ROWS.filter((r) => isPlaced(r) && r.iouBest >= 0.65 && r.iouBest < 0.75).map(id),
    );
    expect(got.ids.length).toBeGreaterThan(0);
    for (const one of got.ids) expect(inside.has(one)).toBe(true);
  });

  it("does not let one band hand a mark to the next", () => {
    const lower = build("--set", "placed", "--band", "0.65,0.75", "--count", "100");
    const upper = build("--set", "placed", "--band", "0.75,0.85", "--count", "100");
    const shared = lower.ids.filter((one) => upper.ids.includes(one));
    expect(shared).toEqual([]);
  });

  it("keeps two bands' answers apart", () => {
    const lower = build("--set", "placed", "--band", "0.65,0.75", "--count", "5");
    const upper = build("--set", "placed", "--band", "0.75,0.85", "--count", "5");
    expect(lower.head.slice).not.toBe(upper.head.slice);
  });

  it("stops rather than build a sitting with nothing in it", () => {
    // An empty band is a typo almost every time. Writing the page anyway produces a
    // file that opens, says "that is all of them", and banks a transcript claiming a
    // clean run over zero marks.
    expect(() => build("--set", "placed", "--band", "0.01,0.02")).toThrow();
  });

  it("refuses a band that runs backwards", () => {
    expect(() => build("--set", "placed", "--band", "0.8,0.6")).toThrow();
  });
});

/**
 * The count only comes down if answering actually takes a mark out of the pool.
 *
 * Somebody asked how to submit answers one at a time and see the number left fall,
 * and the two halves are separable: the submitting is a server, but the falling is
 * this. Without it the sixteen parts are rebuilt from the whole population every
 * time and a reader who has answered two hundred marks is handed back exactly what
 * they started with — which is both dispiriting and, worse, indistinguishable from
 * a rebuild that lost their work.
 */
describe.skipIf(!haveCorpus)("taking answered marks out of what is left", () => {
  const answersAt = (name, evs) => {
    const p = join(dir, name);
    writeFileSync(p, JSON.stringify({ said: evs }));
    return p;
  };

  it("does not show a mark somebody has already answered", () => {
    const before = build("--set", "fallback", "--count", "100");
    const gone = before.ids.slice(0, 4);
    const after = build(
      "--set", "fallback", "--count", "100",
      "--answered", answersAt("a1.json", gone.map((one) => ({ kind: "looks-right", id: one }))),
    );
    for (const one of gone) expect(after.ids).not.toContain(one);
    expect(after.ids.length).toBe(before.ids.length - gone.length);
  });

  it("counts a retracted answer as no answer at all", () => {
    // Said and then unsaid is not an answer, and the marks a reader took back are
    // the hard ones — precisely the ones it would be worst to quietly bury. The
    // running log keeps both statements because it is appended to, never rewritten,
    // so this arithmetic is the only thing standing between the two readings.
    const before = build("--set", "fallback", "--count", "100");
    const one = before.ids[0];
    const p = join(dir, "a2.jsonl");
    writeFileSync(
      p,
      [
        JSON.stringify({ kind: "report", payload: { kind: "placement", id: one } }),
        JSON.stringify({ kind: "report", payload: { kind: "retracted", id: one, was: "placement" } }),
      ].join("\n") + "\n",
    );
    expect(build("--set", "fallback", "--count", "100", "--answered", p).ids).toContain(one);
  });

  it("gives a shrunken sitting its own place to keep answers", () => {
    // The kept position is an index into the cards. Drop marks and leave the key
    // alone and that index points into a set it was never measured against — a
    // reader who reached card ninety of a hundred and seventeen reopens a rebuilt
    // sitting of eighty and is told it is finished, having never seen most of it.
    const before = build("--set", "fallback", "--count", "100");
    const after = build(
      "--set", "fallback", "--count", "100",
      "--answered", answersAt("a3.json", [{ kind: "looks-right", id: before.ids[0] }]),
    );
    expect(after.head.slice).not.toBe(before.head.slice);
    expect(before.head.slice).toBe("");
  });

  it("says how big the population was before the answered ones came out", () => {
    // "80 of 117" is unreadable a month later without the number it came down from,
    // and a transcript that cannot say which pass of the population it belongs to
    // cannot be pooled with the one before it.
    const before = build("--set", "fallback", "--count", "100");
    const after = build(
      "--set", "fallback", "--count", "100",
      "--answered", answersAt("a4.json", before.ids.slice(0, 3).map((one) => ({ kind: "looks-right", id: one }))),
    );
    expect(after.head.alreadyAnswered).toBe(3);
    expect(after.head.population).toBe(after.head.pool + 3);
  });

  it("stops rather than build a sitting of marks that were all answered", () => {
    const all = build("--set", "fallback", "--count", "1000");
    const p = answersAt("a5.json", all.ids.map((one) => ({ kind: "looks-right", id: one })));
    expect(() => build("--set", "fallback", "--count", "1000", "--answered", p)).toThrow();
  });
});

/**
 * Answers survive a reload; for one sitting the drawn rectangle did not, and neither
 * did the reader's place. Twenty-five carefully nudged marks opened again at the
 * rectangle they shipped with, on card one, with nothing on the page saying the
 * corrections were still held — so the only reasonable thing to do was the work
 * again, and a second pass appends rather than replaces.
 *
 * The page's own load path cannot be exercised here: it wants a document and a store,
 * and this file builds HTML with node. So these read the script the builder emits and
 * hold it to the two things that were missing. It is a coarse test for a defect that
 * cost an evening, and a coarse test that would have caught it is worth having.
 */
describe.skipIf(!haveCorpus)("giving a reader back the sitting they left", () => {
  it("puts every standing answer back on its rectangle before the first draw", () => {
    const { html } = build("--set", "fallback", "--count", "20");
    const replay = html.indexOf("for (const id of new Set(said.map(");
    expect(replay).toBeGreaterThan(-1);
    // Before the first draw, or the reader still sees one untouched page and has no
    // way to know a second one is coming.
    expect(replay).toBeLessThan(html.lastIndexOf("\nrender();"));
  });

  it("keeps where the reader was standing, not only how far they got", () => {
    const { html } = build("--set", "fallback", "--count", "20");
    // Two different questions, and only the high-water mark used to survive.
    expect(html).toContain("keepAt(at);");
    expect(html).toContain("Math.min(keptAt(), DECK.length - 1)");
  });

  /**
   * A reader banked an hour of answers, watched the count under the card stay where
   * it was, banked again, and watched it stay again — and said so twice. Nothing was
   * lost either time; the deal is fixed when the page is built and the count was of
   * the deal. But an instrument that cannot show a reader their own work is one they
   * stop trusting, and it takes forty hours of theirs on trust.
   *
   * So the two lists are separate now, and these are the three things that have to
   * stay true about them together.
   */
  it("takes the handed-over marks off the deck and leaves the transcript whole", () => {
    const { html } = build("--set", "fallback", "--count", "20");
    // The deal is still the deal, and what is left is derived from it.
    expect(html).toContain("let DECK = CARDS.filter(function (c) { return !GONE.has(c.id); });");
    // Retiring is what handing over does, on every path a file leaves the page by.
    expect(html).toContain("const went = retire();");
    // It survives a reload, or the retired marks come back and the reader is told
    // their work did not count after all — the same failure, one refresh later.
    expect(html).toContain("keepGone([...GONE]);");
  });

  it("never lets a shrinking deck shrink the file that gets written", () => {
    const { html } = build("--set", "fallback", "--count", "20");
    // Every hand-over writes the whole transcript under one name, so a later write
    // that had lost answers would silently destroy an earlier one that had them.
    // That is why what comes back from the session is filtered against the deal.
    expect(html).toContain("const mine = new Set(CARDS.map(function (c) { return c.id; }));");
    // And why retiring touches the deck and the place, and nothing else.
    const retire = html.slice(html.indexOf("function retire()"), html.indexOf("function handOver("));
    expect(retire).not.toContain("said =");
    expect(retire).not.toContain("keep(said)");
  });

  /**
   * The rest of this file reads the emitted script as text. This one runs it, because
   * the thing that can be wrong here is arithmetic on two indices that shift under
   * each other — where the reader is standing, and how far they had got — and no
   * amount of string-matching can tell you a subtraction is right.
   *
   * Five marks, and the reader is placed somewhere different in each: the point is
   * that the position follows the card the reader was on rather than being reset, and
   * that a mark passed in silence stays owed while an answered one goes.
   */
  it("moves the reader with the deck instead of resetting them", () => {
    const { html } = build("--set", "fallback", "--count", "20");
    const src = html.slice(html.indexOf("function retire()"), html.indexOf("function handOver("));
    const noop = () => {};
    const run = (deck, at, seen, answers) =>
      new Function(
        "DECK", "GONE", "at", "seen", "said", "keepGone", "keepSeen", "keepAt", "render",
        `${src}\nconst w = retire(); return { went: w, left: DECK.map((c) => c.id), at, seen };`,
      )(deck.map((id) => ({ id })), new Set(), at, seen, answers.map((id) => ({ id })), noop, noop, noop, noop);
    const all = ["a", "b", "c", "d", "e"];

    // The reported case: one answered, standing on the next. It becomes card one of
    // four, and none of the four has been looked at — which is the truth.
    expect(run(all, 1, 1, ["a"])).toEqual({ went: 1, left: ["b", "c", "d", "e"], at: 0, seen: 0 });
    // Two go from either side of where they stand; they stay on the same card, and
    // the one they passed in silence is still counted as looked at and still owed.
    expect(run(all, 3, 3, ["a", "c"])).toEqual({ went: 2, left: ["b", "d", "e"], at: 1, seen: 1 });
    // Nothing survives at or after where they stood, so the sitting is over. Past the
    // end rather than wrapped to the start: there is genuinely no next card.
    expect(run(all, 3, 4, ["d", "e"])).toEqual({ went: 2, left: ["a", "b", "c"], at: 3, seen: 3 });
    // Handing over an empty sitting, and handing the same one over twice, both do
    // nothing — which is what lets the button stay pressable without a reader having
    // to remember whether they already pressed it.
    expect(run(all, 2, 2, [])).toEqual({ went: 0, left: all, at: 2, seen: 2 });
    expect(run(["b", "c"], 0, 0, ["a"])).toEqual({ went: 0, left: ["b", "c"], at: 0, seen: 0 });
  });
});

/**
 * A crop of print holds several marks, often several of the same name, and a page
 * that says only "fatha" has not asked a question anybody can answer — the reader
 * is shown a rectangle and left to guess which of four fathas it was supposed to be
 * on. The letters are the answer, and the rank settles it when the letters alone
 * cannot. This is what the person sitting the first fallback page said was missing,
 * so it is checked here rather than left to be noticed again.
 */
describe.skipIf(!haveCorpus)("saying which mark is being asked about", () => {
  it("names the letters the print drew each mark on", () => {
    const got = build("--set", "fallback", "--count", "20");
    expect(got.cards.length).toBeGreaterThan(0);
    for (const c of got.cards) {
      // One or the other, always: the letters when the print drew the mark inside a
      // ligature, and the word when it drew it under a word but on no letter of its
      // own. A card with neither names nothing and is the failure this test exists
      // for; a card with both is normal.
      expect(c.on || c.word).toBeTruthy();
    }
  });

  it("tells two marks of one name on one ligature apart", () => {
    const got = build("--set", "fallback", "--count", "20");
    for (const c of got.cards) {
      expect(c.of).toBeGreaterThanOrEqual(1);
      expect(c.nth).toBeGreaterThanOrEqual(1);
      // The rank has to be sayable: "the fourth of two" is worse than saying nothing,
      // because a reader who counts will conclude the page is broken and stop.
      expect(c.nth).toBeLessThanOrEqual(c.of);
    }
  });

  it("puts the mark under discussion in the middle of both windows", () => {
    // The row's rectangle and the drawn one are a correction apart, and framing on
    // the first while drawing the second walks the mark off toward the edge —
    // furthest exactly when the correction is largest, which is when a reader most
    // needs to see it. Looking closer magnified that rather than fixing it.
    const got = build("--set", "fallback", "--count", "20");
    for (const c of got.cards) {
      const cx = c.at[0] + c.at[2] / 2;
      const cy = c.at[1] + c.at[3] / 2;
      for (const vb of [c.vb, c.near]) {
        expect(Math.abs(vb[0] + vb[2] / 2 - cx)).toBeLessThan(0.02);
        expect(Math.abs(vb[1] + vb[3] / 2 - cy)).toBeLessThan(0.02);
      }
    }
  });

  it("keeps the drawn rectangle a correction away from the row's own", () => {
    // The guard on the test above: if `at` ever collapsed onto the row's rectangle,
    // the centring assertion would pass trivially and stop meaning anything. These
    // are the refused marks, so every one of them carries a real correction.
    const got = build("--set", "fallback", "--count", "20");
    const moved = got.cards.filter((c) => Math.abs(c.at[0] - c.box[0]) + Math.abs(c.at[1] - c.box[1]) > 0.01);
    expect(moved.length).toBe(got.cards.length);
  });

  it("refuses to caption a row it cannot match to the print", () => {
    // The index walks the print in document order, so rows built from a different
    // revision line up off by one and every card is captioned with its neighbour's
    // letters — silently, and in the direction that makes a correct placement look
    // wrong. Better to stop than to mislead a whole sitting.
    const bad = join(dir, "rows-mismatched.json");
    writeFileSync(bad, JSON.stringify(ROWS.map((r) => ({ ...r, name: "no-such-mark" }))));
    expect(() =>
      execFileSync(process.execPath, [SCRIPT, "--rows", bad, "--out", join(dir, "bad.html"), "--set", "fallback"], {
        encoding: "utf8",
        stdio: "pipe",
      }),
    ).toThrow();
  });
});

/**
 * The page is a JavaScript template literal, all of it — style, markup and script.
 *
 * A backtick anywhere inside it ends the string early, and the file then fails to
 * parse somewhere else entirely, with a message about the wrong line. It has broken
 * this file three times, twice inside a comment that was never meant to be code.
 * Two assertions cost nothing and say the trap out loud to whoever trips it next.
 */
describe.skipIf(!haveCorpus)("the trap the page is built in", () => {
  it("emits no backtick and no interpolation of its own", () => {
    const { html } = build("--set", "fallback", "--count", "5");
    expect(html).not.toContain("`");
    expect(html).not.toContain("${");
  });
});

/**
 * Nothing drawn on the paper is themed.
 *
 * The crop is a photograph of print and stays white in both themes on purpose, but
 * the two rectangle colours were in the re-themed set, so dark mode lightened them
 * and then drew them on that unchanged white: 5.05:1 fell to 2.49:1 and 4.89:1 to
 * 1.70:1. That is not invisible — it is worse than invisible, because a reader can
 * still make out something rectangular, believe they have looked, and affirm. The
 * finding runs in the direction that reads as success, which is why it gets a test
 * rather than a comment.
 */
const NEVER_THEMED = ["paper", "ink", "ours-line", "ours-wash", "yours-line", "yours-wash"];

const channels = (hex) =>
  [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
const luminance = (hex) => {
  const [r, g, b] = channels(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe.skipIf(!haveCorpus)("keeping the rectangles legible on paper that never changes", () => {
  const tokensIn = (css) => {
    const found = {};
    for (const m of css.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6,8})/gi)) found[m[1]] = m[2];
    return found;
  };
  const sheets = () => {
    const { html } = build("--set", "fallback", "--count", "5");
    return {
      light: tokensIn(/:root \{([\s\S]*?)\n\}/.exec(html)[1]),
      // Lazy to the first close at column zero — the selector inside it is indented,
      // so its own brace cannot end the match early.
      dark: tokensIn(/@media \(prefers-color-scheme: dark\) \{([\s\S]*?)\n\}/.exec(html)[1]),
    };
  };

  it("re-themes nothing that is drawn on the crop", () => {
    const { light, dark } = sheets();
    // Every one of them defined once, in the theme-independent block...
    for (const name of NEVER_THEMED) expect(light[name]).toMatch(/^#[0-9a-f]{6,8}$/i);
    // ...and named nowhere in the dark one. This is the whole invariant.
    for (const name of NEVER_THEMED) expect(dark[name]).toBeUndefined();
  });

  it("still re-themes the chrome, which is the reason the two sets exist", () => {
    // The guard on the test above. If the dark block ever emptied out, that test
    // would pass forever while the page stopped having a dark theme at all.
    const { dark } = sheets();
    expect(Object.keys(dark).length).toBeGreaterThan(0);
    for (const name of ["field", "text", "ours", "yours"]) expect(dark[name]).toBeTruthy();
  });

  it("draws both rectangles at 3:1 or better against the paper", () => {
    const { light } = sheets();
    // 3:1 is the threshold for a graphical object rather than for text, and these
    // are graphical objects: a hairline rectangle around a mark, not a label.
    expect(contrast(light["ours-line"], light.paper)).toBeGreaterThanOrEqual(3);
    expect(contrast(light["yours-line"], light.paper)).toBeGreaterThanOrEqual(3);
  });

  it("tells the two rectangles apart by something other than hue", () => {
    // Ours and the reader's are orange and green, which is the one pair a red-green
    // reader cannot separate. The dash carries the distinction on its own, and it
    // survives anybody re-picking the palette later.
    const { html } = build("--set", "fallback", "--count", "5");
    expect(html).toMatch(/rect\.mine \{ stroke-dasharray:/);
  });
});

/**
 * The crop is parsed once per card, not once per pointer frame.
 *
 * The drag handler used to rebuild the stage from the card's path data on every
 * `pointermove` — 2.0 KB on the smallest crop, 23.2 KB on the largest. A correction
 * that stutters is one the reader gives up on and affirms instead, which turns a
 * performance defect into a wrong answer in the transcript.
 *
 * This reads the emitted script rather than running it, in the same spirit as the
 * replay tests above: coarse, and it catches the regression that matters.
 */
describe.skipIf(!haveCorpus)("parsing the crop once per card", () => {
  it("never rebuilds the stage while drawing a frame", () => {
    const { html } = build("--set", "fallback", "--count", "5");
    const paint = /\nfunction paint\(\) \{\n([\s\S]*?)\n\}\n/.exec(html);
    expect(paint).toBeTruthy();
    expect(paint[1]).not.toContain("innerHTML");
  });

  it("writes the crop into the page in exactly one place, and that place is mount", () => {
    const { html } = build("--set", "fallback", "--count", "5");
    const script = html.slice(html.indexOf("function mount("));
    expect([...script.matchAll(/c\.svg/g)].length).toBe(1);
    const mount = /\nfunction mount\(c\) \{\n([\s\S]*?)\n\}\n/.exec(html);
    expect(mount[1]).toContain("c.svg");
  });

  it("measures the rectangle's line in screen pixels, not in page units", () => {
    // The old stroke width was the viewBox over 220, which is 1.64px only while the
    // stage is exactly as wide as the column. Anything that sizes the stage
    // differently — a dock, a landscape phone — makes line weight a function of each
    // card's shape, and the thinnest cards are the ones hardest to judge.
    const { html } = build("--set", "fallback", "--count", "5");
    expect(html).toContain('vector-effect="non-scaling-stroke"');
    expect(html).toMatch(/rect\.grab, svg\.stage rect\.mine \{ stroke-width:/);
  });
});

/**
 * Saying which mark, in words a reader can check against the print.
 *
 * The person who sat the first fallback page said they could not tell which of four
 * fathas the rectangle was supposed to be on. The card has always carried the word
 * the mark sits in and thrown it away whenever it also had the letters, which is the
 * common case; and the sentence under the letters named the mark in only one of its
 * three branches, so a reader was told "the second of four on these letters" without
 * ever being told the second *what*.
 */
describe.skipIf(!haveCorpus)("naming the mark and the word it sits in", () => {
  it("carries a longer containing word on every card that names single letters", () => {
    // This is a fact about the data, and it is what makes the fix possible: if the
    // word were only ever the letters again, appending it would add nothing and this
    // would be the test that noticed.
    const got = build("--set", "fallback", "--count", "40");
    const single = got.cards.filter((c) => c.on && [...c.on].length === 1);
    expect(single.length).toBeGreaterThan(0);
    for (const c of single) {
      expect(c.word).toBeTruthy();
      expect([...c.word].length).toBeGreaterThan([...c.on].length);
    }
  });

  it("says the mark's name whichever of the three things it has to say", () => {
    const { html } = build("--set", "fallback", "--count", "5");
    const identify = /\nfunction identify\(([\s\S]*?)\n\}\n/.exec(html);
    expect(identify).toBeTruthy();
    // No letters at all · one of several · the only one. Three branches, three names.
    expect([...identify[1].matchAll(/c\.name/g)].length).toBeGreaterThanOrEqual(3);
  });

  it("puts the word on the card in its own direction", () => {
    const { html } = build("--set", "fallback", "--count", "5");
    expect(html).toMatch(/\.ident \.word \{ direction: rtl;/);
    expect(html).toContain('w.setAttribute("lang", "ar")');
  });
});

/**
 * The instructions get out of the way without making any answer cost more.
 *
 * The explanation was about 275px tall and never went away, which put the affirm
 * button below the fold on a 393px phone for the whole sitting. It cannot simply be
 * deleted — the first card needs it — and the fault buttons must not go behind a
 * disclosure either, because adding a tap to reporting a fault while affirming stays
 * free biases the exact ratio the sitting exists to measure. So: two ledes and a
 * quiet toggle, and the short one appears once the reader has demonstrably read the
 * long one.
 */
describe.skipIf(!haveCorpus)("getting the explanation off the fold", () => {
  it("carries both a short lede and the full one", () => {
    const { html } = build("--set", "fallback", "--count", "5");
    expect(html).toMatch(/id="brief"/);
    expect(html).toMatch(/id="full"/);
    expect(html).toMatch(/id="ledeSwap"/);
  });

  it("remembers which one the reader asked for, and lets them ask for either", () => {
    const { html } = build("--set", "fallback", "--count", "5");
    // Three states, not two. A boolean derived from progress alone would re-collapse
    // the long version on the very next answer, one tap after the reader asked for it.
    expect(html).toContain("KEY + \"-read\"");
    expect(html).toMatch(/chose === null \? seen > 0 : chose === "1"/);
  });

  it("keeps the number of taps an answer costs where it was", () => {
    // The whole design constraint in one assertion. Shortening the explanation must
    // not be paid for by hiding the fault buttons: a fault that costs a tap more than
    // an affirmation biases the one ratio these sittings exist to measure, and it
    // biases it toward agreement. All five stay on the card, none behind a disclosure.
    const { html } = build("--set", "fallback", "--count", "5");
    const acts = /<div class="acts">([\s\S]*?)<\/div>/.exec(html);
    expect(acts).toBeTruthy();
    for (const id of ["off", "shape", "draw", "print", "skip"]) {
      expect(acts[1]).toContain(`id="${id}"`);
    }
    expect(html).not.toMatch(/<details/);
  });
});
