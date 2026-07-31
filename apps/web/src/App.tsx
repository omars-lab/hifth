import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Adjacency,
  Concordance,
  Resolver,
  Roots,
  Tajweed,
  appKeyAction,
  editionMeta,
  keyToRef,
  parseAyahKey,
  refToKey,
  type AdjacencyShard,
  type AppState,
  type AssetManifest,
  type AyahRange,
  type AyahRef,
  type AyahRootsShard,
  type Edge,
  type JumpTarget,
  type MergedEdge,
  type RailChip,
  type RootHop,
  type RootIndexShard,
  type SkinId,
  type TajweedShard,
} from "@hifth/core";
import {
  loadManifest,
  loadRootAyahShard,
  loadRootBucket,
  loadShard,
  loadTajweedShard,
} from "./assets";
import { recordLook } from "./revision-store";
import { useT } from "./i18n";
import { useHashRouter } from "./useHashRouter";
import { DESKTOP_QUERY, useMediaQuery } from "./useMediaQuery";
import { PageStage, type PageStageHandle } from "./components/PageStage";
import { PageSpread } from "./components/PageSpread";
import { DesktopChrome } from "./components/DesktopChrome";
import { HopRail } from "./components/HopRail";
import { HopPopover } from "./components/HopPopover";
import { HighlightMenu } from "./components/HighlightMenu";
import { TrailBeads, type TrailBead } from "./components/TrailBeads";
import { ShareSheet } from "./components/ShareSheet";
import { OfflineNotice } from "./components/OfflineNotice";
import { Jumper } from "./components/Jumper";
import { EditionPicker } from "./components/EditionPicker";
import { CoachMarks, coachDismissed } from "./components/CoachMarks";
import { Colophon } from "./components/Colophon";
import { RevisionMap } from "./components/RevisionMap";
import { LiveAnnouncer, useAnnouncer } from "./components/LiveAnnouncer";
import { RootLens, RootLensTrigger } from "./components/RootLens";
import { SkinToggle, TajweedLegend } from "./components/SkinToggle";
import { PageSlider } from "./components/PageSlider";
import styles from "./App.module.css";

// The app opens on page 7 (the mock's first curated page). Full page routing is
// Loop 3; here the page follows the selection through hops.
const START_PAGE = 7;

/** `quran/…/2:47` → its spec-§7 ref, or null if it is not a bare ayah key. */
function refOf(key: string): AyahRef | null {
  const parsed = parseAyahKey(key);
  return parsed ? { surah: parsed.surah, ayah: parsed.ayah } : null;
}

/**
 * The §7 `select` for a highlighted range: first→last ayah of the range's surah
 * (`2:47-2:48`). A one-ayah highlight degrades to the plain ayah form — there is
 * only one canonical link for it — and members outside the opening surah are
 * ignored, since the grammar's range form does not cross surahs.
 */
function rangeSelect(keys: readonly string[]): AyahRef | AyahRange | null {
  const refs = keys.map(refOf).filter((r): r is AyahRef => r !== null);
  if (refs.length === 0) return null;
  const surah = refs[0]!.surah;
  const ayahs = refs.filter((r) => r.surah === surah).map((r) => r.ayah);
  const from = Math.min(...ayahs);
  const to = Math.max(...ayahs);
  return to > from ? { surah, ayah: from, toAyah: to } : { surah, ayah: from };
}

