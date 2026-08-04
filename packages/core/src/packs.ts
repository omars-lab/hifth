/**
 * What a pinned juz is made of.
 *
 * Loop 6b's promise is that a hafiz can revise one juz in aeroplane mode a week
 * later. That promise is a *list of files*, and this module is the only place
 * that decides which. Everything downstream — the writes into Cache Storage, the
 * register of what is pinned, the "you have juz 30 on this phone" line — is
 * bookkeeping over the list this returns.
 *
 * ## Read the pages off the manifest, not off `JUZ_STARTS`
 *
 * The start table knows which *ayah* opens a juz. It does not know which page of
 * this print carries that ayah, or whether this build has that page at all. The
 * revision map learned this the same way (`holdings` in `RevisionMap.tsx`) and
 * for the same reason: a pack computed from the start table would be a list of
 * page numbers we believe in rather than files we have, and the failure lands as
 * a blank leaf in aeroplane mode — the exact situation the pack existed to
 * prevent, arriving a week after anyone could still fix it.
 *
 * So the table is used for one thing only, which is the thing it knows: the
 * **ayah span** of the juz. Which pages carry those ayahs is a question for the
 * manifest.
 *
 * ## The shards follow the pages, not the juz
 *
 * A juz boundary falls mid-page far more often than not — juz 2 opens at 2:142,
 * which shares its leaf with the end of juz 1. Pin the page and the reader can
 * see, and tap, ayahs belonging to the neighbouring juz. If the shard list were
 * derived from the juz's own ayah span, those taps would find no hops offline,
 * silently, and the reader would conclude the mutashabihat had run out rather
 * than that a file was missing.
 *
 * So `surahs` is every surah appearing on any page in the pack. A pack is then
 * closed under what it puts on screen: anything you can touch on a pinned page
 * has the data its touch needs. It costs a shard or two at each end — a few KB
 * against a few MB of paper.
 *
 * ## It counts what it cannot give you
 *
 * `absentAyahs` is the ayahs of this juz that no page in this build carries. On
 * today's corpus it is zero everywhere; on a partially vendored edition it is
 * the difference between "pinned" and "pinned, and here is what is not in it".
 * The number is computed rather than assumed for the same reason the map draws
 * absent divisions differently: silence about a hole reads as an assurance.
 *
 * No URL shapes here. `apps/web/src/assets.ts` is the one place that knows what
 * an asset's address looks like, and a pack plan that hard-coded `assets/pages/`
 * would be a second place — quietly wrong the day the base path changes.
 */
import { JUZ_STARTS, TOTAL_AYAHS, juzOf, toAbsoluteAyah } from "./quran-meta.js";
import type { PageMeta } from "./types.js";

/** The files one pinned juz needs, in the terms the loaders take. */
export interface PackPlan {
  /** 1..30. */
  readonly juz: number;
  /** Every page holding an ayah of this juz, ascending, from this build only. */
  readonly pages: readonly number[];
  /** Every surah appearing on those pages, ascending — one adjacency shard each. */
  readonly surahs: readonly number[];
  /** Ayahs of this juz that no page in this build carries. Zero on a whole print. */
  readonly absentAyahs: number;
}

/** How many juz there are. Not derived from `JUZ_STARTS.length` at the call site. */
export const JUZ_COUNT = 30;

/**
 * The absolute-ayah span of a juz as `[first, last]`, both inclusive.
 *
 * The last juz ends at the last ayah of the book rather than at the next entry
 * in the table, because there is no next entry — the arithmetic that forgets
 * this is off by an entire juz, and only on the one juz most memorisers hold.
 */
export function juzSpan(juz: number): readonly [number, number] | null {
  if (!Number.isInteger(juz) || juz < 1 || juz > JUZ_COUNT) return null;
  const start = JUZ_STARTS[juz - 1];
  if (start === undefined) return null;
  const next = JUZ_STARTS[juz];
  const first = toAbsoluteAyah(start[0], start[1]);
  const last = next === undefined ? TOTAL_AYAHS : toAbsoluteAyah(next[0], next[1]) - 1;
  return [first, last];
}

/**
 * Plan the pack for one juz against the pages this build actually holds.
 *
 * `pages` is the manifest's page list and may be in any order; the result is
 * sorted, because a pack that downloads in manifest order and a pack that
 * reports in manifest order would both be right until the extractor changed and
 * neither would say so. Returns null for a juz outside 1..30 rather than an
 * empty plan — "no such juz" and "a juz with nothing in it" are different
 * answers, and only one of them should ever reach a progress bar.
 */
export function planPack(juz: number, pages: readonly PageMeta[]): PackPlan | null {
  const span = juzSpan(juz);
  if (span === null) return null;
  const [first, last] = span;

  const inPack = new Set<number>();
  const surahs = new Set<number>();
  const covered = new Set<number>();

  for (const meta of pages) {
    let touches = false;
    for (const polygon of meta.polygons) {
      // `juzOf`, not `abs >= first && abs <= last`: membership has one
      // implementation in this repo and this is not a second one. The span is
      // still needed below, but only to count what a whole juz *would* be.
      if (juzOf(polygon.surah, polygon.ayah) === juz) {
        touches = true;
        covered.add(toAbsoluteAyah(polygon.surah, polygon.ayah));
      }
    }
    if (!touches) continue;
    inPack.add(meta.page);
    // Every surah on the leaf, not only the ones inside the juz — see the header.
    for (const polygon of meta.polygons) surahs.add(polygon.surah);
  }

  return {
    juz,
    pages: [...inPack].sort((a, b) => a - b),
    surahs: [...surahs].sort((a, b) => a - b),
    absentAyahs: last - first + 1 - covered.size,
  };
}

/**
 * The juz a page belongs to for the purpose of *offering* a pin — the lowest
 * juz with any ayah on the page.
 *
 * A page that straddles a boundary belongs to two juz, and the pin control has
 * to name one. It names the earlier, so the offer on the leaf where juz 1 ends
 * and juz 2 begins is "pin juz 1" — the one the reader has been reading, not
 * the one they are about to reach. Returns null for a page with no ayahs at all,
 * which is not a case today and is not worth a guess if it ever is.
 */
export function juzOfPage(page: number, pages: readonly PageMeta[]): number | null {
  const meta = pages.find((p) => p.page === page);
  if (meta === undefined || meta.polygons.length === 0) return null;
  let lowest: number | null = null;
  for (const polygon of meta.polygons) {
    const juz = juzOf(polygon.surah, polygon.ayah);
    if (lowest === null || juz < lowest) lowest = juz;
  }
  return lowest;
}
