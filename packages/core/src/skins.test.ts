// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { Highlighter } from "./highlighter.js";
import { Resolver } from "./resolver.js";
import {
  TAJWEED_RULES,
  Tajweed,
  geometrySignature,
  isTajweedRuleId,
  leadingRule,
  marksForAyah,
  tajweedClass,
  tajweedMarkClass,
  tajweedRule,
  parseTajweedVocabulary,
  tajweedFamilyIndex,
  type TajweedShard,
  type TajweedVocabulary,
} from "./skins.js";
import type { AssetManifest } from "./types.js";

const manifest: AssetManifest = {
  edition: "hafs-kfqc",
  editionLabel: "Hafs (test)",
  pages: [
    {
      edition: "hafs-kfqc",
      page: 7,
      viewBox: "0 0 345 550",
      polygons: [
        { elementId: "verse-45", number: 2038, surah: 2, ayah: 38, key: "quran/hafs-kfqc/2:38" },
        { elementId: "verse-46", number: 2039, surah: 2, ayah: 39, key: "quran/hafs-kfqc/2:39" },
      ],
    },
  ],
};

/**
 * The vocabulary the shard below is written in — the same shape rules.json
 * ships, trimmed to the rules this fixture uses. It is what turns the shard's
 * keys into something paintable, and the reason it is a fixture at all is that
 * @hifth/core deliberately does not know any source's rule list.
 */
const vocabulary: TajweedVocabulary = {
  source: "test",
  rules: [
    { id: "hamzat_wasl", family: "wasl" },
    { id: "madd_2", family: "madd" },
    { id: "madd_munfasil", family: "madd" },
    { id: "madd_6", family: "madd-lazim" },
    { id: "qalqalah", family: "qalqalah" },
  ],
};
const families = tajweedFamilyIndex(vocabulary);

/**
 * Surah 2's shard, in the shape build-tajweed.mjs emits: the source's own rule
 * ids over flat `[start, end, …]` codepoint spans. 2:38 carries five rules that
 * fold into four families — `madd_2` and `madd_munfasil` are two rules and one
 * colour, which is the whole point of the widening and so is the case worth
 * having in the fixture. 2:39 carries only the common one; 2:40 none.
 */
const shard: TajweedShard = {
  "38": {
    hamzat_wasl: [7, 8],
    madd_2: [24, 25],
    madd_munfasil: [51, 53],
    qalqalah: [30, 31],
    madd_6: [61, 63],
  },
  "39": { hamzat_wasl: [3, 4] },
  "40": {},
};

/**
 * A fixture in the shape of the real asset: anonymous outlined glyph paths (no
 * ids — that is the corpus's actual limitation) plus per-ayah hit polygons.
 */
function makeSvg(): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 345 550");
  const glyphs = document.createElementNS(NS, "g");
  glyphs.setAttribute("id", "content");
  glyphs.setAttribute("transform", "matrix(1.3333 0 0 -1.3333 -55 640)");
  for (const d of ["M0 0h10v10H0z", "M20 20h5v5h-5z"]) {
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", d);
    glyphs.appendChild(path);
  }
  svg.appendChild(glyphs);
  for (const [id, d] of [
    ["verse-45", "M0 4.8h345v36H0Z"],
    ["verse-46", "M0 80.4h79.4v36H0Z"],
  ] as const) {
    const poly = document.createElementNS(NS, "path");
    poly.setAttribute("id", id);
    poly.setAttribute("class", "ayahPolygon");
    poly.setAttribute("d", d);
    poly.setAttribute("fill-opacity", "0");
    (poly as unknown as { getBBox: () => DOMRect }).getBBox = () =>
      ({ x: 10, y: 20, width: 30, height: 40 }) as DOMRect;
    svg.appendChild(poly);
  }
  document.body.appendChild(svg);
  return svg;
}

