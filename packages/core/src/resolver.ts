/**
 * Resolver (spec §4) — the ayah ↔ polygon adapter.
 *
 * Framework-free and DOM-free: it answers "which page and which SVG element(s)
 * carry this ayah key?" from the extracted asset manifest alone. Geometry
 * (bbox, marker centre) is a property of the *live* SVG, so it is NOT resolved
 * here — the highlighter reads `getBBox()` off the mounted node (spec §3 note:
 * bbox/marker come from asset markers + the SVG itself). Keeping geometry out of
 * the resolver is what lets it stay pure and unit-testable without a DOM.
 *
 * The manifest is the single source of truth (spec §4: "built in ETL from asset
 * metadata — never hand-made"). Every polygon in every page is indexed both
 * ways: key → location, and elementId → key (the highlighter needs the reverse
 * lookup to name a tapped polygon).
 */

import type { AssetManifest, EditionId, PageNumber, PolygonMeta } from "./types.js";

/** Where an ayah lives in the asset set. `elementIds` is a list because a single
 * ayah can, in principle, span more than one polygon (wrapped across lines). */
export interface ResolvedLocation {
  readonly key: string;
  readonly edition: EditionId;
  readonly page: PageNumber;
  readonly surah: number;
  readonly ayah: number;
  /** DOM ids of the polygon(s) carrying this ayah, in document order. */
  readonly elementIds: readonly string[];
}

/**
 * A resolver over one edition's manifest. Construct once per loaded manifest;
 * lookups are O(1). Immutable — holds no DOM and no mutable state.
 */
export class Resolver {
  readonly edition: EditionId;
  readonly editionLabel: string;

  /** key → location */
  private readonly byKey: ReadonlyMap<string, ResolvedLocation>;
  /** elementId → key (reverse: which ayah did the user tap?) */
  private readonly byElementId: ReadonlyMap<string, string>;
  /** page → the ayah keys it carries, in document order */
  private readonly byPage: ReadonlyMap<PageNumber, readonly string[]>;

  constructor(manifest: AssetManifest) {
    this.edition = manifest.edition;
    this.editionLabel = manifest.editionLabel;

    const byKey = new Map<string, ResolvedLocation>();
    const byElementId = new Map<string, string>();
    const byPage = new Map<PageNumber, string[]>();

    for (const page of manifest.pages) {
      const keysOnPage: string[] = [];
      // Group polygons by key first, so a multi-polygon ayah collapses to one
      // location with several elementIds.
      const elementsByKey = new Map<string, string[]>();
      for (const poly of page.polygons) {
        const ids = elementsByKey.get(poly.key);
        if (ids) ids.push(poly.elementId);
        else elementsByKey.set(poly.key, [poly.elementId]);
        byElementId.set(poly.elementId, poly.key);
      }

      for (const [key, elementIds] of elementsByKey) {
        const meta = page.polygons.find((p) => p.key === key) as PolygonMeta;
        const loc: ResolvedLocation = {
          key,
          edition: manifest.edition,
          page: page.page,
          surah: meta.surah,
          ayah: meta.ayah,
          elementIds,
        };
        // First occurrence wins if a key somehow appears on two pages (it should
        // not within one edition — an ayah lives on exactly one page).
        if (!byKey.has(key)) byKey.set(key, loc);
        keysOnPage.push(key);
      }
      byPage.set(page.page, keysOnPage);
    }

    this.byKey = byKey;
    this.byElementId = byElementId;
    this.byPage = byPage;
  }

  /** Resolve an ayah key to its asset location, or null if not vendored. */
  resolve(key: string): ResolvedLocation | null {
    return this.byKey.get(key) ?? null;
  }

  /** Reverse lookup: the ayah key a given polygon element carries, or null. */
  keyForElement(elementId: string): string | null {
    return this.byElementId.get(elementId) ?? null;
  }

  /** The ayah keys on a page, in document order (empty if page not vendored). */
  keysOnPage(page: PageNumber): readonly string[] {
    return this.byPage.get(page) ?? [];
  }

  /** Every resolvable ayah key in this edition (document order per page). */
  allKeys(): readonly string[] {
    return [...this.byKey.keys()];
  }

  /** Whether a page is present in the asset set. */
  hasPage(page: PageNumber): boolean {
    return this.byPage.has(page);
  }
}
