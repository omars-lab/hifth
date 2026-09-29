/**
 * Side-loaded tafsir: a private commentary edition the reader owns, imported
 * from a folder of JSON and served behind the `@hifth/core` provider seam.
 *
 * ## Why the bytes live here and never in the repo
 *
 * The first provider is *The Study Quran* — a DRM book the reader bought. Its
 * text is theirs, not ours: the scripture-text gate (`make ci`) forbids a
 * committed passage, and the `tafseer-source` decision keeps no vendored copy.
 * So the edition arrives at runtime as a folder the reader points us at, we
 * store it in *their* browser, and core never sees a byte of it — core owns the
 * key grammar, the `TafsirProvider` contract, and the registry; the data and
 * the I/O are the app's, and specifically this file's.
 *
 * ## The shape on the wire is not the shape core wants
 *
 * The export pipeline (`scripts/export_tafseer.py`) writes a bundle tuned for
 * provenance, not for the panel: `translation` is an object carrying the page
 * and the image sha it was read from, `commentary` is grouped by the lemma the
 * source attached each note to, and `refs` are `{key, commentary}` objects. The
 * panel wants a flat `TafsirEntry`: a translation string, a list of blocks each
 * remembering its channel and lemma, and refs as bare ayah keys. `adaptEntry`
 * is that seam — the one place the disk shape is read, so the on-disk format can
 * change without the provider or the panel knowing.
 *
 * ## Cache Storage vs. IndexedDB, again
 *
 * `packs.ts` split the pinned bytes (Cache Storage) from the claim that they
 * were pinned (IndexedDB) so an eviction was *detectable*. A side-loaded edition
 * is not fetched from the network — there is nothing to re-pin from — so it is
 * all claim: the JSON lives in IndexedDB, and if the browser sweeps it the
 * reader re-imports the folder. One store, two record kinds: a per-source
 * manifest that lists which surahs are present (so a provider can answer
 * `has(surah)` without loading a single entry), and a record per surah holding
 * the adapted entries, read only when the panel opens that surah.
 *
 * ## Never throws at the caller
 *
 * Like `packs.ts`: a browser with no IndexedDB, a private mode, a quota that
 * says no, a malformed folder — every one means "this edition is not loaded",
 * returned as a status, never as an exception that takes the app down.
 */
import {
  parseAyahKey,
  registerTafsirProvider,
  tafsirKeyFor,
  unregisterTafsirProvider,
  type TafsirBlock,
  type TafsirEntry,
  type TafsirProvider,
  type TafsirSource,
} from "@hifth/core";

const DB_NAME = "hifth.tafsir.v1";
const DB_VERSION = 1;
const STORE = "tafsir";

/**
 * The manifest as `export_tafseer.py` writes it. Only the fields the import
 * reads are typed; the rest (per-surah hashes, build time) ride along untouched.
 */
interface RawManifest {
  readonly source: string;
  readonly license: string;
  readonly edition: string;
  readonly title?: string;
  readonly surahs: Record<string, { readonly file: string }>;
}

/** One `{a, z}` lemma span, or a single ayah when `z === a`. */
type RawLemma = readonly [number, number];

interface RawBlock {
  readonly text: string;
  readonly channel?: string;
}

interface RawCommentaryGroup {
  readonly lemma?: RawLemma;
  readonly blocks?: readonly RawBlock[];
}

interface RawRef {
  readonly key: string;
}

interface RawEntry {
  readonly key: string;
  readonly translation?: { readonly text?: string } | string | null;
  readonly commentary?: readonly RawCommentaryGroup[];
  readonly refs?: readonly (RawRef | string)[];
}

interface RawSurahFile {
  readonly surah: number;
  readonly entries?: readonly RawEntry[];
}

/** A parsed bundle: the manifest plus every `NNN.json` keyed by surah. The
 * caller reads the folder (a `File[]` in the browser, fixtures in a test) into
 * this DOM-free shape, so the adapter and the store never touch the DOM. */
export interface ParsedBundle {
  readonly manifest: RawManifest;
  readonly surahs: ReadonlyMap<number, RawSurahFile>;
}

/** What an import did, in words the UI can show. Never an exception. */
export interface ImportResult {
  readonly ok: boolean;
  /** The provider id it registered, e.g. `study-quran`. */
  readonly sourceId: string;
  /** Surah numbers stored, ascending. */
  readonly surahs: readonly number[];
  /** Total entries across all surahs. */
  readonly entries: number;
  /** Present only when `ok` is false — a short reason for the reader. */
  readonly error?: string;
}

/** What the store holds for one source so a provider can be rebuilt at startup
 * without loading a single entry. */
interface ManifestRecord {
  readonly id: string;
  readonly kind: "manifest";
  readonly source: TafsirSource;
  readonly surahs: readonly number[];
}

