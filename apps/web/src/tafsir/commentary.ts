/**
 * Runtime glue between a `TafsirProvider`'s entries and the commentary sheet.
 *
 * Three jobs, all pure (no DOM, no I/O, no React):
 *
 *   - **index** a surah's entries by their `"S:A"` so the sheet can find the one
 *     for the focused ayah in O(1);
 *   - **turn a note's cross-references into `tafsir-ref` edges** at *runtime*, so
 *     a leap to a referenced ayah rides the same hop path as every other edge.
 *     These edges are never written to a shipped shard (the shards carry
 *     `ext: []` for the reserved `tafsir-ref` type — decision `tafsir-provider`);
 *     they exist only while a provider is loaded and an ayah is focused;
 *   - **shape one note for the drawer**, the same whichever source it came from.
 */
import {
  type Edge,
  type Resolver,
  type TafsirEntry,
  type TafsirSource,
  parseAyahKey,
  parseTafsirKey,
} from "@hifth/core";

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

/** Languages written right to left, by their first part (`ar` of `ar-EG`). */
const RIGHT_TO_LEFT = new Set(["ar", "fa", "ur", "he", "ps", "sd", "ug", "yi", "ckb", "dv"]);

/**
 * Which way a source's words read. A source that never said its language gets
 * `auto`, so the browser judges each paragraph by its first letters: right for
 * an Arabic one even in an English app, which a guess either way would get wrong
 * half the time.
 */
export function textDir(lang: string | undefined): "ltr" | "rtl" | "auto" {
  if (!lang) return "auto";
  return RIGHT_TO_LEFT.has(lang.toLowerCase().split("-")[0]!) ? "rtl" : "ltr";
}

/** A surah's introduction: a note of its own, or led into a verse's when a link asks. */
export interface CommentaryIntro {
  readonly title: string;
  readonly paragraphs: readonly string[];
}

/**
 * Everything the one commentary drawer draws for a verse. It never learns where
 * the words came from — a book held for the pitch, a live public service, a book
 * the reader loaded — only whose they are (`source`), so the heading and the
 * credit line can say so.
 */
export interface CommentaryNote {
  readonly source: TafsirSource;
  /** The verse the note is about (`quran/<edition>/S:A`). */
  readonly ayahKey: string;
  readonly translation?: string;
  readonly paragraphs: readonly string[];
  readonly intro: CommentaryIntro | null;
  /** The surah's introduction alone, opened from the ⓘ beside the surah's name. */
  readonly introOnly?: true;
}

/** A note holding only a surah's introduction, keyed to its opening verse. */
export function introNote(
  source: TafsirSource,
  openingKey: string,
  intro: CommentaryIntro,
): CommentaryNote {
  return { source, ayahKey: openingKey, paragraphs: [], intro, introOnly: true };
}

export function isIntroOnly(note: CommentaryNote): boolean {
  return note.introOnly === true;
}

/**
 * The note for a verse out of its source's entry, or null when there is nothing
 * to draw: no entry, or one whose translation and commentary are both empty (a
 * ✎ that opened onto a blank drawer would be a dead end).
 */
export function noteFor(
  entry: TafsirEntry | undefined,
  source: TafsirSource,
  ayahKey: string,
  intro: CommentaryIntro | null = null,
): CommentaryNote | null {
  if (!entry) return null;
  const paragraphs = (entry.commentary ?? []).map((b) => b.text).filter((t) => t.trim().length > 0);
  const translation = entry.translation?.trim() ? entry.translation : undefined;
  if (!translation && paragraphs.length === 0) return null;
  return { source, ayahKey, ...(translation ? { translation } : {}), paragraphs, intro };
}
