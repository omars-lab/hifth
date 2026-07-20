/**
 * @hifth/core — L2, framework-free.
 *
 * Loop 0 exports the canonical types and the ayah-key helpers used by the asset
 * pipeline and the shell. The resolver, highlighter, router, gestures and
 * adjacency modules (spec §2–§7) are Loop 1+ and are added here as they land.
 */

export type {
  EditionId,
  PageNumber,
  PolygonMeta,
  PageMeta,
  AssetManifest,
} from "./types.js";

export {
  formatAyahKey,
  parseAyahKey,
  decodeAyahNumber,
  type AyahKey,
} from "./keys.js";
