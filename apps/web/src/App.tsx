import { useCallback, useEffect, useMemo, useState } from "react";
import { Resolver, type AssetManifest } from "@hifth/core";
import { loadManifest } from "./assets";
import { ayahLabel } from "./format";
import { PageStage } from "./components/PageStage";
import { InstallButton } from "./components/InstallButton";
import styles from "./App.module.css";

// Loop 1 opens on page 7 (the mock's first curated page). Page routing is Loop 3.
const START_PAGE = 7;

export function App(): JSX.Element {
  const [manifest, setManifest] = useState<AssetManifest | null>(null);
  const [page] = useState(START_PAGE);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    loadManifest()
      .then(setManifest)
      .catch(() => setManifest(null));
  }, []);

  // One Resolver per manifest — passed to the stage, reused for lookups.
  const resolver = useMemo(
    () => (manifest ? new Resolver(manifest) : null),
    [manifest],
  );

  const pageMeta = manifest?.pages.find((p) => p.page === page);
  const ayahCount = pageMeta?.polygons.length ?? 0;

  // Tapping the same ayah again clears it (toggle); otherwise select it.
  const handleSelect = useCallback((key: string) => {
    setSelectedKey((prev) => (prev === key ? null : key));
  }, []);

  const selectedLabel = selectedKey ? ayahLabel(selectedKey) : null;

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
          <PageStage
            resolver={resolver}
            page={page}
            label={`صفحة ${page}`}
            selectedKey={selectedKey}
            onSelect={handleSelect}
          />
        )}
      </main>

      <footer className={styles.trail} aria-label="المسار">
        {selectedLabel ? (
          <button
            type="button"
            className={styles.selection}
            onClick={() => setSelectedKey(null)}
            aria-live="polite"
          >
            <span className={styles.selectionMark} aria-hidden="true" />
            <span className={styles.selectionLabel}>{selectedLabel}</span>
            <span className={styles.selectionClear} aria-hidden="true">
              ✕
            </span>
            <span className="sr-only">إلغاء التحديد</span>
          </button>
        ) : (
          <span className={styles.trailHint}>
            {ayahCount > 0
              ? `المس آية على الصفحة لتحديدها · ${ayahCount} آية`
              : "…"}
          </span>
        )}
      </footer>
    </div>
  );
}