interface SurahRecord {
  readonly id: string;
  readonly kind: "surah";
  readonly sourceId: string;
  readonly surah: number;
  readonly entries: readonly TafsirEntry[];
}

/** Whether this browser can hold a side-loaded edition at all. */
export function tafsirStorageSupported(): boolean {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("tafsir store blocked by another tab"));
  });
}

/** The manifest record's id is the bare source id; a surah record's id carries
 * a slash. A source id may not contain a slash (the key grammar forbids it), so
 * the two kinds never collide on a key. */
function surahRecordId(sourceId: string, surah: number): string {
  return `${sourceId}/${surah}`;
}

/**
 * Turn one on-disk entry into the flat `TafsirEntry` the panel renders.
 *
 * The disk key is a `quran/<edition>/S:A` verse key; the entry's own key is the
 * `tafsir/<source>/S:A` commentary key, built through the grammar from the
 * source id so a bad id is caught here, not on screen. Returns null when the
 * disk key is not a parseable ayah key — a corrupt row is dropped, not fatal.
 */
export function adaptEntry(raw: RawEntry, source: TafsirSource): TafsirEntry | null {
  const ayah = parseAyahKey(raw.key);
  if (!ayah) return null;

  const commentary: TafsirBlock[] = [];
  for (const group of raw.commentary ?? []) {
    const lemma = lemmaTuple(group.lemma);
    for (const block of group.blocks ?? []) {
      if (typeof block.text !== "string" || block.text.length === 0) continue;
      const b: TafsirBlock = {
        text: block.text,
        ...(typeof block.channel === "string" ? { channel: block.channel } : {}),
        ...(lemma ? { lemma } : {}),
      };
      commentary.push(b);
    }
  }

  const translation = translationText(raw.translation);
  const refs: string[] = [];
  for (const ref of raw.refs ?? []) {
    const key = typeof ref === "string" ? ref : ref.key;
    if (typeof key === "string" && key.length > 0) refs.push(key);
  }

  return {
    key: tafsirKeyFor(source, ayah.surah, ayah.ayah),
    refs,
    ...(translation !== undefined ? { translation } : {}),
    ...(commentary.length > 0 ? { commentary } : {}),
  };
}

function translationText(t: RawEntry["translation"]): string | undefined {
  if (typeof t === "string") return t.length > 0 ? t : undefined;
  if (t && typeof t === "object" && typeof t.text === "string" && t.text.length > 0) return t.text;
  return undefined;
}

function lemmaTuple(lemma: RawLemma | undefined): readonly [number, number] | undefined {
  if (!lemma) return undefined;
  const a = lemma[0];
  const z = lemma[1];
  if (typeof a !== "number" || typeof z !== "number") return undefined;
  return [a, z];
}

/**
 * The `TafsirSource` a manifest describes. `id` is the folder's declared source
 * (`study-quran`); it may not carry a slash — the key grammar reserves that —
 * so an id with one is rejected before anything is written.
 */
function sourceOf(manifest: RawManifest): TafsirSource | null {
  const id = manifest.source;
  if (typeof id !== "string" || id.length === 0 || id.includes("/")) return null;
  if (typeof manifest.edition !== "string" || manifest.edition.length === 0) return null;
  return {
    id,
    label: typeof manifest.title === "string" && manifest.title.length > 0 ? manifest.title : id,
    license: typeof manifest.license === "string" ? manifest.license : "private",
    edition: manifest.edition,
  };
}

/**
 * Store a parsed bundle and register its provider. Overwrites any edition
 * already held under the same source id (a re-import of a corrected folder).
 * The whole write is one transaction: a failure part-way leaves the previous
 * edition intact rather than a half-replaced one.
 */
export async function importTafsirBundle(bundle: ParsedBundle): Promise<ImportResult> {
  const source = sourceOf(bundle.manifest);
  if (!source) {
    return { ok: false, sourceId: "", surahs: [], entries: 0, error: "manifest has no valid source or edition" };
  }
  if (!tafsirStorageSupported()) {
    return { ok: false, sourceId: source.id, surahs: [], entries: 0, error: "this browser cannot store a side-loaded edition" };
  }

  const surahRecords: SurahRecord[] = [];
  let entryCount = 0;
  for (const [surah, file] of [...bundle.surahs].sort((a, b) => a[0] - b[0])) {
    const entries: TafsirEntry[] = [];
    for (const raw of file.entries ?? []) {
      const adapted = adaptEntry(raw, source);
      if (adapted) entries.push(adapted);
    }
    entryCount += entries.length;
    surahRecords.push({ id: surahRecordId(source.id, surah), kind: "surah", sourceId: source.id, surah, entries });
  }
  const surahs = surahRecords.map((r) => r.surah);
  if (surahs.length === 0) {
    return { ok: false, sourceId: source.id, surahs: [], entries: 0, error: "no surahs found in the folder" };
  }

  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    // Drop any prior edition under this id first, so a smaller re-import cannot
    // leave orphaned surahs from the larger one it replaces.
    await deleteSource(db, source.id);
    const tx = db.transaction([STORE], "readwrite");
    const store = tx.objectStore(STORE);
    const manifest: ManifestRecord = { id: source.id, kind: "manifest", source, surahs };
    store.put(manifest);
    for (const rec of surahRecords) store.put(rec);
    await done(tx);
  } catch {
    return { ok: false, sourceId: source.id, surahs: [], entries: 0, error: "the browser refused to store the edition" };
  } finally {
    db?.close();
  }

  registerTafsirProvider(makeProvider(source, new Set(surahs)));
  return { ok: true, sourceId: source.id, surahs, entries: entryCount };
}