describe("tajweed rule registry", () => {
  it("has unique ids and a total salience order (the mark choice is deterministic)", () => {
    const ids = TAJWEED_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const saliences = TAJWEED_RULES.map((r) => r.salience);
    expect(new Set(saliences).size).toBe(saliences.length);
    // Declared in ascending salience, so legend order == registry order.
    expect([...saliences].sort((a, b) => a - b)).toEqual(saliences);
  });

  it("gives every rule a non-colour channel: an Arabic name and a text mark", () => {
    for (const rule of TAJWEED_RULES) {
      expect(rule.label.length).toBeGreaterThan(0);
      expect(rule.mark.length).toBeGreaterThan(0);
      expect(rule.latin.length).toBeGreaterThan(0);
    }
  });

  it("recognises its own ids and rejects anything else", () => {
    expect(isTajweedRuleId("qalqalah")).toBe(true);
    expect(isTajweedRuleId("idgham_mutajanisayn")).toBe(false);
    expect(tajweedRule("madd")?.label).toBe("مدّ");
    expect(tajweedRule("nope")).toBeNull();
  });
});

describe("marks", () => {
  it("reads an ayah's rules in registry order, dropping ids the vocabulary lacks", () => {
    const marks = marksForAyah(
      { "38": { qalqalah: [4, 5], madd_2: [2, 3], bogus: [1, 2] } },
      38,
      families,
    );
    expect(marks.map((m) => m.rule.id)).toEqual(["madd", "qalqalah"]);
    expect(marks[0]!.count).toBe(1); // one span == one occurrence, not two numbers
    expect(marks[0]!.spans).toEqual([2, 3]);
  });

  it("counts occurrences, not offsets", () => {
    expect(marksForAyah(shard, 38, families).find((m) => m.rule.id === "madd")!.count).toBe(2);
  });

  it("folds two source rules into one family and keeps both names", () => {
    // The whole reason for the widening: `madd_2` and `madd_munfasil` are one
    // colour on the page and two different rules to a reciter. The old shard
    // shape could express the first and had thrown away the second.
    const madd = marksForAyah(shard, 38, families).find((m) => m.rule.id === "madd")!;
    expect(madd.sources).toEqual(["madd_2", "madd_munfasil"]);
    // Merged ascending, not concatenated in whatever order the keys arrived.
    expect(madd.spans).toEqual([24, 25, 51, 53]);
  });

  it("is empty for an unknown or rule-less ayah rather than guessing", () => {
    expect(marksForAyah(shard, 99, families)).toEqual([]);
    expect(marksForAyah(shard, 40, families)).toEqual([]);
  });

  it("paints nothing at all until the vocabulary lands", () => {
    // A shard on its own is offsets keyed by strings this package has
    // deliberately never been taught. Nothing, rather than a guess.
    expect(marksForAyah(shard, 38, new Map())).toEqual([]);
  });

  it("marks an ayah with its most DISTINCTIVE rule, not its most common one", () => {
    // 2:38 has a madd (91.5% of ayahs do) and a madd lāzim (2.1% do). The mark
    // must be the latter — see the coverage table in TAJWEED_RULES.
    expect(leadingRule(marksForAyah(shard, 38, families))?.id).toBe("madd-lazim");
    expect(leadingRule(marksForAyah(shard, 39, families))?.id).toBe("wasl");
    expect(leadingRule([])).toBeNull();
  });
});