export function App(): JSX.Element {
  const [manifest, setManifest] = useState<AssetManifest | null>(null);
  // Adjacency shards, fetched on demand and cached for the session (Loop 4a:
  // the ETL writes all 114, one per surah, each a few KB gzipped).
  const [shards, setShards] = useState<ReadonlyMap<number, AdjacencyShard>>(new Map());
  const [page, setPage] = useState(START_PAGE);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // The drag-highlighted passage: its ayah keys in reading order (spec §3's
  // `onRangeSelect` payload), or null. Mutually exclusive with `selectedKey` —
  // a highlight replaces a selection and vice versa, so exactly one hop list
  // can be open at a time.
  const [selectedRange, setSelectedRange] = useState<readonly string[] | null>(null);
  const [trail, setTrail] = useState<TrailBead[]>([]);
  const [openDirection, setOpenDirection] = useState<RailChip["direction"] | null>(null);
  // Root lens (Loop 5) shards, in two waves: the selection's surah tells us
  // which roots it carries, and only then do we fetch the buckets holding those
  // roots' corpus-wide occurrence lists. `rootsOpen` is the ⬡ sheet.
  const [rootAyahShards, setRootAyahShards] = useState<
    ReadonlyMap<number, AyahRootsShard>
  >(new Map());
  const [rootBuckets, setRootBuckets] = useState<ReadonlyMap<number, RootIndexShard>>(
    new Map(),
  );
  const [rootsOpen, setRootsOpen] = useState(false);
  // Loop 6a wayfinding sheets: "go to" (`/` or the ⌖ button) and the mushaf
  // picker. Both are modal, so at most one is up at a time in practice.
  const [jumperOpen, setJumperOpen] = useState(false);
  const [editionOpen, setEditionOpen] = useState(false);
  const [colophonOpen, setColophonOpen] = useState(false);
  // The revision map, opened from the page chip. Nothing here holds the record —
  // the sheet reads it itself, so a log of someone's worship is not sitting in
  // this component's state for every future feature to reach into.
  const [revisionOpen, setRevisionOpen] = useState(false);
  /*
   * Is the coach strip still claiming its band of the layout? Read once, from
   * the same storage the strip reads, so the two agree on the very first frame
   * — a notice that appears and is then pushed down a tick later is worse than
   * either strip alone. Private mode throws and `coachDismissed` answers true,
   * which is the right default here too: no strip, so nothing to hold.
   */
  const [coachUp, setCoachUp] = useState(() => !coachDismissed());

  const stageRef = useRef<PageStageHandle>(null);
  /*
   * The open book's own element, so a page turn's fold can be portalled into it.
   *
   * The fold crosses the *whole book*, not one leaf: on a desktop opening both
   * leaves belong to the same sheet of paper, and a band that stopped at the
   * gutter would draw a turn of half a page (docs/design/page-transition.md
   * §3.5). The book and not the desk around it, either — the outer element runs
   * the width of the window, and a band given that would appear on empty field
   * before reaching the paper. Null below the breakpoint, where `PageSpread`
   * renders no wrapper at all and the stage sweeps its own single leaf instead.
   */
  const bookRef = useRef<HTMLDivElement | null>(null);
  /*
   * Is there room for an open mus'haf? Asked in JavaScript rather than left to
   * CSS because the answer decides a *mount*, not a style: each page is a
   * ~170 KB inline SVG, and a `display: none` facing leaf would still fetch it,
   * parse it and build a Highlighter for it. Desktop is where two pages are
   * affordable; a phone is precisely where they are not (PLAN follow-up ①).
   * The query and its arithmetic live in useMediaQuery.ts.
   */
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const { t, dir } = useT();
  const { message, announce } = useAnnouncer();

  // Live mirror of the selection so event handlers (which close over a render's
  // value) can read the current one without re-subscribing or an impure updater.
  const selectedKeyRef = useRef(selectedKey);
  selectedKeyRef.current = selectedKey;

  /*
   * Where the reader is, and where they are *going*.
   *
   * `page` is a committed fact — it changes when a page has actually landed on
   * the stage. A turn takes 240 ms, and during those 240 ms a second arrow press
   * must step from the page being turned to, not from the one still on screen:
   * otherwise holding ArrowLeft oscillates between two pages instead of walking
   * the book. `pendingPageRef` is that destination, and it is the number every
   * page-stepping decision is made against.
   *
   * Both are synced from `page` rather than written at each of the seven places
   * that call `setPage` — a deep link, a hop, a trail rewind and a scrub all
   * settle the reader somewhere, and any of them arriving mid-turn should reset
   * the destination to wherever they put us.
   */
  const pageRef = useRef(page);
  const pendingPageRef = useRef(page);
  useEffect(() => {
    pageRef.current = page;
    pendingPageRef.current = page;
  }, [page]);

  useEffect(() => {
    loadManifest()
      .then(setManifest)
      .catch(() => setManifest(null));
  }, []);

  const resolver = useMemo(
    () => (manifest ? new Resolver(manifest) : null),
    [manifest],
  );

  // The routing table, rebuilt when a shard lands (addShard is a Map.set — the
  // rebuild is trivial and keeps chips/memos consistent via plain deps).
  const adjacency = useMemo(() => {
    if (!manifest) return null;
    const adj = new Adjacency(manifest.edition);
    for (const [surah, shard] of shards) adj.addShard(surah, shard);
    return adj;
  }, [manifest, shards]);

  // Fetch a surah's shard at most once per session; a null result (missing
  // file) still counts as requested so we don't hammer a broken deploy.
  const requestedShards = useRef(new Set<number>());
  const ensureShard = useCallback(
    (surah: number) => {
      if (!manifest || requestedShards.current.has(surah)) return;
      requestedShards.current.add(surah);
      void loadShard(manifest.edition, surah).then((shard) => {
        if (shard) setShards((m) => new Map(m).set(surah, shard));
      });
    },
    [manifest],
  );

  // On-demand load for the selection's surah (covers taps AND deep-link
  // restores — both go through setSelectedKey)…
  useEffect(() => {
    if (!selectedKey) return;
    const surah = parseAyahKey(selectedKey)?.surah;
    if (surah) ensureShard(surah);
  }, [selectedKey, ensureShard]);

  // …and for every surah the highlighted range touches (a range never spans
  // surahs today, but the loop costs nothing and is honest about the shape).
  useEffect(() => {
    if (!selectedRange) return;
    for (const key of selectedRange) {
      const surah = parseAyahKey(key)?.surah;
      if (surah) ensureShard(surah);
    }
  }, [selectedRange, ensureShard]);

  // The root lens over whatever root shards have landed (same rebuild-on-set
  // pattern as `adjacency`; a missing shard just means fewer families).
  const roots = useMemo(() => {
    if (!manifest) return null;
    const lens = new Roots(manifest.edition);
    for (const [surah, shard] of rootAyahShards) lens.addAyahShard(surah, shard);
    for (const [bucket, shard] of rootBuckets) lens.addRootShard(bucket, shard);
    return lens;
  }, [manifest, rootAyahShards, rootBuckets]);

  const requestedRootShards = useRef(new Set<number>());
  const requestedRootBuckets = useRef(new Set<number>());

  // Wave 1 — the selection's surah shard. Cheap and always worth having: it is
  // what tells the ⬡ trigger whether this ayah has any roots at all.
  useEffect(() => {
    if (!manifest || !selectedKey) return;
    const surah = parseAyahKey(selectedKey)?.surah;
    if (!surah || requestedRootShards.current.has(surah)) return;
    requestedRootShards.current.add(surah);
    void loadRootAyahShard(manifest.edition, surah).then((shard) => {
      if (shard) setRootAyahShards((m) => new Map(m).set(surah, shard));
    });
  }, [manifest, selectedKey]);

  // Wave 2 — the buckets, only once the sheet is actually open. A bucket is
  // tens of KB and holds every ayah of every root in it; fetching those for a
  // lens nobody opened would be the loop's biggest wasted byte.
  useEffect(() => {
    if (!manifest || !roots || !rootsOpen || !selectedKey) return;
    for (const bucket of roots.bucketsForKey(selectedKey)) {
      if (requestedRootBuckets.current.has(bucket)) continue;
      requestedRootBuckets.current.add(bucket);
      void loadRootBucket(manifest.edition, bucket).then((shard) => {
        if (shard) setRootBuckets((m) => new Map(m).set(bucket, shard));
      });
    }
  }, [manifest, roots, rootsOpen, selectedKey]);

  // Distinct roots on the selection — the ⬡ trigger's count (0 hides it).
  const rootCount = useMemo(() => {
    if (!roots || !selectedKey) return 0;
    return new Set(roots.rootsForKey(selectedKey).map((r) => r.r)).size;
  }, [roots, selectedKey]);

  // The open lens's families, nearest page first. Null = closed. Families whose
  // bucket is still in flight are simply absent, hence the loading flag.
  const rootFamilies = useMemo(
    () => (roots && rootsOpen && selectedKey ? roots.familiesForKey(selectedKey) : null),
    [roots, rootsOpen, selectedKey],
  );
  const rootsLoading = rootFamilies !== null && rootFamilies.length < rootCount;

  // The lens is about one ayah: moving the selection closes it (this covers
  // taps, hops, bead-backs and deep links in one line, without every handler
  // having to remember).
  useEffect(() => setRootsOpen(false), [selectedKey]);

  // Rail chips for the current selection (empty when nothing selected / no hops).
  const chips = useMemo(
    () => (adjacency && selectedKey ? adjacency.chipsForKey(selectedKey) : []),
    [adjacency, selectedKey],
  );

  // Loop 6a — the ⬡ merge. The rail's other chips are *directions* of one edge
  // type (↻ same surah, ◀ earlier, ▶ later); `root` was an edge *type* wearing a
  // direction's clothes, and it wore the same glyph as the root lens while
  // promising something narrower. So the rail drops it and the lens adopts it:
  // the curated edges are pinned above the corpus families, marked as
  // hand-verified. One glyph, one place, one count. (See `RootLensTrigger`.)
  const railChips = useMemo(() => chips.filter((c) => c.direction !== "root"), [chips]);
  const curatedRoots = useMemo(
    () => chips.find((c) => c.direction === "root")?.edges ?? [],
    [chips],
  );

  // The highlighted range's merged hop list (spec §9): every member's edges,
  // deduped by (target, type), hifz-ordered, each row naming its source ayah.
  const rangeHops = useMemo(
    () => (adjacency && selectedRange ? adjacency.hopsForRange(selectedRange) : []),
    [adjacency, selectedRange],
  );

  // Whether a hop target's page is vendored (drives the disabled state, Plan Q6).
  const canHop = useCallback(
    (toKey: string) => (resolver ? resolver.resolve(toKey) !== null : false),
    [resolver],
  );

  // Pages to keep mounted: the current page + the selection's vendored hop
  // targets, so a hop's tween has both endpoints ready (spec DOM budget).
  const mountedPages = useMemo(() => {
    const pages = new Set<number>([page]);
    const hops = adjacency && selectedKey ? adjacency.hopsForKey(selectedKey) : [];
    for (const edge of [...hops, ...rangeHops]) {
      const loc = resolver?.resolve(edge.to);
      if (loc) pages.add(loc.page);
    }
    return [...pages];
  }, [page, adjacency, selectedKey, rangeHops, resolver]);

  // Prefetch shards for every surah visible on a mounted page, so the rail is
  // ready the moment an ayah is tapped (4b widens this to hop targets as
  // pages stream in).
  useEffect(() => {
    if (!manifest) return;
    for (const p of manifest.pages) {
      if (!mountedPages.includes(p.page)) continue;
      for (const poly of p.polygons) ensureShard(poly.surah);
    }
  }, [manifest, mountedPages, ensureShard]);

  /* ---- the tajweed skin (Loop 6a, spec §8) ------------------------------ */

  // Not persisted, deliberately: the skin is labelled beta until a hafiz signs
  // off, and a beta layer that silently restores itself on every cold start is
  // one a reader can forget they enabled. Opting in each session is the price of
  // shipping it early.
  const [skin, setSkin] = useState<SkinId>("plain");
  const [legendOpen, setLegendOpen] = useState(false);
  const [tajweedShards, setTajweedShards] = useState<ReadonlyMap<number, TajweedShard>>(
    new Map(),
  );
  const requestedTajweed = useRef(new Set<number>());

  // Same rebuild-on-set pattern as `adjacency` and `roots`: a pure index over
  // whatever has landed, so a shard arriving late re-paints the page without any
  // imperative poke at the stage.
  const tajweed = useMemo(() => {
    if (!manifest) return null;
    const lens = new Tajweed(manifest.edition);
    for (const [surah, shard] of tajweedShards) lens.addShard(surah, shard);
    return lens;
  }, [manifest, tajweedShards]);

  // Fetched only once the skin is actually on, and only for surahs on screen —
  // all 114 shards are ~200KB gzipped, and a reader who never opens the skin
  // should not pay a byte of it.
  useEffect(() => {
    if (!manifest || skin !== "tajweed") return;
    for (const p of manifest.pages) {
      if (!mountedPages.includes(p.page)) continue;
      for (const poly of p.polygons) {
        const surah = poly.surah;
        if (requestedTajweed.current.has(surah)) continue;
        requestedTajweed.current.add(surah);
        void loadTajweedShard(manifest.edition, surah).then((shard) => {
          if (shard) setTajweedShards((m) => new Map(m).set(surah, shard));
        });
      }
    }
  }, [manifest, mountedPages, skin]);

  // Every ayah key on the page in view, so the legend can say what is actually
  // in front of the reader rather than reciting seven colours in the abstract.
  const tajweedCounts = useMemo(() => {
    if (!tajweed) return new Map();
    const keys: string[] = [];
    for (const p of manifest?.pages ?? []) {
      if (p.page !== page) continue;
      for (const poly of p.polygons) keys.push(poly.key);
    }
    return tajweed.countsForKeys(keys);
  }, [tajweed, manifest, page]);

  // The selected ayah's rules, spelled out as text — the channel that works
  // with no colour vision at all.
  const tajweedSelection = useMemo(() => {
    if (!tajweed || !selectedKey) return null;
    return {
      label: t.ayahLabel(selectedKey) ?? selectedKey,
      marks: tajweed.marksForKey(selectedKey),
    };
  }, [tajweed, selectedKey, t]);

  // Every vendored page in order, each with an anchor ayah (its first polygon).
  // The stage navigates to *keys*, not to pages, so turning a page means asking
  // for the first ayah on it — which is also where reading resumes.
  const pageTurns = useMemo(() => {
    const anchors = new Map<number, string>();
    for (const p of manifest?.pages ?? []) {
      const first = p.polygons[0];
      if (first) anchors.set(p.page, first.key);
    }
    return { pages: [...anchors.keys()].sort((a, b) => a - b), anchors };
  }, [manifest]);

  // How long the book is, for the page bar's track. `EditionMeta.pages` is the
  // *print's* own count (604 for the Madani mus'haf) and is absent for editions
  // nobody has counted — in which case the bar spans what is vendored rather
  // than a plausible-looking guess, because a track that runs past the end of a
  // mus'haf is a worse lie than a short one.
  const totalPages = useMemo(() => {
    const declared = manifest ? editionMeta(manifest.edition)?.pages : undefined;
    return declared ?? pageTurns.pages[pageTurns.pages.length - 1] ?? 1;
  }, [manifest, pageTurns]);

  // Land on a page. The single navigation path for every way of turning one —
  // the arrow keys, the page bar's edge buttons, and letting go of its slider —
  // so there is one place where "the stage moved" and "the header changed" can
  // get out of step, rather than three. Paging does not touch the selection:
  // you are browsing, not moving your place.
  //
  // `said` is what to announce on arrival. The slider passes a different string
  // when it had to snap, because a landing the reader did not ask for has to be
  // named out loud.
  //
  // `turn` says which of the two verbs this is. Stepping is a *turn*: one leaf's
  // worth of movement, and the fold that crosses says what was between the two
  // pages — a crease, a gap, or a hole where this build skipped what the print
  // has. Everything else — a scrub across half the mus'haf, a deep link, a hop —
  // is a *jump*, and a jump draws no fold at all, because a band crossing the
  // page would assert an adjacency that the reader did not travel through
  // (docs/design/page-transition.md §3.1).
  const goToPage = useCallback(
    (next: number, said?: string, turn = false) => {
      // Against the destination, not the visible page: two quick arrow presses
      // must be two steps, and the second one arrives while the first is still
      // in the air.
      if (next === pendingPageRef.current) return;
      const anchor = pageTurns.anchors.get(next);
      // No anchor means no vendored page — refuse rather than navigate to a
      // blank stage. Callers pick from `pageTurns.pages`, so this is the belt
      // to that braces.
      if (!anchor) return;
      setOpenDirection(null);
      pendingPageRef.current = next;
      announce(said ?? t.pageN(next));
      if (turn) {
        // The header follows the *landing*, not the request: `page` drives the
        // page chip, the leaf's resting edge and the announcer's next line, and
        // a turn that stalls or never arrives must leave all three saying where
        // the reader still is.
        void stageRef.current?.turnTo(next).then((landed) => {
          if (pendingPageRef.current !== next) return; // a newer turn owns it
          if (landed) setPage(next);
          else pendingPageRef.current = pageRef.current;
        });
        return;
      }
      setPage(next);
      // zoom 1 = the page as it sits, not a hop's close framing; no pulse,
      // because nothing here was selected.
      void stageRef.current?.navigateTo(anchor, { pulse: false, zoom: 1 });
    },
    [pageTurns, announce, t],
  );

  // One page's worth of movement. "The next page" means the next page we
  // actually have: until 4b vendors all 604, stepping past the last one would
  // land on a blank, so it says so instead.
  const stepPage = useCallback(
    (step: 1 | -1) => {
      const { pages } = pageTurns;
      if (pages.length === 0) return;
      // From the destination, so a held arrow walks the book rather than
      // bouncing off the page that has not finished turning yet.
      const here = pendingPageRef.current;
      const at = pages.indexOf(here);
      const i = at === -1 ? 0 : Math.min(pages.length - 1, Math.max(0, at + step));
      const next = pages[i]!;
      if (next === here) {
        announce(step > 0 ? t.lastPage : t.firstPage);
        return;
      }
      goToPage(next, undefined, true);
    },
    [pageTurns, announce, t, goToPage],
  );

  // The slider hands back both numbers: where it landed and where the thumb was
  // let go. They differ whenever the reader aimed into the un-vendored gap, and
  // when they do the announcement names the page they actually got.
  const handleScrubTo = useCallback(
    (landed: number, asked: number) => {
      const said = landed === asked ? undefined : t.nearestPageN(landed);
      // Snapping back onto the page already showing moves nothing, so `goToPage`
      // would say nothing — and silence is the wrong answer to a drag across
      // half the mus'haf. Say where they are.
      if (landed === page) {
        if (said) announce(said);
        return;
      }
      goToPage(landed, said);
    },
    [goToPage, page, announce, t],
  );

  // The origin ayah keeps its breadcrumb until the trail is empty.
  const breadcrumbKey = trail.length > 0 ? trail[trail.length - 1]!.key : null;

  // Tapping the same ayah again clears it (toggle); otherwise select it. The
  // announcement is a side effect, so it lives outside the state updater (React
  // may invoke updaters twice in dev to check purity — announcing there would
  // fire the toggle branch spuriously). We read the live value via a ref.
  const handleSelect = useCallback(
    (key: string) => {
      setOpenDirection(null);
      setSelectedRange(null); // a tap replaces a highlight — never both at once
      const toggledOff = selectedKeyRef.current === key;
      setSelectedKey(toggledOff ? null : key);
      announce(toggledOff ? t.selectionCleared : t.selected(t.ayahLabel(key) ?? key));
      // The revision record, and the reason this sits inside the toggle branch:
      // the second tap on the same ayah means "dismiss", and counting it as a
      // second look would double the score of every ayah the reader changed
      // their mind about. Fire and forget — a lost row is not worth a hitch in
      // the gesture, and `recordLook` never rejects.
      const loc = toggledOff ? null : resolver?.resolve(key);
      if (loc) void recordLook({ key, page: loc.page });
    },
    [announce, resolver, t],
  );

  // A marquee released over ayahs (Loop 5). The passage replaces the selection —
  // one open hop list at a time — and the stage keeps the amber marks while L3
  // holds the keys the merged hop list is built from.
  const handleSelectRange = useCallback(
    (fromKey: string, toKey: string, keys: readonly string[]) => {
      if (keys.length === 0) return;
      setOpenDirection(null);
      setSelectedKey(null);
      setSelectedRange(keys);
      const span =
        fromKey === toKey
          ? (t.ayahLabel(fromKey) ?? fromKey)
          : `${t.ayahLabel(fromKey) ?? fromKey}–${t.ayahLabel(toKey) ?? toKey}`;
      announce(t.highlighted(span));
      // One event for the whole passage, not one per ayah: a marquee across
      // twelve ayahs is a single look, and counting it twelve times would let
      // one drag outweigh a page read carefully.
      const loc = resolver?.resolve(fromKey);
      if (loc) void recordLook({ key: fromKey, endKey: toKey, page: loc.page });
    },
    [announce, resolver, t],
  );

  // Forward hop: push the origin onto the trail, move to the target, pulse.
  // `origin` overrides the breadcrumb source — a merged range hop leaves from the
  // range member that actually produced the edge, not from the whole highlight.
  const handleHop = useCallback(
    (edge: Edge, origin?: string) => {
      if (!resolver) return;
      const toLoc = resolver.resolve(edge.to);
      if (!toLoc) return; // unvendored — the button is disabled, defensive here
      const fromKey = origin ?? selectedKey;
      const fromLoc = fromKey ? resolver.resolve(fromKey) : null;
      if (fromKey && fromLoc) {
        setTrail((beads) => [...beads, { key: fromKey, page: fromLoc.page }]);
      }
      setOpenDirection(null);
      setSelectedRange(null);
      setSelectedKey(edge.to);
      setPage(toLoc.page);
      announce(t.hoppedTo(t.ayahLabel(edge.to) ?? edge.to, toLoc.page));
      void stageRef.current?.navigateTo(edge.to, { pulse: true });
    },
    [resolver, selectedKey, announce, t],
  );

  // Bead-back: rewind to a trail origin (pops everything after it) — same path.
  const handleBeadBack = useCallback(
    (index: number) => {
      const target = trail[index];
      if (!target) return;
      setTrail((beads) => beads.slice(0, index));
      setOpenDirection(null);
      setSelectedKey(target.key);
      setPage(target.page);
      announce(t.backTo(t.ayahLabel(target.key) ?? target.key, target.page));
      void stageRef.current?.navigateTo(target.key, { pulse: true });
    },
    [trail, announce, t],
  );

  const handleClearCurrent = useCallback(() => {
    setOpenDirection(null);
    setSelectedKey(null);
    setSelectedRange(null);
    announce(t.selectionCleared);
  }, [announce, t]);

  // A root-lens row hops like any other edge — the lens already carries the
  // target's page and direction, so it maps straight onto the §6 Edge shape and
  // reuses one navigation path (trail bead, pulse, announcement).
  const handleRootHop = useCallback(
    (hop: RootHop) =>
      handleHop({
        type: "shared-root",
        to: hop.key,
        page: hop.page,
        dir: { dSurah: hop.dSurah, dPage: hop.dPage, sameJuz: hop.sameJuz },
      }),
    [handleHop],
  );

  // A merged range row hops from the member that produced the edge (its diff's
  // "here"), so the trail bead points at a real ayah, not at the passage.
  const handleRangeHop = useCallback(
    (edge: MergedEdge) => handleHop(edge, edge.from),
    [handleHop],
  );

  // The current view as a spec-§7 AppState — what the URL encodes and Share
  // serializes. `via` is the immediate breadcrumb origin; `trail` is the rest of
  // the chain (all but the top, which is `via`) so a deep link restores both.
  const currentState = useMemo<AppState | null>(() => {
    if (!resolver) return null;
    const edition = resolver.edition;
    // A highlighted range serializes through the §7 range form (`2:47-2:48`);
    // a single ayah through the plain form. Never both — they are exclusive.
    const select = selectedRange
      ? rangeSelect(selectedRange)
      : selectedKey
        ? refOf(selectedKey)
        : null;
    if (!select) {
      return { edition, select: null, page };
    }
    const trailRefs = trail
      .map((b) => keyToRef(b.key))
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const via = trailRefs.length > 0 ? trailRefs[trailRefs.length - 1] : undefined;
    const rest = trailRefs.slice(0, -1);
    return {
      edition,
      select,
      ...(via ? { via } : {}),
      ...(rest.length > 0 ? { trail: rest } : {}),
    };
  }, [resolver, selectedKey, selectedRange, page, trail]);

  // Restore a parsed deep link through the SAME select/navigateTo path a live
  // hop uses (spec §7: no separate deep-link logic to drift). Rebuilds the trail
  // from `trail`+`via`, sets the selection, and pans to it.
  // `origin` only chooses the wording of the announcement — a jump lands by the
  // same code as a shared link, and must keep doing so.
  const restoreState = useCallback(
    (state: AppState, origin: "link" | "jump" = "link") => {
      if (!resolver) return;
      const edition = resolver.edition;
      // Rebuild the trail beads from the link's trail + via (oldest → newest).
      const chain = [...(state.trail ?? []), ...(state.via ? [state.via] : [])];
      const beads: TrailBead[] = [];
      for (const ref of chain) {
        const key = refToKey(edition, ref);
        const loc = resolver.resolve(key);
        if (loc) beads.push({ key, page: loc.page });
      }
      setTrail(beads);
      setOpenDirection(null);

      if (state.select === null) {
        setSelectedKey(null);
        setSelectedRange(null);
        // A page link (`#/hafs-kfqc/p9`) has to move the stage, not just the
        // header. Setting `page` alone renumbered the chrome while the reader
        // kept looking at whatever page was already mounted — the one case
        // where the app said one thing and showed another.
        if (state.page) {
          setPage(state.page);
          announce(t.arrivedPage(origin, state.page));
          void stageRef.current?.showPage(state.page);
        }
        return;
      }

      // A range link (`2:47-2:48`) restores the highlight + its merged menu, on
      // the same path the gesture takes — expand it to its member keys.
      if ("toAyah" in state.select) {
        const { surah, ayah, toAyah } = state.select;
        const keys: string[] = [];
        for (let a = ayah; a <= toAyah; a++) keys.push(refToKey(edition, { surah, ayah: a }));
        const head = resolver.resolve(keys[0]!);
        if (!head) {
          setSelectedKey(null);
          setSelectedRange(null);
          announce(t.rangeUnavailable);
          return;
        }
        setSelectedKey(null);
        setSelectedRange(keys);
        setPage(head.page);
        announce(t.arrivedRange(origin, `${surah}:${ayah}-${toAyah}`, head.page));
        void stageRef.current?.navigateTo(keys[0]!, { pulse: true });
        return;
      }

      const key = refToKey(edition, state.select);
      const loc = resolver.resolve(key);
      if (!loc) {
        // Link points at an un-vendored ayah — keep the trail, don't pan to a ghost.
        setSelectedKey(null);
        setSelectedRange(null);
        announce(t.ayahUnavailable);
        return;
      }
      setSelectedRange(null);
      setSelectedKey(key);
      setPage(loc.page);
      announce(t.arrivedAyah(origin, t.ayahLabel(key) ?? key, loc.page));
      void stageRef.current?.navigateTo(key, { pulse: true });
    },
    [resolver, announce, t],
  );

  // Gate cold-open restore on the resolver: a deep link parsed before the
  // manifest loads must not be dropped (restoreState no-ops without a resolver).
  useHashRouter(currentState, restoreState, resolver !== null);

  // A jump lands through `restoreState` — the same path a live hop and a
  // cold-opened link take (spec §7; Loop 3's record says why a second navigation
  // path drifts). It also leaves a bead: "go to الكهف" is as undoable as a chip,
  // so the chain is the existing trail plus the ayah we are leaving.
  const handleJump = useCallback(
    (target: JumpTarget) => {
      if (!resolver) return;
      const chain = [...trail.map((b) => b.key), ...(selectedKey ? [selectedKey] : [])]
        .map(keyToRef)
        .filter((r): r is AyahRef => r !== null);
      const via = chain.length > 0 ? chain[chain.length - 1] : undefined;
      const rest = chain.slice(0, -1);
      restoreState(
        {
          edition: resolver.edition,
          select: { surah: target.surah, ayah: target.ayah },
          ...(via ? { via } : {}),
          ...(rest.length > 0 ? { trail: rest } : {}),
        },
        "jump",
      );
    },
    [resolver, trail, selectedKey, restoreState],
  );

  // The cross-edition mapping table. Empty today — only `hafs-kfqc` is vendored
  // — and deliberately not filled with an identity guess: with no table, a
  // position does not travel (spec §1 forbids cross-edition index arithmetic).
  // The picker shows that, per row, instead of hiding the gap.
  const concordance = useMemo(() => new Concordance(), []);

  // Unreachable today (the only vendored edition is the current one, and the
  // picker disables its own row), so this is the seam rather than a feature:
  // when a second mushaf is vendored, this is where the switch lands, and it
  // refuses rather than guesses while the table is missing.
  const handleEditionSelect = useCallback(
    (edition: string) => {
      setEditionOpen(false);
      const mapped = selectedKey ? concordance.map(selectedKey, edition) : null;
      announce(mapped ? (t.ayahLabel(mapped) ?? mapped) : t.noConcordance);
    },
    [selectedKey, concordance, announce, t],
  );

  // The app-level keyboard map (arrows = pages, `/` = the jumper), applied
  // through core's `appKeyAction` — the precedence ladder and its reasoning live
  // there, tested, so this listener only has to describe the DOM honestly.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const action = appKeyAction({
        key: e.key,
        modified: e.altKey || e.ctrlKey || e.metaKey,
        defaultPrevented: e.defaultPrevented,
        inTextField:
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          el instanceof HTMLSelectElement ||
          el?.isContentEditable === true,
        // Any open sheet owns the keyboard while it is up — it is modal, and its
        // own Escape/Tab handling is the contract. Asking the DOM instead of
        // OR-ing this loop's flags keeps that true for sheets other loops add.
        inDialog: document.querySelector('[role="dialog"]') !== null,
        // The polygons live inside the page <svg>; Loop 3 gives them the arrows.
        onAyah: el?.closest?.("svg") != null,
      });
      if (!action) return;
      e.preventDefault();
      if (action.kind === "jumper") {
        setJumperOpen(true);
        return;
      }
      stepPage(action.step);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stepPage]);

  const openChip = railChips.find((c) => c.direction === openDirection) ?? null;
  const selectedSurah = selectedKey ? parseAyahKey(selectedKey)?.surah : null;

  return (
    // The chrome reads in the UI language's direction — every offset in the
    // stylesheet is a logical property, so the flip is the whole change. What
    // does *not* flip is below: the stage, the rail and the trail are pinned
    // RTL because they are furniture around a mus'haf, not around a sentence.
    <div className={styles.app} dir={dir}>
      <header className={styles.chrome}>
        {/* The wordmark is the colophon's opener. Publishing this app conveys
            it (GPL §6), so the source offer and the four source credits have to
            be reachable from the running page — and the chrome already carries
            ⌖, ▤, the skin switch and its legend. A fifth button would
            take thumb-width from navigation to say "about"; the wordmark was
            decoration, and "about" is what a wordmark is always allowed to be. */}
        <button
          type="button"
          className={styles.brand}
          aria-label={t.about}
          aria-haspopup="dialog"
          onClick={() => setColophonOpen(true)}
        >
          {/* The name and the tagline stay Arabic in both languages: «حفظ» is
              what the app is called, not a word to translate, and the pair is
              load-bearing for the header's height in the golden images. */}
          <span className={styles.mark} aria-hidden="true" lang="ar" dir="rtl">
            حفظ
          </span>
          <span className={styles.tagline} lang="ar" dir="rtl">
            مِلاحة للحُفّاظ
          </span>
        </button>
        {/* The chip already meant *where am I*; pressing it now also answers
            *where have I been*. It opens the revision map rather than a sixth
            header button because the chrome has no room for one — `e2e/chrome-fit`
            holds this header inside 320px with seventeen pixels to spare, which
            is the same constraint that put the colophon behind the wordmark. It
            still shows the page, unchanged, at the same width. */}
        <button
          type="button"
          className={styles.pageId}
          aria-label={t.mapOpen(page)}
          aria-haspopup="dialog"
          onClick={() => setRevisionOpen(true)}
        >
          <span className={styles.pageLabel}>{t.pageWord}</span>
          <span className={`${styles.pageNum} numeric`}>{page}</span>
        </button>
        {/* Wayfinding lives in the chrome because it is always available: the
            keyboard has `/`, and a touch device needs something to press. */}
        <button
          type="button"
          className={styles.chromeBtn}
          aria-label={t.goToLong}
          aria-haspopup="dialog"
          onClick={() => setJumperOpen(true)}
        >
          ⌖
        </button>
        <button
          type="button"
          className={styles.chromeBtn}
          aria-label={t.mushaf}
          aria-haspopup="dialog"
          onClick={() => setEditionOpen(true)}
        >
          ▤
        </button>
        {/* The skin switch sits in the chrome, next to the other always-on
            controls: it is a way of *reading* the page, not a per-selection
            action, and its beta badge has to be visible before it is used. */}
        <SkinToggle
          skin={skin}
          onChange={setSkin}
          onOpenLegend={() => setLegendOpen(true)}
        />
        {/* The controls a phone had no room for — the language switch (buried in
            the colophon sheet because the header has seventeen pixels of slack
            at 320px) and the keyboard map (which a phone cannot reach at all).
            Hidden by CSS below the breakpoint, so it costs this row nothing:
            `display: none` keeps it out of both the intrinsic width and the
            accessibility tree, which is what chrome-fit and the aria snapshots
            measure. See docs/decisions/desktop-vs-mobile.md rows 3 and 13. */}
        <DesktopChrome />
        {/* No install button here. There used to be one, and it was a ~126px
            text pill in a row that could not afford 126px on any phone — on
            Android, the one platform where it ever rendered, it was the single
            largest thing in the chrome. It also said nothing OfflineNotice does
            not already say better: the `install-prompt` notice fires the same
            `promptInstall()`, gives the reason (the pages you visited stay on
            your device), and can be dismissed. A permanent navigation row is
            the wrong lane for a promo that disappears the moment it is used. */}
      </header>

      {/* Offline durability, when there is something honest to say about it:
          a capped quota, a missing install, a denied persist(). Silent when
          storage is persisted — the good case earns no chrome.

          Held while the coach strip is up. Both are strips in the layout, and
          both were right to be: neither may cover an ayah. Stacked they cost
          226px on a 412×839 phone — the stage drops from 713px to 487px, a
          third of it, on exactly the visit where a reader is deciding what
          this app is. So they take turns, and the teaching goes first: one
          asks for a tap now, the other warns about eviction that may never
          come. */}
      <OfflineNotice hold={coachUp} />

      {/* The three verbs, once, in the layout rather than over the page — the
          first tap it teaches has to land while the strip is still up. */}
      <CoachMarks ready={resolver !== null} onDismiss={() => setCoachUp(false)} />

      {/* Pinned RTL, in both languages. The mus'haf is read right-to-left, the
          page-turn convention follows it (Loop 1's decision), and the hop rail
          anchors to `inset-inline-start` — under an LTR chrome the rail would
          swap to the side the reader's thumb is not on and the arrow keys would
          argue with the page. */}
      <main className={styles.main} dir="rtl">
        {resolver && (
          <>
            {/* At desktop width the stage is one leaf of an open mus'haf: the
                lower page number on the right, the next page to its left, and
                the facing leaf drawn as *absent* when this build does not hold
                it — which today is always, since pages 7, 9 and 19 are not
                adjacent. Below the breakpoint this renders the stage alone and
                nothing else changes. docs/design/desktop.md. */}
            <PageSpread
              enabled={desktop}
              page={page}
              total={totalPages}
              available={pageTurns.pages}
              bookRef={bookRef}
              renderFacing={(facing) => (
                /* The facing leaf gets its own stage rather than a second
                   visible host inside the current one: PageStage's whole
                   correctness argument is that there is exactly one imperative
                   write path to one visible host, and two transforms inside it
                   is a bigger change than two instances beside each other.
                   No `ref` — the imperative handle is how App drives *the*
                   stage, and a hop that landed on the facing leaf would have to
                   move the reader there anyway, at which point the two swap
                   roles through `page`. Handlers are shared so an ayah on the
                   facing leaf is as tappable as one on this leaf. */
                <PageStage
                  key={facing}
                  resolver={resolver}
                  page={facing}
                  total={totalPages}
                  mountedPages={[facing]}
                  label={t.pageN(facing)}
                  selectedKey={selectedKey}
                  breadcrumbKey={breadcrumbKey}
                  onSelect={handleSelect}
                  onSelectRange={handleSelectRange}
                  labelFor={(key) => t.ayahAria(t.ayahLabel(key) ?? key)}
                  skin={skin}
                  tajweedLookup={tajweed?.lookup ?? null}
                />
              )}
            >
              <PageStage
                ref={stageRef}
                resolver={resolver}
                page={page}
                total={totalPages}
                mountedPages={mountedPages}
                label={t.pageN(page)}
                selectedKey={selectedKey}
                breadcrumbKey={breadcrumbKey}
                onSelect={handleSelect}
                onSelectRange={handleSelectRange}
                labelFor={(key) => t.ayahAria(t.ayahLabel(key) ?? key)}
                skin={skin}
                tajweedLookup={tajweed?.lookup ?? null}
                /* Only the live stage turns pages, and only on a desktop
                   spread does the fold belong to something wider than it. */
                foldTarget={desktop ? bookRef : null}
              />
            </PageSpread>
            <HopRail
              chips={railChips}
              openDirection={openDirection}
              onOpenChip={(chip) =>
                setOpenDirection((d) => (d === chip.direction ? null : chip.direction))
              }
            />
            <HopPopover
              chip={openChip}
              fromKey={selectedKey}
              canHop={canHop}
              onHop={handleHop}
              onClose={() => setOpenDirection(null)}
            />
            <HighlightMenu
              rangeKeys={selectedRange}
              hops={rangeHops}
              canHop={canHop}
              onHop={handleRangeHop}
              shareState={currentState}
              onClear={handleClearCurrent}
              // Dismissing the menu drops the highlight with it: a wash with no
              // menu would be a dead end (nothing re-opens it but a fresh drag).
              onClose={() => setSelectedRange(null)}
            />
            <RootLens
              families={rootFamilies}
              loading={rootsLoading}
              curated={curatedRoots}
              canHop={canHop}
              onHop={handleRootHop}
              onHopEdge={handleHop}
              onClose={() => setRootsOpen(false)}
            />
          </>
        )}
      </main>

      <Jumper
        open={jumperOpen}
        onJump={handleJump}
        onClose={() => setJumperOpen(false)}
      />
      {/* CC BY 4.0's condition, discharged where a reader can see it — the
          licence the rule spans ship under requires the credit to travel with
          the work, not just with the repo. */}
      <TajweedLegend
        open={legendOpen}
        counts={tajweedCounts}
        page={page}
        selection={tajweedSelection}
        credit={{
          text: t.tajweedCredit,
          href: "https://github.com/cpfair/quran-tajweed",
        }}
        onClose={() => setLegendOpen(false)}
      />
      <EditionPicker
        open={editionOpen}
        current={manifest?.edition ?? ""}
        currentKey={selectedKey}
        concordance={concordance}
        onSelect={handleEditionSelect}
        onClose={() => setEditionOpen(false)}
      />
      <Colophon open={colophonOpen} onClose={() => setColophonOpen(false)} />
      <RevisionMap
        open={revisionOpen}
        onClose={() => setRevisionOpen(false)}
        pages={manifest?.pages ?? []}
        totalPages={totalPages}
        page={page}
      />

      {/* Pinned RTL with the stage, and for the same reason: the trail reads
          oldest-to-newest in the mus'haf's own direction, and its beads sit
          under the rail they came from. */}
      <footer className={styles.trail} aria-label={t.trail} dir="rtl">
        <TrailBeads
          trail={trail}
          currentKey={selectedKey}
          onBeadBack={handleBeadBack}
          onClearCurrent={handleClearCurrent}
        />
        <RootLensTrigger
          count={rootCount}
          curated={curatedRoots.length}
          open={rootsOpen}
          onToggle={() => setRootsOpen((o) => !o)}
        />
        <ShareSheet state={selectedKey ? currentState : null} hasTrail={trail.length > 0} />
        {/* Screen-reader-only summary of what the rail is offering. It used to
            read «السورة 2 · 1 روابط» — the surah as a bare number a listener has
            no way to map back to a name, and Latin digits inside an Arabic
            phrase. Every other label in the app says «البقرة» and «٢:٤٨»; the
            one string nobody could see was the one that drifted. */}
        {selectedSurah && (
          <span className="sr-only">
            {t.railSummary(t.surahName(selectedSurah), chips.length)}
          </span>
        )}
      </footer>

      {/* The bottom-most chrome, and the second way through the book after the
          jumper: a track the length of the whole mus'haf with a page turn on
          each edge. Pinned RTL like the stage and the trail — page 1 is on the
          right, and the button that moves forward is on the left. */}
      <PageSlider
        total={totalPages}
        available={pageTurns.pages}
        page={page}
        onStep={stepPage}
        onGoTo={handleScrubTo}
      />

      <LiveAnnouncer message={message} />
    </div>
  );
}
