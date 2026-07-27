/**
 * Skins (spec §8) — the tajweed overlay's vocabulary, and the proof that a skin
 * swap is a *stylesheet* swap.
 *
 * The spec is emphatic on one point: "Geometry, polygons, hop anchors: identical
 * in both." So the rule table, the class naming and the geometry-invariance
 * check live here, DOM-free and framework-free, exactly the way `view.ts` holds
 * the pan/zoom math the `PageStage` applies. The Highlighter stays the single
 * owner of SVG element access (`setSkin` is on it, per spec §3) but it does not
 * grow a dependency on the shard format: L3 hands it a lookup function, the same
 * way it already hands it `labelFor`.
 *
 * ── Granularity, stated plainly ─────────────────────────────────────────────
 * Tajweed is a property of *letters*. The vendored quran-svg corpus exposes no
 * letter or ligature ids — its glyphs are anonymous outlined `<path>`s, and the
 * only addressable elements on a page are the per-ayah hit polygons
 * (`verse-N`). This is the same wall Loop 5's root lens hit, and it has the same
 * gate: Loop 4b's ligature corpus.
 *
 * So the skin ships at AYAH granularity, and it is deliberately not a pretend
 * letter-colouring. The shards carry the source's full-fidelity character spans
 * — the thing the ligature corpus will consume unchanged; what renders *today*
 * is one mark per ayah. Which mark matters: 91.5% of ayahs carry a madd and
 * 76.2% a hamzat wasl (measured over the vendored source — see
 * `packages/etl/data/tajweed/PROVENANCE.md`), so "does this ayah have a madd"
 * carries almost no information. The informative bit at this granularity is the
 * ayah's most *distinctive* rule — hence {@link TajweedRule.salience} and
 * {@link leadingRule}. That is a real hifz aid ("which ayahs on this page hide
 * something unusual") rather than a decorative wash, and it degrades into
 * letter-level colouring without a shape change when 4b lands.
 *
 * Until a hafiz signs off (PLAN §6 "Tajweed skin ships behind a beta flag"), the
 * skin is labelled beta everywhere it appears.
 */

/** The two skins spec §3's `setSkin` names. */
export type SkinId = "plain" | "tajweed";

/**
 * The rule families Hifth colours. Not the raw rule list of any one source —
 * sources disagree on how finely to split (one publishes four grades of madd,
 * another one), so the ETL maps its source's vocabulary into these and records
 * the mapping in its PROVENANCE. Seven families, because seven is the most a
 * colour-blind-safe qualitative palette can carry honestly on cream paper.
 */
export type TajweedRuleId =
  | "wasl"
  | "madd"
  | "ghunnah"
  | "qalqalah"
  | "idgham"
  | "silent"
  | "madd-lazim";

export interface TajweedRule {
  readonly id: TajweedRuleId;
  /** Arabic name — the chrome's first language. */
  readonly label: string;
  /** Latin companion, for the legend's utility line. */
  readonly latin: string;
  /**
   * The non-colour channel, in three parts: a short Arabic mark rendered as
   * text, a dash pattern for the ayah outline, and (in CSS) a hue. Colour is
   * never the only carrier of rule identity — WCAG 1.4.1, and the reason the
   * legend is part of the deliverable rather than a nicety.
   */
  readonly mark: string;
  /**
   * How *distinctive* an occurrence is, ascending — and not a matter of taste:
   * it is the inverse of how many ayahs carry the family, measured over the
   * vendored source (percentages in the table below). The ayah's mark is its
   * highest-salience rule ({@link leadingRule}), which is the thing a hafiz
   * would actually want flagged. A total order, so the choice is deterministic.
   */
  readonly salience: number;
}

/**
 * The registry, in ascending salience. Rendering order and legend order both
 * read from this array, so there is one place to change if a family is re-graded.
 *
 * Salience is ranked by measured ayah coverage in the vendored source (114
 * surahs, 60,057 annotations — `packages/etl/data/tajweed/PROVENANCE.md`):
 * madd 91.5% · wasl 76.2% · ghunnah 72.9% · idgham 64.5% · qalqalah 42.4% ·
 * silent 37.0% · madd lāzim 2.1%. Marking an ayah "has a madd" would be true of
 * nine in ten; marking it "has a madd lāzim" is true of one in fifty.
 */
