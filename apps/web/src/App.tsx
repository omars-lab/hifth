import { useEffect, useState } from "react";
import type { AssetManifest } from "@hifth/core";
import { loadManifest } from "./assets";
import { PageStage } from "./components/PageStage";
import { InstallButton } from "./components/InstallButton";
import styles from "./App.module.css";

// Loop 0 opens on page 7 (the mock's first curated page). Page routing is Loop 3.
const START_PAGE = 7;

export function App(): JSX.Element {
  const [manifest, setManifest] = useState<AssetManifest | null>(null);
  const [page] = useState(START_PAGE);

  useEffect(() => {
    loadManifest().then(setManifest).catch(() => setManifest(null));
  }, []);

  const edition = manifest?.edition ?? "hafs-kfqc";
  const pageMeta = manifest?.pages.find((p) => p.page === page);
  const ayahCount = pageMeta?.polygons.length ?? 0;

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
        <PageStage edition={edition} page={page} label={`صفحة ${page}`} />
      </main>

      <footer className={styles.trail} aria-label="المسار">
        {/* Subha-bead trail is the Loop 2 signature; Loop 0 shows the resting strip. */}
        <span className={styles.trailHint}>
          {ayahCount > 0
            ? `${ayahCount} آيات قابلة للتحديد على هذه الصفحة`
            : "…"}
        </span>
      </footer>
    </div>
  );
}
