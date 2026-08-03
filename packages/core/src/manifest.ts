/**
 * The manifest on the wire, and how it becomes the manifest in memory.
 *
 * `AssetManifest` (types.ts) is the shape everything downstream reads: the
 * Resolver builds three indexes from it, the app derives `mountedPages` from
 * it, the highlighter looks polygons up in it. That shape is right for memory
 * and wrong for a network. Written out for all 604 pages it is ~750 KB of JSON
 * (~109 KB gzipped), fetched whole before the first page can be drawn — which
 * is what `backlog.md` ⑪ was opened about.
 *
 * The fix is not to shard it. It is to notice that almost every byte of it is
 * derivable:
 *
 *   - There is exactly one polygon per ayah in this corpus — 6236 polygons,
 *     6236 distinct ayahs, no ayah on two pages. So a page's polygon list is
 *     just "which ayahs are on this page".
 *   - `elementId` is `verse-<absolute ayah>` for 6234 of 6236 polygons, and the
 *     ETL repairs the two upstream defects so it holds for all 6236. So the id
 *     is a function of the ayah, not data.
 *   - `number`, `surah`, `ayah` and `key` are all functions of the absolute
 *     ayah number too, via the same table `quran-meta.ts` already exports.
 *   - `viewBox` is the same string on 602 of 604 pages.
 *
 * What is left is one page number per ayah — the array in
 * `packages/etl/data/pages/ayah-pages.json`, 24 KB raw and about 1.1 KB
 * gzipped. That is the whole manifest. `expandManifest` reconstitutes the rest
 * at load, in one pass, so no consumer changes.
 *
 * The cost of this trade is that the compact form cannot express a corpus where
 * an ayah spans two pages, or where a polygon's id is arbitrary. Both are
 * checked by the ETL (`extract-pages.mjs`) against the committed SVGs on every
 * CI run, so a future edition that violates either fails loudly at build rather
 * than quietly at runtime.
 */
import type { AssetManifest, EditionId, PageMeta, PolygonMeta } from "./types.js";
import { formatAyahKey } from "./keys.js";
import { TOTAL_AYAHS, fromAbsoluteAyah, toAbsoluteAyah } from "./quran-meta.js";

/**
 * The manifest as it is fetched: an ayah→page table plus the handful of facts
 * that are not derivable from it.
 */
export interface CompactManifest {
  readonly edition: EditionId;
  readonly editionLabel: string;
  /** The viewBox shared by every page that does not override it below. */
  readonly viewBox: string;
  /**
   * Pages whose viewBox differs, keyed by page number as a string. In the
   * KFGQPC QCF V2 print this is pages 1 and 2 — the two short opening pages,
   * which are square (`0 0 235 235`) rather than the `0 0 345 550` of the rest.
   */
  readonly viewBoxOverrides: Readonly<Record<string, string>>;
  /**
   * Page number for each ayah, index = absolute ayah number − 1. Length is
   * `TOTAL_AYAHS` for a fully vendored edition; a partial edition (Loop 0
   * shipped three pages) leaves the ayahs it does not carry at 0.
   */
  readonly ayahPages: readonly number[];
}

/** A manifest fetched from `assets/manifest.json` is one of these two shapes. */
export type WireManifest = CompactManifest | AssetManifest;

/** Narrow a fetched manifest without trusting a version field to be present. */
export function isCompactManifest(m: WireManifest): m is CompactManifest {
  return Array.isArray((m as CompactManifest).ayahPages);
}

/**
 * Rebuild the full in-memory manifest from the compact wire form.
 *
 * Polygons come out in ascending ayah order within each page, and pages in
 * ascending page order — the same order the pre-compact ETL emitted, so the
 * Resolver's `keysOnPage` and every golden image are unaffected.
 */
export function expandManifest(compact: CompactManifest): AssetManifest {
  const { edition, ayahPages } = compact;
  const byPage = new Map<number, PolygonMeta[]>();

  for (let i = 0; i < ayahPages.length; i++) {
    const page = ayahPages[i];
    if (!page) continue; // ayah not carried by this edition's vendored pages
    const { surah, ayah } = fromAbsoluteAyah(i + 1);
    const polygon: PolygonMeta = {
      elementId: `verse-${i + 1}`,
      number: surah * 1000 + ayah,
      surah,
      ayah,
      key: formatAyahKey(edition, surah, ayah),
    };
    const list = byPage.get(page);
    if (list) list.push(polygon);
    else byPage.set(page, [polygon]);
  }

  const pages: PageMeta[] = [...byPage.keys()]
    .sort((a, b) => a - b)
    .map((page) => ({
      edition,
      page,
      viewBox: compact.viewBoxOverrides[String(page)] ?? compact.viewBox,
      polygons: byPage.get(page)!,
    }));

  return { edition, editionLabel: compact.editionLabel, pages };
}

/**
 * Compact a full manifest — the inverse, used by the ETL to write the wire
 * form and by tests to prove the round trip. Throws rather than lossily
 * compacting: an ayah on two pages, or a polygon whose id is not its own
 * `verse-<n>`, would silently disappear otherwise. See the module header.
 */
export function compactManifest(manifest: AssetManifest): CompactManifest {
  const ayahPages = new Array<number>(TOTAL_AYAHS).fill(0);
  const viewBoxCounts = new Map<string, number>();

  for (const page of manifest.pages) {
    viewBoxCounts.set(page.viewBox, (viewBoxCounts.get(page.viewBox) ?? 0) + 1);
    for (const p of page.polygons) {
      const abs = toAbsoluteAyah(p.surah, p.ayah);
      if (ayahPages[abs - 1]) {
        throw new Error(
          `ayah ${p.surah}:${p.ayah} appears on pages ${ayahPages[abs - 1]} and ${page.page} — ` +
            `the compact manifest cannot express an ayah that spans pages`,
        );
      }
      if (p.elementId !== `verse-${abs}`) {
        throw new Error(
          `polygon for ${p.surah}:${p.ayah} on page ${page.page} has id "${p.elementId}", ` +
            `expected "verse-${abs}" — the compact manifest derives ids and cannot carry this one`,
        );
      }
      ayahPages[abs - 1] = page.page;
    }
  }

  let viewBox = "";
  let best = -1;
  for (const [vb, n] of viewBoxCounts) {
    if (n > best) {
      best = n;
      viewBox = vb;
    }
  }
  const viewBoxOverrides: Record<string, string> = {};
  for (const page of manifest.pages) {
    if (page.viewBox !== viewBox) viewBoxOverrides[String(page.page)] = page.viewBox;
  }

  return {
    edition: manifest.edition,
    editionLabel: manifest.editionLabel,
    viewBox,
    viewBoxOverrides,
    ayahPages,
  };
}