export const TAJWEED_RULES: readonly TajweedRule[] = [
  { id: "madd", label: "مدّ", latin: "madd", mark: "مـ", salience: 0 },
  { id: "wasl", label: "همزة وصل", latin: "hamzat wasl", mark: "ٱ", salience: 1 },
  { id: "ghunnah", label: "غنّة وإخفاء", latin: "ghunnah / ikhfa", mark: "غ", salience: 2 },
  { id: "idgham", label: "إدغام", latin: "idgham", mark: "د", salience: 3 },
  { id: "qalqalah", label: "قلقلة", latin: "qalqalah", mark: "ق", salience: 4 },
  { id: "silent", label: "لا يُلفظ", latin: "silent", mark: "ص", salience: 5 },
  { id: "madd-lazim", label: "مدّ لازم", latin: "madd lazim", mark: "مّ", salience: 6 },
];

const RULE_BY_ID = new Map<string, TajweedRule>(TAJWEED_RULES.map((r) => [r.id, r]));

/** The registry entry for a rule id, or null if the id is not one of ours. */
export function tajweedRule(id: string): TajweedRule | null {
  return RULE_BY_ID.get(id) ?? null;
}

/** True if `id` is a rule the registry knows — the ETL's key-validity gate. */
export function isTajweedRuleId(id: string): id is TajweedRuleId {
  return RULE_BY_ID.has(id);
}

/**
 * The CSS class a rule contributes. One prefix, so `setSkin` can strip the whole
 * family with a single predicate and never guess at unrelated classes.
 */
export const TAJWEED_CLASS_PREFIX = "tj-";

/** `tj-madd`, `tj-qalqalah`, … — the class names spec §8 names. */
export function tajweedClass(id: TajweedRuleId): string {
  return `${TAJWEED_CLASS_PREFIX}${id}`;
}

/** The class carrying the ayah's *leading* rule (what the page actually paints). */
export function tajweedMarkClass(id: TajweedRuleId): string {
  return `${TAJWEED_CLASS_PREFIX}mark-${id}`;
}

/* ------------------------------------------------------------------ */
/* Shards.                                                             */
/* ------------------------------------------------------------------ */

/**
 * One surah's tajweed shard: ayah number (as a string key) → rule id → a FLAT
 * list of `[start, end, start, end, …]` character spans, ascending by start.
 *
 * The offsets are codepoint offsets *within that ayah's* Uthmani text, kept
 * exactly as the source publishes them so the shard is a lossless projection of
 * it. They are not yet bound to anything on screen: the vendored mushaf corpus
 * has no letter or ligature elements to bind them to (see the module header).
 * Loop 4b's ligature corpus is what turns a span into a set of element ids;
 * until then the only thing read off them is how many times a rule occurs —
 * which is why they are stored anyway rather than collapsed to a count. Throwing
 * them away would make the shards cheaper to ship and impossible to grow.
 */
export interface TajweedShard {
  readonly [ayah: string]: { readonly [rule: string]: readonly number[] };
}

/** One rule's presence on one ayah. */
export interface TajweedMark {
  readonly rule: TajweedRule;
  /** Flat `[start, end, …]` character spans carrying the rule (see {@link TajweedShard}). */
  readonly spans: readonly number[];
  /** Occurrences, i.e. `spans.length / 2` — the legend counts, the list doesn't. */
  readonly count: number;
}

/**
 * The rule the ayah is marked with: the highest-salience one present. Null for
 * an ayah with no rules at all (possible for the shortest ayahs — the
 * disconnected letters, say — and honest: no mark rather than a fake one).
 */
export function leadingRule(marks: readonly TajweedMark[]): TajweedRule | null {
  let best: TajweedRule | null = null;
  for (const m of marks) {
    if (!best || m.rule.salience > best.salience) best = m.rule;
  }
  return best;
}

/** Marks for one ayah out of a shard, in registry order. Unknown ids are dropped. */
export function marksForAyah(shard: TajweedShard, ayah: number): TajweedMark[] {
  const entry = shard[String(ayah)];
  if (!entry) return [];
  const marks: TajweedMark[] = [];
  for (const rule of TAJWEED_RULES) {
    const spans = entry[rule.id];
    if (!spans || spans.length === 0) continue;
    marks.push({ rule, spans, count: spans.length >> 1 });
  }
  return marks;
}

/* ------------------------------------------------------------------ */
/* The lens over the shards (L3 loads, this indexes).                  */
/* ------------------------------------------------------------------ */

