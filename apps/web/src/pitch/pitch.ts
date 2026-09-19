/**
 * The private pitch build (see CLAUDE.md → "What we are building right now").
 *
 * Everything in this folder exists to show, in a room, to the team behind The
 * Study Quran what a real collaboration would feel like: their commentary and
 * cross-references, live inside the mus'haf, on al-Fātiḥah done beautifully.
 *
 * It is guarded end to end by `PITCH`, a build-time constant. In every public
 * build `import.meta.env.VITE_PITCH` is undefined, so `PITCH` is `false`, every
 * call below sits in dead code, and the bundler drops this module — and the
 * held-copy JSON it would fetch is gitignored and never deployed anyway. The
 * public site and its held-copy gates never see any of it.
 */
import type { AdjacencyShard, AyahAdjacency } from "@hifth/core";

/** True only in the private pitch build. Statically replaced by Vite. */
export const PITCH = Boolean(import.meta.env.VITE_PITCH);

/** One verse's held content, as captured from The Study Quran. */
export interface PitchVerse {
  readonly ref: string; // "1:1"
  readonly key: string; // "quran/hafs-kfqc/1:1"
  readonly translation: string;
  readonly commentary: readonly string[];
}

/** A whole surah's private pitch payload: held reading + the demo's roads. */
export interface PitchSurah {
  readonly surah: number;
  readonly title: string;
  readonly intro: readonly string[];
  readonly verses: Readonly<Record<string, PitchVerse>>;
  readonly shard: AdjacencyShard;
}

/** What the commentary sheet needs for one selected verse. */
export interface PitchCommentary {
  readonly title: string; // surah title, shown once (on the surah's first verse)
  readonly intro: readonly string[]; // surah intro, likewise
  readonly verse: PitchVerse;
  readonly showIntro: boolean; // true on the surah's opening verse
}

const BASE = import.meta.env.BASE_URL;

/** Fetch a surah's private pitch payload, or null if there is none / not pitch. */
export async function loadPitchSurah(surah: number): Promise<PitchSurah | null> {
  if (!PITCH) return null;
  try {
    const res = await fetch(`${BASE}assets/private/study-quran/${surah}.json`);
    if (!res.ok) return null;
    return (await res.json()) as PitchSurah;
  } catch {
    return null; // quiet on miss, like every other loader
  }
}

/**
 * Merge pitch edges into a base shard, per ayah, without losing either side.
 * The base surah shard is usually empty for al-Fātiḥah, but a general merge
 * keeps this honest for any surah the pitch later covers.
 */
export function mergeShard(
  base: AdjacencyShard | undefined,
  pitch: AdjacencyShard,
): AdjacencyShard {
  const out: Record<string, AyahAdjacency> = { ...(base ?? {}) };
  for (const [ayah, adj] of Object.entries(pitch)) {
    const prior = out[ayah];
    out[ayah] = prior
      ? { edges: [...prior.edges, ...adj.edges], ext: [...prior.ext, ...adj.ext] }
      : adj;
  }
  return out;
}

/** The commentary for one selected verse, or null. */
export function commentaryFor(
  surah: PitchSurah | null,
  selectedKey: string | null,
): PitchCommentary | null {
  if (!surah || !selectedKey) return null;
  const ref = /(\d+):(\d+)$/.exec(selectedKey);
  if (!ref) return null;
  const verse = surah.verses[`${ref[1]}:${ref[2]}`];
  if (!verse) return null;
  const isFirst = Number(ref[2]) === 1;
  return {
    title: surah.title,
    intro: surah.intro,
    verse,
    showIntro: isFirst,
  };
}
