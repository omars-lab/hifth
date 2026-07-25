import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Adjacency,
  Resolver,
  keyToRef,
  parseAyahKey,
  refToKey,
  type AdjacencyShard,
  type AppState,
  type AssetManifest,
  type AyahRange,
  type AyahRef,
  type Edge,
  type MergedEdge,
  type RailChip,
} from "@hifth/core";
import { loadManifest, loadShard } from "./assets";
import { ayahLabel } from "./format";
import { useHashRouter } from "./useHashRouter";
import { PageStage, type PageStageHandle } from "./components/PageStage";
import { HopRail } from "./components/HopRail";
import { HopPopover } from "./components/HopPopover";
import { HighlightMenu } from "./components/HighlightMenu";
import { TrailBeads, type TrailBead } from "./components/TrailBeads";
import { ShareSheet } from "./components/ShareSheet";
import { InstallButton } from "./components/InstallButton";
import { LiveAnnouncer, useAnnouncer } from "./components/LiveAnnouncer";
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

  const stageRef = useRef<PageStageHandle>(null);
  const { message, announce } = useAnnouncer();

  // Live mirror of the selection so event handlers (which close over a render's
  // value) can read the current one without re-subscribing or an impure updater.
  const selectedKeyRef = useRef(selectedKey);
  selectedKeyRef.current = selectedKey;

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

  // Rail chips for the current selection (empty when nothing selected / no hops).
  const chips = useMemo(
    () => (adjacency && selectedKey ? adjacency.chipsForKey(selectedKey) : []),
    [adjacency, selectedKey],
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
      announce(toggledOff ? "أُلغي التحديد" : `حُدّدت ${ayahLabel(key) ?? key}`);
    },
    [announce],
  );

  // A marquee released over ayahs (Loop 5). The passage replaces the selection —
  // one open hop list at a time — and the stage keeps the amber wash while L3
  // holds the keys the merged hop list is built from.
  const handleSelectRange = useCallback(
    (fromKey: string, toKey: string, keys: readonly string[]) => {
      if (keys.length === 0) return;
      setOpenDirection(null);
      setSelectedKey(null);
      setSelectedRange(keys);
      const span =
        fromKey === toKey
          ? (ayahLabel(fromKey) ?? fromKey)
          : `${ayahLabel(fromKey) ?? fromKey}–${ayahLabel(toKey) ?? toKey}`;
      announce(`ظُلّل ${span}`);
    },
    [announce],
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
        setTrail((t) => [...t, { key: fromKey, page: fromLoc.page }]);
      }
      setOpenDirection(null);
      setSelectedRange(null);
      setSelectedKey(edge.to);
      setPage(toLoc.page);
      announce(`انتقلت إلى ${ayahLabel(edge.to) ?? edge.to} · صفحة ${toLoc.page}`);
      void stageRef.current?.navigateTo(edge.to, { pulse: true });
    },
    [resolver, selectedKey, announce],
  );

  // Bead-back: rewind to a trail origin (pops everything after it) — same path.
  const handleBeadBack = useCallback(
    (index: number) => {
      const target = trail[index];
      if (!target) return;
      setTrail((t) => t.slice(0, index));
      setOpenDirection(null);
      setSelectedKey(target.key);
      setPage(target.page);
      announce(`رجعت إلى ${ayahLabel(target.key) ?? target.key} · صفحة ${target.page}`);
      void stageRef.current?.navigateTo(target.key, { pulse: true });
    },
    [trail, announce],
  );

  const handleClearCurrent = useCallback(() => {
    setOpenDirection(null);
    setSelectedKey(null);
    setSelectedRange(null);
    announce("أُلغي التحديد");
  }, [announce]);

  // A merged range row hops from the member that produced the edge (its diff's
  // "here"), so the trail bead points at a real ayah, not at the passage.
  const handleRangeHop = useCallback(
    (edge: MergedEdge) => handleHop(edge, edge.sources[0]),
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
  const restoreState = useCallback(
    (state: AppState) => {
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
        if (state.page) setPage(state.page);
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
          announce("المقطع المطلوب غير متوفّر بعد");
          return;
        }
        setSelectedKey(null);
        setSelectedRange(keys);
        setPage(head.page);
        announce(`فُتح رابط · مقطع ${surah}:${ayah}-${toAyah} · صفحة ${head.page}`);
        void stageRef.current?.navigateTo(keys[0]!, { pulse: true });
        return;
      }

      const key = refToKey(edition, state.select);
      const loc = resolver.resolve(key);
      if (!loc) {
        // Link points at an un-vendored ayah — keep the trail, don't pan to a ghost.
        setSelectedKey(null);
        setSelectedRange(null);
        announce("الآية المطلوبة غير متوفّرة بعد");
        return;
      }
      setSelectedRange(null);
      setSelectedKey(key);
      setPage(loc.page);
      announce(`فُتح رابط · ${ayahLabel(key) ?? key} · صفحة ${loc.page}`);
      void stageRef.current?.navigateTo(key, { pulse: true });
    },
    [resolver, announce],
  );

  // Gate cold-open restore on the resolver: a deep link parsed before the
  // manifest loads must not be dropped (restoreState no-ops without a resolver).
  useHashRouter(currentState, restoreState, resolver !== null);

  const openChip = chips.find((c) => c.direction === openDirection) ?? null;
  const selectedSurah = selectedKey ? parseAyahKey(selectedKey)?.surah : null;

  return (
    <div className={styles.app} dir="rtl">
      <header className={styles.chrome}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            حفظ
          </span>
          <span className={styles.tagline}>مِلاحة للحُفّاظ</span>
        </div>
        <div className={styles.pageId}>
          <span className={styles.pageLabel}>صفحة</span>
          <span className={`${styles.pageNum} numeric`}>{page}</span>
        </div>
        <InstallButton />
      </header>

      <main className={styles.main}>
        {resolver && (
          <>
            <PageStage
              ref={stageRef}
              resolver={resolver}
              page={page}
              mountedPages={mountedPages}
              label={`صفحة ${page}`}
              selectedKey={selectedKey}
              breadcrumbKey={breadcrumbKey}
              onSelect={handleSelect}
              onSelectRange={handleSelectRange}
              labelFor={(key) => `الآية ${ayahLabel(key) ?? key}`}
            />
            <HopRail
              chips={chips}
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
          </>
        )}
      </main>

      <footer className={styles.trail} aria-label="المسار">
        <TrailBeads
          trail={trail}
          currentKey={selectedKey}
          onBeadBack={handleBeadBack}
          onClearCurrent={handleClearCurrent}
        />
        <ShareSheet state={selectedKey ? currentState : null} hasTrail={trail.length > 0} />
        {selectedSurah && (
          <span className="sr-only">
            {`السورة ${selectedSurah} · ${chips.length} روابط`}
          </span>
        )}
      </footer>

      <LiveAnnouncer message={message} />
    </div>
  );
}
