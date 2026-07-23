import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Resolver,
  parseAyahKey,
  type Adjacency,
  type AssetManifest,
  type Edge,
  type RailChip,
} from "@hifth/core";
import { loadAdjacency, loadManifest } from "./assets";
import { PageStage, type PageStageHandle } from "./components/PageStage";
import { HopRail } from "./components/HopRail";
import { HopPopover } from "./components/HopPopover";
import { TrailBeads, type TrailBead } from "./components/TrailBeads";
import { InstallButton } from "./components/InstallButton";
import styles from "./App.module.css";

// The app opens on page 7 (the mock's first curated page). Full page routing is
// Loop 3; here the page follows the selection through hops.
const START_PAGE = 7;
// Surahs whose adjacency shards we load up front (Loop 2 = surah 2 only).
const KNOWN_SURAHS = [2];

export function App(): JSX.Element {
  const [manifest, setManifest] = useState<AssetManifest | null>(null);
  const [adjacency, setAdjacency] = useState<Adjacency | null>(null);
  const [page, setPage] = useState(START_PAGE);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [trail, setTrail] = useState<TrailBead[]>([]);
  const [openDirection, setOpenDirection] = useState<RailChip["direction"] | null>(null);

  const stageRef = useRef<PageStageHandle>(null);

  useEffect(() => {
    loadManifest()
      .then((m) => {
        setManifest(m);
        return loadAdjacency(m.edition, KNOWN_SURAHS);
      })
      .then(setAdjacency)
      .catch(() => setManifest(null));
  }, []);

  const resolver = useMemo(
    () => (manifest ? new Resolver(manifest) : null),
    [manifest],
  );

  // Rail chips for the current selection (empty when nothing selected / no hops).
  const chips = useMemo(
    () => (adjacency && selectedKey ? adjacency.chipsForKey(selectedKey) : []),
    [adjacency, selectedKey],
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
    if (adjacency && selectedKey) {
      for (const edge of adjacency.hopsForKey(selectedKey)) {
        const loc = resolver?.resolve(edge.to);
        if (loc) pages.add(loc.page);
      }
    }
    return [...pages];
  }, [page, adjacency, selectedKey, resolver]);

  // The origin ayah keeps its breadcrumb until the trail is empty.
  const breadcrumbKey = trail.length > 0 ? trail[trail.length - 1]!.key : null;

  // Tapping the same ayah again clears it (toggle); otherwise select it.
  const handleSelect = useCallback((key: string) => {
    setOpenDirection(null);
    setSelectedKey((prev) => (prev === key ? null : key));
  }, []);

  // Forward hop: push the origin onto the trail, move to the target, pulse.
  const handleHop = useCallback(
    (edge: Edge) => {
      if (!resolver) return;
      const toLoc = resolver.resolve(edge.to);
      if (!toLoc) return; // unvendored — the button is disabled, defensive here
      const fromKey = selectedKey;
      const fromLoc = fromKey ? resolver.resolve(fromKey) : null;
      if (fromKey && fromLoc) {
        setTrail((t) => [...t, { key: fromKey, page: fromLoc.page }]);
      }
      setOpenDirection(null);
      setSelectedKey(edge.to);
      setPage(toLoc.page);
      void stageRef.current?.navigateTo(edge.to, { pulse: true });
    },
    [resolver, selectedKey],
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
      void stageRef.current?.navigateTo(target.key, { pulse: true });
    },
    [trail],
  );

  const handleClearCurrent = useCallback(() => {
    setOpenDirection(null);
    setSelectedKey(null);
  }, []);

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
              canHop={canHop}
              onHop={handleHop}
              onClose={() => setOpenDirection(null)}
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
        {selectedSurah && (
          <span className="sr-only">
            {`السورة ${selectedSurah} · ${chips.length} روابط`}
          </span>
        )}
      </footer>
    </div>
  );
}