describe("the vocabulary", () => {
  it("accepts what the ETL writes", () => {
    const parsed = parseTajweedVocabulary({
      source: "cpfair/quran-tajweed@496f71cd",
      rules: [{ id: "ikhfa", family: "ghunnah" }],
    });
    expect(parsed?.rules).toEqual([{ id: "ikhfa", family: "ghunnah" }]);
  });

  it("refuses a family @hifth/core could not paint", () => {
    // The failure this rejects is a class nothing styles, applied across the
    // whole mus'haf — silent, and invisible until somebody turns the skin on.
    expect(parseTajweedVocabulary({ source: "x", rules: [{ id: "a", family: "tafkhim" }] })).toBeNull();
  });

  it("refuses a duplicate id, an empty list, and anything that is not one", () => {
    const dup = [
      { id: "ikhfa", family: "ghunnah" },
      { id: "ikhfa", family: "madd" },
    ];
    expect(parseTajweedVocabulary({ source: "x", rules: dup })).toBeNull();
    expect(parseTajweedVocabulary({ source: "x", rules: [] })).toBeNull();
    expect(parseTajweedVocabulary({ rules: [] })).toBeNull();
    expect(parseTajweedVocabulary(null)).toBeNull();
    expect(parseTajweedVocabulary("{}")).toBeNull();
  });
});

describe("Tajweed lens", () => {
  let tj: Tajweed;
  beforeEach(() => {
    tj = new Tajweed("hafs-kfqc", vocabulary);
    tj.addShard(2, shard);
  });

  it("indexes by node-key, ignoring word anchors and foreign editions", () => {
    expect(tj.marksForKey("quran/hafs-kfqc/2:38")).toHaveLength(4);
    expect(tj.marksForKey("quran/hafs-kfqc/2:38#w3-7")).toHaveLength(4);
    expect(tj.marksForKey("quran/warsh/2:38")).toEqual([]);
    expect(tj.marksForKey("root/ktb")).toEqual([]);
  });

  it("goes quiet — not fatal — for a surah whose shard has not landed", () => {
    expect(tj.has(2)).toBe(true);
    expect(tj.has(3)).toBe(false);
    expect(tj.marksForKey("quran/hafs-kfqc/3:1")).toEqual([]);
  });

  it("counts ayahs per rule for the legend", () => {
    const counts = tj.countsForKeys(["quran/hafs-kfqc/2:38", "quran/hafs-kfqc/2:39"]);
    expect(counts.get("wasl")).toBe(2);
    expect(counts.get("madd")).toBe(1);
    expect(counts.get("madd-lazim")).toBe(1);
    expect(counts.get("idgham")).toBeUndefined();
  });
});

describe("geometrySignature", () => {
  it("fingerprints shape, not styling", () => {
    const svg = makeSvg();
    const before = geometrySignature(svg as unknown as never);
    svg.querySelector("#verse-45")!.classList.add("tj-madd");
    svg.setAttribute("class", "skin-tajweed");
    expect(geometrySignature(svg as unknown as never)).toBe(before);
  });

  it("notices an actual geometry edit", () => {
    const svg = makeSvg();
    const before = geometrySignature(svg as unknown as never);
    svg.querySelector("#verse-45")!.setAttribute("d", "M0 0h1v1H0Z");
    expect(geometrySignature(svg as unknown as never)).not.toBe(before);
  });
});

