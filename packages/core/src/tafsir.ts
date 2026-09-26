/**
 * The tafsir (commentary) seam (decision `tafsir-provider`).
 *
 * A verse's commentary can come from more than one place — a live lookup from
 * an open service, or a private edition a reader owns and side-loads — and the
 * app must not care which. So a source is a `TafsirProvider` behind one
 * contract: given a surah, it answers whether it has commentary and hands back
 * one `TafsirEntry` per ayah, keyed `tafsir/<name>/S:A` (see `keys.ts`). The UI
 * asks the registry for the active provider and renders whatever shape comes
 * back; it never reaches into a provider's storage or format.
 *
 * This package holds **no data and no I/O** — no fetch, no IndexedDB, no bundle
 * parsing. A provider that loads from the network lives in the web app; a
 * provider that reads a side-loaded private edition lives there too, because the
 * bytes are the reader's, never the repo's (the scripture-text gate, and the
 * `tafseer-source` decision that keeps no copy). Core owns only the contract,
 * the key grammar, and the registry that lets them be swapped.
 */
import { formatTafsirKey, type TafsirKey } from "./keys.js";

export type { TafsirKey };
export { formatTafsirKey, parseTafsirKey } from "./keys.js";

/** Who a commentary came from, and under what terms — shown to the reader so a
 * note is never anonymous. `edition` is the ayah edition its verse spans key. */
export interface TafsirSource {
  readonly id: string;
  readonly label: string;
  readonly license: string;
  readonly edition: string;
}

/**
 * One run of commentary. `channel` records provenance the way the corpus does
 * ("ax" faithful, "ocr" diacritic-lossy) so the UI can mark a recovered line;
 * `lemma` is the ayah span the source attached the note to, when it has one.
 * Both are optional — a live service returns bare text with neither.
 */
export interface TafsirBlock {
  readonly text: string;
  readonly channel?: string;
  readonly lemma?: readonly [number, number];
}

/** A provider's answer for one ayah. `key` is the `tafsir/<name>/S:A` node key;
 * `refs` are other ayah keys the note points at (cross-references). */
export interface TafsirEntry {
  readonly key: string;
  readonly translation?: string;
  readonly commentary?: readonly TafsirBlock[];
  readonly refs: readonly string[];
}

/**
 * A commentary source behind the seam. `has` is the cheap check the UI uses
 * before offering the section; `load` returns every entry for a surah (one per
 * ayah that has commentary), which the caller indexes by key. `load` may be
 * async (a fetch, an IndexedDB read) and returns `[]` — never throws — when the
 * surah is absent, so a missing note is a quiet empty section, not an error.
 */
export interface TafsirProvider {
  readonly source: TafsirSource;
  has(surah: number): boolean;
  load(surah: number): Promise<readonly TafsirEntry[]>;
}

const providers = new Map<string, TafsirProvider>();

/** Register (or replace) a provider under its source id. A side-load registers
 * one at runtime; the open live provider registers one at startup. */
export function registerTafsirProvider(provider: TafsirProvider): void {
  providers.set(provider.source.id, provider);
}

/** The provider registered under `id`, or undefined. */
export function getTafsirProvider(id: string): TafsirProvider | undefined {
  return providers.get(id);
}

/** Every registered provider, in registration order. */
export function listTafsirProviders(): readonly TafsirProvider[] {
  return [...providers.values()];
}

/** Drop a provider (a reader removing a side-loaded edition), or all of them. */
export function unregisterTafsirProvider(id?: string): void {
  if (id === undefined) providers.clear();
  else providers.delete(id);
}

/**
 * The `tafsir/<name>/S:A` key for an entry, from the provider's own id — so a
 * provider building entries names its keys through the grammar, not by hand.
 */
export function tafsirKeyFor(source: TafsirSource, surah: number, ayah: number): string {
  return formatTafsirKey(source.id, surah, ayah);
}
