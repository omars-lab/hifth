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

// Loop 4b — the manifest's wire form. 604 pages of `AssetManifest` is ~109 KB
// gzipped fetched before the first paint; the compact form is an ayah→page
// table, ~1.1 KB, and `expandManifest` rebuilds the rest at load.
export {
  expandManifest,
  compactManifest,
  isCompactManifest,
  type CompactManifest,
  type WireManifest,
} from "./manifest.js";

// Loop 4b — the DOM budget. With the whole print vendored, "the current page
// plus every vendored hop target" is no longer bounded by what we happen to
// hold (`docs/backlog.md` ③); this is the ceiling and the recency rule.
export { MOUNTED_PAGE_CAP, retainPages, spreadBudget } from "./mounted-set.js";

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
  viewFitsAcross,
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
  FIELDS,
  DEFAULT_FIELD,
  isFieldId,
  parseField,
  type FieldId,
} from "./field.js";

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

// The fourth gesture on the same surface — drag-to-turn (`page-turning.md` §4,
// tracking/retreating from `page-transition.md` §3.2). It is exported from the
// same file as the other three because it is decided by the same ladder: one
// verdict wins the stroke, and a turn is what the ladder says when a finger
// moved sideways across a page with nowhere sideways to go.
export {
  TURN_AXIS_RATIO,
  TURN_EDGE_GUARD_PX,
  TURN_COMMIT_FRACTION,
  TURN_FLICK_PX_PER_MS,
  isTurnIntent,
  turnCommit,
  type TurnStroke,
} from "./gestures.js";

// The wheel — the desktop's page turn (`page-transition.md` §3.2 ④). Same file
// and same shape as the pointer split: one sample in, one decision out.
export {
  WHEEL_GAP_MS,
  WHEEL_TURN_PX,
  WHEEL_TURN_REST,
  normalizeWheelDelta,
  nextWheelTurn,
  type WheelSample,
  type WheelTurnState,
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
  PAGE_KEYS,
  appKeyAction,
  type KeyAction,
  type KeyContext,
} from "./keymap.js";

// The print's pagination vs. the pages we hold — the seam a page scrubber
// stands on.
export {
  nearestPage,
  pageFraction,
  pageRuns,
  spreadOf,
  leafSideOf,
  foldBetween,
  type PageRun,
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
  comparableEvents,
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
