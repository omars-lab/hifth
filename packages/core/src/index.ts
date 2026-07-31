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
  HIZB_STARTS,
  ayahCount,
  toAbsoluteAyah,
  fromAbsoluteAyah,
  juzOf,
  hizbOf,
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
  clampView,
  clampZoom,
  easeInOutCubic,
  lerpView,
  DEFAULT_HOP_ZOOM,
  type View,
  type FrameContext,
  type StageFit,
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

// Loop 5 — the ⬡ root lens (page-distance sort, lemma sub-groups).
export {
  Roots,
  orderByPageDistance,
  groupByLemma,
  type RootOccurrence,
  type RootEntry,
  type RootIndexShard,
  type AyahRootRef,
  type AyahRootsShard,
  type RootHop,
  type LemmaGroup,
  type RootFamily,
  type RootLensOptions,
} from "./roots.js";

// Loop 6a — the tajweed skin (spec §8): the rule registry, the shard lens, and
// the geometry fingerprint that proves a skin swap moved nothing.
export {
  TAJWEED_RULES,
  TAJWEED_CLASS_PREFIX,
  Tajweed,
  tajweedRule,
  isTajweedRuleId,
  tajweedClass,
  tajweedMarkClass,
  marksForAyah,
  leadingRule,
  geometrySignature,
  type SkinId,
  type TajweedRule,
  type TajweedRuleId,
  type TajweedShard,
  type TajweedMark,
  type TajweedLookup,
} from "./skins.js";

// Loop 6a — wayfinding: the jumper's query language, the app-level keyboard
// precedence rule, and the edition registry + cross-edition concordance seam.
export {
  MAX_JUMP_RESULTS,
  parseJump,
  normalizeArabic,
  toWesternDigits,
  targetAyahCount,
  type JumpTarget,
} from "./jump.js";

export {
  JUMPER_KEY,
  appKeyAction,
  type KeyAction,
  type KeyContext,
} from "./keymap.js";

// The print's pagination vs. the pages we hold — the seam a page scrubber
// stands on.
export {
  nearestPage,
  pageFraction,
  spreadOf,
  leafSideOf,
  foldBetween,
  type Spread,
  type LeafSide,
  type Fold,
} from "./pages.js";

export {
  EDITIONS,
  Concordance,
  editionMeta,
  type EditionMeta,
  type EditionStatus,
  type ConcordanceTable,
} from "./concordance.js";

// The revision record: deliberate looks, rolled up by day and by scope. Pure and
// clockless — the time and the reader's UTC offset ride on each event.
export {
  dayOf,
  daysBetween,
  editionOf,
  lastSeen,
  rollUp,
  scopesOf,
  type DayStamp,
  type RevisionEvent,
  type RevisionScope,
} from "./revision.js";
