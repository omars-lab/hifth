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

export {
  AYAH_COUNTS,
  TOTAL_AYAHS,
  JUZ_STARTS,
  ayahCount,
  toAbsoluteAyah,
  fromAbsoluteAyah,
  juzOf,
} from "./quran-meta.js";

export { Resolver, type ResolvedLocation } from "./resolver.js";

export {
  Highlighter,
  type GroupId,
  type StyleToken,
  type LabelFor,
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
  VERSE_TEXT,
  verseTokens,
  diffPair,
  type DiffClass,
  type DiffToken,
  type DiffSide,
} from "./verse-text.js";

export {
  serializeState,
  parseHash,
  refToKey,
  keyToRef,
  type AppState,
  type AyahRef,
  type AyahRange,
} from "./router.js";

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

// Loop 5 — merged range adjacency (spec §9 highlight menu).
export {
  mergeRangeEdges,
  type MergedEdge,
  type RangeSource,
} from "./adjacency.js";

// Loop 5 — the drag-to-highlight gesture split (pan vs marquee vs pinch) and
// the range side of the highlighter it feeds.
export {
  LONG_PRESS_MS,
  TAP_SLOP_PX,
  PINCH_POINTER_COUNT,
  pointerIntent,
  nextIntent,
  movementDistance,
  isMarqueeIntent,
  isViewportIntent,
  marqueeRect,
  type PointerIntent,
  type PointerSample,
} from "./gestures.js";

export {
  MARQUEE_MIN_SIZE,
  rectsIntersect,
  type ResolvedRange,
} from "./highlighter.js";
