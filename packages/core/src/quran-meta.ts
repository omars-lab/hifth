/**
 * Quran structural metadata for the Hafs/Kufan counting (6236 ayahs).
 *
 * Loop 4a: the mutashabihat edge source (Waqar144 dataset, see
 * packages/etl/data/mutashabihat/PROVENANCE.md) addresses ayahs by their
 * ABSOLUTE number in the mushaf (1..6236). The ETL converts those to canonical
 * `surah:ayah` keys through this table; nothing downstream ever does index
 * arithmetic across editions (PLAN §8) — this is a property of the Hafs text
 * itself, not of any page layout.
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

// Absolute ayah number of each juz start (ascending).
const JUZ_ABS: number[] = [];

/** Juz (1..30) containing `surah:ayah`. */
export function juzOf(surah: number, ayah: number): number {
  if (JUZ_ABS.length === 0) {
    for (const [s, a] of JUZ_STARTS) JUZ_ABS.push(toAbsoluteAyah(s, a));
  }
  const abs = toAbsoluteAyah(surah, ayah);
  let lo = 0;
  let hi = JUZ_ABS.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (JUZ_ABS[mid]! <= abs) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
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
