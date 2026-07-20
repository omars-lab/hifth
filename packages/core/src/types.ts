/**
 * Shared canonical types for Hifth's L2 core.
 *
 * Loop 0 seeds only the shapes that the asset pipeline and the shell need. The
 * parse/format/resolve/highlight logic (spec §1–§3) lands in Loop 1 — see the
 * stubs in `index.ts`, which are intentionally not implemented yet.
 */

/** Edition identifier, always present in a key (spec §1 — no cross-edition index math). */
export type EditionId = string; // e.g. "hafs-kfqc"

/** A 1-based mushaf page number in a given edition. */
export type PageNumber = number;

/**
 * Metadata for one clickable ayah polygon extracted from a source SVG page.
 * `number` is the source encoding surah*1000 + ayah (e.g. 2048 = 2:48).
 */
export interface PolygonMeta {
  /** DOM id of the polygon inside the SVG, e.g. "verse-2048". */
  readonly elementId: string;
  /** Source `number` attribute: surah*1000 + ayah. */
  readonly number: number;
  readonly surah: number;
  readonly ayah: number;
  /** Canonical ayah key, e.g. "quran/hafs-kfqc/2:48". */
  readonly key: string;
}

/** Extracted metadata for a single page: which polygons it carries. */
export interface PageMeta {
  readonly edition: EditionId;
  readonly page: PageNumber;
  /** SVG viewBox as authored, e.g. "0 0 345 550". */
  readonly viewBox: string;
  readonly polygons: readonly PolygonMeta[];
}

/** The top-level asset manifest shipped to the client. */
export interface AssetManifest {
  readonly edition: EditionId;
  /** Human-readable edition label for chrome. */
  readonly editionLabel: string;
  readonly pages: readonly PageMeta[];
}
