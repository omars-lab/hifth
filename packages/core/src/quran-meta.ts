/**
 * Quran structural metadata for the Hafs/Kufan counting (6236 ayahs).
 *
 * Loop 4a: the mutashabihat edge source (Waqar144 dataset, see
 * packages/etl/data/mutashabihat/PROVENANCE.md) addresses ayahs by their
 * ABSOLUTE number in the mushaf (1..6236). The ETL converts those to canonical
 * `surah:ayah` keys through this table; nothing downstream ever does index
 * arithmetic across editions (PLAN §8) — this is a property of the Hafs text
 * itself, not of any page layout.
 *
 * The three tables here are hand-typed constants with an upstream: the Tanzil
 * metadata file, vendored verbatim at `packages/etl/data/meta/quran-data.xml`.
 * They stay constants because core is framework-free and must not read a file to
 * answer "which juz is this" — but `scripts/gate-quran-meta.mjs` re-derives all
 * three from those bytes on every CI run and diffs them, so a typo in a number
 * fails the build instead of quietly re-filing an ayah.
 */

/** Ayah count per surah, 1-indexed by position (index 0 = Al-Fatiha). */
export const AYAH_COUNTS: readonly number[] = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128,
  111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73,
  54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60,
  49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52,
  44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19,
  26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3,
  6, 3, 5, 4, 5, 6,
];

/** Total ayahs in the Hafs/Kufan counting. */
export const TOTAL_AYAHS = 6236;

// Cumulative ayahs BEFORE each surah: OFFSETS[s-1] + a = absolute number.
const OFFSETS: number[] = [];
{
  let acc = 0;
  for (const n of AYAH_COUNTS) {
    OFFSETS.push(acc);
    acc += n;
  }
}

/** Ayah count of a surah (1..114). */
export function ayahCount(surah: number): number {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
    throw new RangeError(`surah out of range: ${surah}`);
  }
  return AYAH_COUNTS[surah - 1]!;
}

/** `surah:ayah` → absolute ayah number (1..6236). Throws on out-of-range. */
export function toAbsoluteAyah(surah: number, ayah: number): number {
  const count = ayahCount(surah);
  if (!Number.isInteger(ayah) || ayah < 1 || ayah > count) {
    throw new RangeError(`ayah out of range for surah ${surah}: ${ayah}`);
  }
  return OFFSETS[surah - 1]! + ayah;
}

/**
 * Juz start points, `[surah, ayah]` per juz 1..30 (Tanzil metadata; juz
 * boundaries are text divisions, identical across Madani prints).
 */
export const JUZ_STARTS: readonly (readonly [number, number])[] = [
  [1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111],
  [7, 88], [8, 41], [9, 93], [11, 6], [12, 53], [15, 1], [17, 1], [18, 75],
  [21, 1], [23, 1], [25, 21], [27, 56], [29, 46], [33, 31], [36, 28],
  [39, 32], [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1],
];

/**
 * Hizb start points, `[surah, ayah]` per hizb 1..60 — the same Tanzil metadata,
 * vendored at `packages/etl/data/meta/quran-data.xml` and re-derived from it on
 * every CI run by `scripts/gate-quran-meta.mjs`.
 *
 * **Not half a juz.** The arithmetic shortcut — 30 juz, split each down the
 * middle — is the reason this table is typed out rather than computed, and it is
 * wrong in a way that would never look wrong: only **4 of the 30** even-numbered
 * hizbs fall on their juz's midpoint by ayah count, and the rest miss by up to
 * **39 ayahs** (hizb 50, in juz 25). A heatmap labelled «الحزب ٥٠» colouring
 * thirty-nine ayahs of somebody else's hizb is #80's off-by-one wearing a new
 * coat, and no gate here would have caught it: the numbers would all be in range,
 * ascending, and sixty of them.
 *
 * Tanzil publishes no hizb element at all — the division is given at its finest
 * grain as 240 `<quarter>` (أرباع الأحزاب), and a hizb is four of them. So these
 * are quarters 1, 5, 9, … 237.
 *
 * The odd-numbered entries are exactly `JUZ_STARTS` (a juz is two hizbs), which
 * is asserted in the tests and by the gate — it is the cheapest available check
 * that this table and that one describe the same book.
 */
export const HIZB_STARTS: readonly (readonly [number, number])[] = [
  [1, 1], [2, 75], [2, 142], [2, 203], [2, 253], [3, 15],
  [3, 93], [3, 171], [4, 24], [4, 88], [4, 148], [5, 27],
  [5, 82], [6, 36], [6, 111], [7, 1], [7, 88], [7, 171],
  [8, 41], [9, 34], [9, 93], [10, 26], [11, 6], [11, 84],
  [12, 53], [13, 19], [15, 1], [16, 51], [17, 1], [17, 99],
  [18, 75], [20, 1], [21, 1], [22, 1], [23, 1], [24, 21],
  [25, 21], [26, 111], [27, 56], [28, 51], [29, 46], [31, 22],
  [33, 31], [34, 24], [36, 28], [37, 145], [39, 32], [40, 41],
  [41, 47], [43, 24], [46, 1], [48, 18], [51, 31], [55, 1],
  [58, 1], [62, 1], [67, 1], [72, 1], [78, 1], [87, 1],
];

// Absolute ayah numbers of each division's starts (ascending), built once.
const ABS_CACHE = new WeakMap<readonly (readonly [number, number])[], number[]>();

/**
 * 1-based index of the last start at or before `surah:ayah`.
 *
 * Shared by `juzOf` and `hizbOf` because "which division is this ayah in" is one
 * question asked of two tables, and the binary search is the part that is easy to
 * get subtly wrong in a second copy.
 */
function divisionOf(
  starts: readonly (readonly [number, number])[],
  surah: number,
  ayah: number,
): number {
  let abs = ABS_CACHE.get(starts);
  if (!abs) {
    abs = starts.map(([s, a]) => toAbsoluteAyah(s, a));
    ABS_CACHE.set(starts, abs);
  }
  const target = toAbsoluteAyah(surah, ayah);
  let lo = 0;
  let hi = abs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (abs[mid]! <= target) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/** Juz (1..30) containing `surah:ayah`. */
export function juzOf(surah: number, ayah: number): number {
  return divisionOf(JUZ_STARTS, surah, ayah);
}

/** Hizb (1..60) containing `surah:ayah`. */
export function hizbOf(surah: number, ayah: number): number {
  return divisionOf(HIZB_STARTS, surah, ayah);
}

/** Absolute ayah number (1..6236) → `{surah, ayah}`. Throws on out-of-range. */
export function fromAbsoluteAyah(abs: number): { surah: number; ayah: number } {
  if (!Number.isInteger(abs) || abs < 1 || abs > TOTAL_AYAHS) {
    throw new RangeError(`absolute ayah out of range: ${abs}`);
  }
  // Binary search: greatest surah whose offset is < abs.
  let lo = 0;
  let hi = OFFSETS.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (OFFSETS[mid]! < abs) lo = mid;
    else hi = mid - 1;
  }
  return { surah: lo + 1, ayah: abs - OFFSETS[lo]! };
}
