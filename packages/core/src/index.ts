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

export { Resolver, type ResolvedLocation } from "./resolver.js";

export {
  Highlighter,
  type GroupId,
  type StyleToken,
  type Rect,
  type Resolved,
} from "./highlighter.js";

export {
  frameBboxToView,
  bboxToScreen,
  clampZoom,
  easeInOutCubic,
  lerpView,
  DEFAULT_HOP_ZOOM,
  type View,
  type FrameContext,
} from "./view.js";

export {
  Adjacency,
  EDGE_TYPES,
  RAIL_GLYPH,
  isActiveEdgeType,
  bucketEdges,
  orderForHifz,
  buildShards,
  type EdgeTypeId,
  type EdgeStatus,
  type EdgeType,
  type EdgeDir,
  type WordSpan,
  type Edge,
  type AyahAdjacency,
  type AdjacencyShard,
  type RailDirection,
  type RailChip,
  type CuratedEdge,
  type CuratedAdjacency,
} from "./adjacency.js";
