import { useCallback, useRef, useState } from "react";
import { useT } from "../i18n";
import { importTafsirBundle, parseBundleFiles, tafsirStorageSupported } from "../tafsir/sideload";
import styles from "./TafsirImport.module.css";

interface TafsirImportProps {
  /** The id and label of an edition already loaded on this device, if any, so
   * the control can offer to remove it rather than re-import blindly. */
  readonly loaded?: { readonly id: string; readonly label: string } | null;
  /** Called after a folder imports successfully, with the registered source id,
   * so the app re-reads the provider registry. */
  readonly onImported: (sourceId: string) => void;
  /** Called after the loaded edition is removed. */
  readonly onRemoved: (sourceId: string) => void;
  /** Removes a stored edition. Injected so the component stays DOM-only and the
   * IndexedDB call is mockable in a test. */
  readonly removeBundle: (sourceId: string) => Promise<void>;
}

/**
 * One idle → busy → (ok | error) result of the last folder pick. Idle reserves
 * no space, so the Colophon does not jump before anyone has chosen anything.
 */
type Status =
  | { readonly kind: "idle" }
  | { readonly kind: "busy" }
  | { readonly kind: "ok"; readonly label: string; readonly surahs: number; readonly entries: number }
  | { readonly kind: "error"; readonly reason: string };

/**
 * Side-load a commentary edition from a folder.
 *
 * The reader owns the book (the first is a DRM purchase); its bytes are theirs,
 * so they arrive as a folder we read in *their* browser and store in *their*
 * IndexedDB — never uploaded, never in the repo. This control is the one place
 * the DOM meets `tafsir/sideload.ts`: it reads the picked `File`s into
 * name/text pairs and hands them to `parseBundleFiles`; the parse, the adapt,
 * the store and the provider registration all live behind that seam.
 *
 * `webkitdirectory` is set on the input through a ref callback rather than in
 * JSX because the React DOM types do not carry the attribute, and a ref set is
 * cleaner than casting the element's props to `any`. It makes the file dialog a
 * folder picker in every browser that ships one (all the desktop targets); a
 * browser without it degrades to a multi-file picker, which `parseBundleFiles`
 * handles identically — it keys on basenames, not on a directory handle.
 */
export function TafsirImport({ loaded, onImported, onRemoved, removeBundle }: TafsirImportProps): JSX.Element {
  const { t } = useT();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const supported = tafsirStorageSupported();

  const setInput = useCallback((el: HTMLInputElement | null) => {
    inputRef.current = el;
    if (el) el.setAttribute("webkitdirectory", "");
  }, []);

  const onPick = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files;
      if (!list || list.length === 0) return;
      setStatus({ kind: "busy" });
      const files = await Promise.all(
        Array.from(list).map(async (f) => ({ name: f.name, text: await f.text() })),
      );
      // Let a re-pick of the same folder fire onChange again.
      e.target.value = "";
      const bundle = parseBundleFiles(files);
      if (!bundle) {
        setStatus({ kind: "error", reason: "no manifest.json in the folder" });
        return;
      }
      const result = await importTafsirBundle(bundle);
      if (!result.ok) {
        setStatus({ kind: "error", reason: result.error ?? "unknown" });
        return;
      }
      const label = bundle.manifest.title ?? result.sourceId;
      setStatus({ kind: "ok", label, surahs: result.surahs.length, entries: result.entries });
      onImported(result.sourceId);
    },
    [onImported],
  );

  const onRemove = useCallback(async () => {
    if (!loaded) return;
    await removeBundle(loaded.id);
    setStatus({ kind: "idle" });
    onRemoved(loaded.id);
  }, [loaded, onRemoved, removeBundle]);

  return (
    <>
      <input
        ref={setInput}
        type="file"
        multiple
        hidden
        onChange={(e) => void onPick(e)}
        data-testid="tafsir-folder-input"
      />

      {loaded ? (
        <div className={styles.loadedRow}>
          <span className={styles.status}>{t.tafsirImportLoaded(loaded.label)}</span>
          <button type="button" className={styles.remove} onClick={() => void onRemove()}>
            {t.tafsirImportRemove}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={styles.button}
          disabled={!supported || status.kind === "busy"}
          onClick={() => inputRef.current?.click()}
        >
          {t.tafsirImportButton}
        </button>
      )}

      {!supported && <p className={`${styles.status} ${styles.error}`}>{t.tafsirImportUnsupported}</p>}
      {status.kind === "busy" && <p className={styles.status}>{t.tafsirImportBusy}</p>}
      {status.kind === "ok" && (
        <p className={styles.status}>{t.tafsirImportOk(status.label, status.surahs, status.entries)}</p>
      )}
      {status.kind === "error" && (
        <p className={`${styles.status} ${styles.error}`}>{t.tafsirImportError(status.reason)}</p>
      )}
    </>
  );
}