describe("Highlighter.setSkin", () => {
  const resolver = new Resolver(manifest);
  let svg: SVGSVGElement;
  let hl: Highlighter;
  let tj: Tajweed;

  beforeEach(() => {
    document.body.innerHTML = "";
    svg = makeSvg();
    hl = new Highlighter(svg, resolver, 7);
    tj = new Tajweed("hafs-kfqc", vocabulary);
    tj.addShard(2, shard);
  });

  it("starts plain", () => {
    expect(hl.skin).toBe("plain");
  });

  it("applies the ayah's rule classes and its leading mark", () => {
    hl.setSkin("tajweed", tj.lookup);
    const poly = svg.querySelector("#verse-45")!;
    expect(poly.classList.contains(tajweedMarkClass("madd-lazim"))).toBe(true);
    for (const id of ["wasl", "madd", "qalqalah", "madd-lazim"] as const) {
      expect(poly.classList.contains(tajweedClass(id))).toBe(true);
    }
    expect(poly.getAttribute("data-tj")).toBe("madd wasl qalqalah madd-lazim");
    // The polygon keeps the class it arrived with — the skin only adds.
    expect(poly.classList.contains("ayahPolygon")).toBe(true);
    expect(svg.classList.contains("skin-tajweed")).toBe(true);
  });

  it("is byte-identical geometry across plain → tajweed → plain", () => {
    const plain = geometrySignature(svg as unknown as never);
    hl.setSkin("tajweed", tj.lookup);
    expect(geometrySignature(svg as unknown as never)).toBe(plain);
    hl.setSkin("plain");
    expect(geometrySignature(svg as unknown as never)).toBe(plain);
  });

  it("leaves the anonymous glyph paths completely untouched", () => {
    const glyphs = svg.querySelector("#content")!.outerHTML;
    hl.setSkin("tajweed", tj.lookup);
    expect(svg.querySelector("#content")!.outerHTML).toBe(glyphs);
  });

  it("removes every rule class again on the way back to plain", () => {
    hl.setSkin("tajweed", tj.lookup);
    hl.setSkin("plain");
    const poly = svg.querySelector("#verse-45")!;
    expect(poly.getAttribute("class")).toBe("ayahPolygon");
    expect(poly.getAttribute("data-tj")).toBeNull();
    expect(svg.classList.contains("skin-plain")).toBe(true);
    expect(svg.classList.contains("skin-tajweed")).toBe(false);
  });

  it("marks nothing without a lookup, rather than inventing rules", () => {
    hl.setSkin("tajweed");
    expect(svg.querySelector("#verse-45")!.getAttribute("data-tj")).toBeNull();
    expect(svg.classList.contains("skin-tajweed")).toBe(true);
  });

  it("re-applies with the remembered lookup when a shard lands later", () => {
    const late = new Tajweed("hafs-kfqc", vocabulary);
    hl.setSkin("tajweed", late.lookup);
    expect(svg.querySelector("#verse-45")!.getAttribute("data-tj")).toBeNull();
    late.addShard(2, shard);
    hl.setSkin("tajweed"); // no lookup argument — the stored one is reused
    expect(svg.querySelector("#verse-45")!.getAttribute("data-tj")).toContain("qalqalah");
  });

  it("never lets a rule colour leak onto a selection mark", () => {
    hl.setSkin("tajweed", tj.lookup);
    hl.highlight("quran/hafs-kfqc/2:38", "sel", "selection");
    const marks = [...svg.querySelectorAll('#hifth-overlay [data-hl-group="selection"]')];
    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) {
      // The leak this guards against is a tajweed rule riding along on the mark
      // — via `data-tj`, or via a `tj-*` class — and repainting the selection in
      // a rule's colour. Asserted as "nothing from the skin is present" rather
      // than as an exact class string: the mark also carries `hl-ink` when it is
      // a marker swipe (see ink.ts), and a test that pins the whole attribute
      // fails on every rendering change while catching no leak at all.
      expect(mark.getAttribute("data-tj")).toBeNull();
      expect([...mark.classList].filter((c) => c.startsWith("tj-"))).toEqual([]);
      expect(mark.classList.contains("hl")).toBe(true);
      expect(mark.classList.contains("hl-sel")).toBe(true);
    }
  });

  it("leaves an ayah with no known rules unmarked", () => {
    hl.setSkin("tajweed", tj.lookup);
    const poly = svg.querySelector("#verse-46")!;
    // 2:39 does have one rule; add a page whose ayah has none by clearing it.
    expect(poly.getAttribute("data-tj")).toBe("wasl");
    const bare = new Tajweed("hafs-kfqc", vocabulary);
    bare.addShard(2, { "38": {}, "39": {} });
    hl.setSkin("tajweed", bare.lookup);
    expect(poly.getAttribute("data-tj")).toBeNull();
    expect(poly.getAttribute("class")).toBe("ayahPolygon");
  });
});