/** Parse `quran/<edition>/<surah>:<ayah>` (with any `#w…` anchor) → [surah, ayah]. */
function refOf(key: string, edition: string): [number, number] | null {
  const prefix = `quran/${edition}/`;
  if (!key.startsWith(prefix)) return null;
  const locator = key.slice(prefix.length).split("#")[0] ?? "";
  const m = /^(\d+):(\d+)$/.exec(locator);
  if (!m) return null;
  return [Number(m[1]), Number(m[2])];
}

/**
 * Tajweed — the loaded shards, keyed the way the app asks: by node-key.
 *
 * Deliberately the same shape as `Roots`: shards arrive one surah at a time from
 * L3's fetches, and the class is a pure index over whatever has landed. A miss
 * means "not loaded yet / no rules known", never an error — the skin is an
 * enhancement and goes quiet rather than taking the page down.
 */
export class Tajweed {
  readonly edition: string;
  private readonly shards = new Map<number, TajweedShard>();

  constructor(edition: string) {
    this.edition = edition;
  }

  /** Add (or replace) one surah's shard. */
  addShard(surah: number, shard: TajweedShard): void {
    this.shards.set(surah, shard);
  }

  /** True once the surah's shard has landed. */
  has(surah: number): boolean {
    return this.shards.has(surah);
  }

  /** Every rule on the ayah `key` names, in registry order. `[]` if unknown. */
  marksForKey(key: string): TajweedMark[] {
    const ref = refOf(key, this.edition);
    if (!ref) return [];
    const shard = this.shards.get(ref[0]);
    return shard ? marksForAyah(shard, ref[1]) : [];
  }

  /**
   * The lookup the Highlighter takes. Bound as a field so `setSkin(skin, tj.lookup)`
   * survives being passed around without a `this` mishap.
   */
  readonly lookup: TajweedLookup = (key: string) => this.marksForKey(key);

  /**
   * Rule → how many ayahs among `keys` carry it. The legend's counts: a legend
   * that just lists seven colours teaches nothing about the page in front of
   * you, and "3 ayahs here have a madd lāzim" is the reason to look.
   */
  countsForKeys(keys: readonly string[]): Map<TajweedRuleId, number> {
    const counts = new Map<TajweedRuleId, number>();
    for (const key of keys) {
      for (const mark of this.marksForKey(key)) {
        counts.set(mark.rule.id, (counts.get(mark.rule.id) ?? 0) + 1);
      }
    }
    return counts;
  }
}

/** What L3 gives the Highlighter so L2 never learns the shard format. */
export type TajweedLookup = (key: string) => readonly TajweedMark[];

/* ------------------------------------------------------------------ */
/* The invariant: a skin swap must not move a single coordinate.       */
/* ------------------------------------------------------------------ */

/**
 * Every attribute that can move, resize or reshape an SVG element. If none of
 * these changes, nothing the reader sees has moved — which is precisely the
 * promise spec §8 makes about the skin, and the thing worth asserting rather
 * than trusting.
 */
const GEOMETRY_ATTRS = [
  "d",
  "points",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "width",
  "height",
  "transform",
  "viewBox",
  "preserveAspectRatio",
  "clip-path",
  "mask",
] as const;

/** Anything with `tagName` + `attributes` — an `Element` without needing lib.dom. */
interface GeometryNode {
  readonly tagName: string;
  getAttribute(name: string): string | null;
  querySelectorAll(selector: string): ArrayLike<GeometryNode>;
}

/**
 * A stable string fingerprint of an SVG subtree's geometry — tag names plus
 * {@link GEOMETRY_ATTRS}, in document order, and nothing else. Classes, styles
 * and data attributes are excluded *by construction*: those are what a skin is
 * allowed to change.
 *
 * Tests (and the e2e skin spec) take it before and after a swap and compare
 * bytes. A `getBBox()` comparison would be the more direct question, but jsdom
 * stubs `getBBox`, so the attribute fingerprint is the check that can actually
 * run in the unit tier — and it is strictly stronger for our purpose, since it
 * catches a mutation even where the bbox happens to be unchanged.
 */
export function geometrySignature(root: GeometryNode): string {
  const parts: string[] = [];
  const push = (node: GeometryNode) => {
    let line = node.tagName;
    for (const attr of GEOMETRY_ATTRS) {
      const value = node.getAttribute(attr);
      if (value !== null) line += `|${attr}=${value}`;
    }
    parts.push(line);
  };
  push(root);
  const all = root.querySelectorAll("*");
  for (let i = 0; i < all.length; i++) {
    const node = all[i];
    if (node) push(node);
  }
  return parts.join("\n");
}
