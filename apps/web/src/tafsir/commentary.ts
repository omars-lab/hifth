/**
 * Runtime glue between a `TafsirProvider`'s entries and the commentary sheet.
 *
 * Two jobs, both pure (no DOM, no I/O, no React):
 *
 *   - **index** a surah's entries by their `"S:A"` so the sheet can find the one
 *     for the focused ayah in O(1);
 *   - **turn a note's cross-references into `tafsir-ref` edges** at *runtime*, so
 *     a leap to a referenced ayah rides the same hop path as every other edge.
 *     These edges are never written to a shipped shard (the shards carry
 *     `ext: []` for the reserved `tafsir-ref` type — decision `tafsir-provider`);
 *     they exist only while a provider is loaded and an ayah is focused.
 */
import { type Edge, type Resolver, type TafsirEntry, parseAyahKey, parseTafsirKey } from "@hifth/core";

/** `"2:255"` — the surah:ayah a commentary sheet looks an entry up by. */
function surahAyah(surah: number, ayah: number): string {
  return `${surah}:${ayah}`;
}

/**
 * Index a surah's entries by `"S:A"`. Entries whose key is not a well-formed
 * `tafsir/<name>/S:A` are dropped — a provider that hands back a malformed key
 * should show nothing, not throw.
 */
export function indexEntries(entries: readonly TafsirEntry[]): Map<string, TafsirEntry> {
  const byAyah = new Map<string, TafsirEntry>();
  for (const entry of entries) {
    const parsed = parseTafsirKey(entry.key);
    if (parsed) byAyah.set(surahAyah(parsed.surah, parsed.ayah), entry);
  }
  return byAyah;
}

/**
 * The entry for a focused ayah key (`quran/<edition>/S:A`) out of an indexed
 * surah, or undefined when the ayah has no commentary.
 */
export function entryForAyah(
  byAyah: Map<string, TafsirEntry>,
  ayahKey: string,
): TafsirEntry | undefined {
  const ref = parseAyahKey(ayahKey);
  return ref ? byAyah.get(surahAyah(ref.surah, ref.ayah)) : undefined;
}

/**
 * Build the `tafsir-ref` edges for one entry's cross-references, from the
 * focused ayah (`fromKey`) outward. Each ref is a canonical ayah key; its page
 * and direction are resolved against the loaded edition so the row can offer a
 * real leap (or a disabled one, when the target's page is not vendored — the
 * edge is still returned with `page: 0`, and the sheet disables it via `canHop`).
 * Repeated refs collapse to the first. Runtime-only; never persisted.
 */
export function commentaryEdges(
  entry: TafsirEntry | undefined,
  fromKey: string,
  resolver: Resolver,
): Edge[] {
  if (!entry) return [];
  const from = parseAyahKey(fromKey);
  if (!from) return [];
  const fromPage = resolver.resolve(fromKey)?.page ?? null;

  const edges: Edge[] = [];
  const seen = new Set<string>();
  for (const ref of entry.refs) {
    if (seen.has(ref)) continue;
    const to = parseAyahKey(ref);
    if (!to) continue;
    seen.add(ref);
    const toPage = resolver.resolve(ref)?.page ?? null;
    const dPage = fromPage !== null && toPage !== null ? toPage - fromPage : 0;
    edges.push({
      type: "tafsir-ref",
      to: ref,
      page: toPage ?? 0,
      dir: { dSurah: to.surah - from.surah, dPage },
    });
  }
  return edges;
}