/** A provider backed by the store: `has` reads the in-memory present-set; `load`
 * reads one surah record on demand and returns `[]` — never throws — for an
 * absent surah or an unreadable store. */
function makeProvider(source: TafsirSource, present: ReadonlySet<number>): TafsirProvider {
  return {
    source,
    has: (surah) => present.has(surah),
    load: async (surah) => {
      if (!present.has(surah)) return [];
      if (!tafsirStorageSupported()) return [];
      let db: IDBDatabase | null = null;
      try {
        db = await openDb();
        const tx = db.transaction([STORE], "readonly");
        const rec = await request<SurahRecord | undefined>(
          tx.objectStore(STORE).get(surahRecordId(source.id, surah)),
        );
        await done(tx);
        return rec?.entries ?? [];
      } catch {
        return [];
      } finally {
        db?.close();
      }
    },
  };
}

async function deleteSource(db: IDBDatabase, sourceId: string): Promise<void> {
  const tx = db.transaction([STORE], "readwrite");
  const store = tx.objectStore(STORE);
  const ids = await request<IDBValidKey[]>(store.getAllKeys());
  for (const id of ids) {
    if (id === sourceId || (typeof id === "string" && id.startsWith(`${sourceId}/`))) store.delete(id);
  }
  await done(tx);
}

/**
 * Re-register a provider for every edition the store still holds. Called once at
 * startup: reads only the manifest records (not the entries), so restoring a
 * fully-loaded book costs one small read per source, not the whole corpus.
 * Returns the source ids restored.
 */
export async function restoreTafsirProviders(): Promise<string[]> {
  if (!tafsirStorageSupported()) return [];
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const tx = db.transaction([STORE], "readonly");
    const all = await request<(ManifestRecord | SurahRecord)[]>(tx.objectStore(STORE).getAll());
    await done(tx);
    const restored: string[] = [];
    for (const rec of all) {
      if (rec.kind !== "manifest") continue;
      registerTafsirProvider(makeProvider(rec.source, new Set(rec.surahs)));
      restored.push(rec.source.id);
    }
    return restored;
  } catch {
    return [];
  } finally {
    db?.close();
  }
}

/** Forget a side-loaded edition: unregister its provider and delete its records.
 * A reader removing a book they no longer want on this device. */
export async function removeTafsirBundle(sourceId: string): Promise<void> {
  unregisterTafsirProvider(sourceId);
  if (!tafsirStorageSupported()) return;
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    await deleteSource(db, sourceId);
  } catch {
    // The caller asked for this edition to be gone; if we could not even open
    // the store, it is gone in any sense they can observe.
  } finally {
    db?.close();
  }
}

/**
 * Parse a folder of files into a `ParsedBundle`. Takes name/text pairs rather
 * than DOM `File`s so it is testable without a browser; the browser caller reads
 * each `File.text()` and hands the pairs in. `manifest.json` names each surah's
 * file, and only those files are read — a stray file in the folder is ignored.
 * Returns null when the manifest is missing or unparseable.
 */
export function parseBundleFiles(files: readonly { name: string; text: string }[]): ParsedBundle | null {
  const byBasename = new Map<string, string>();
  for (const f of files) byBasename.set(basename(f.name), f.text);

  const manifestText = byBasename.get("manifest.json");
  if (manifestText === undefined) return null;
  let manifest: RawManifest;
  try {
    manifest = JSON.parse(manifestText) as RawManifest;
  } catch {
    return null;
  }
  if (!manifest || typeof manifest !== "object" || !manifest.surahs) return null;

  const surahs = new Map<number, RawSurahFile>();
  for (const [surahStr, meta] of Object.entries(manifest.surahs)) {
    const surah = Number(surahStr);
    if (!Number.isInteger(surah)) continue;
    const text = byBasename.get(basename(meta.file));
    if (text === undefined) continue;
    try {
      surahs.set(surah, JSON.parse(text) as RawSurahFile);
    } catch {
      // A corrupt surah file is skipped; the rest of the book still imports.
    }
  }
  return { manifest, surahs };
}

function basename(path: string): string {
  const cut = path.lastIndexOf("/");
  return cut === -1 ? path : path.slice(cut + 1);
}
