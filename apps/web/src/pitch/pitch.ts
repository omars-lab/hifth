/**
 * The private pitch build (see CLAUDE.md → "What we are building right now").
 *
 * Everything in this folder exists to show, in a room, to the team behind The
 * Study Quran what a real collaboration would feel like: their commentary and
 * cross-references, live inside the mus'haf, on al-Fātiḥah done beautifully.
 *
 * It is guarded end to end by `PITCH`, a build-time constant. In every public
 * build VITE_PITCH is unset, so `PITCH` is the literal `false`, every call below
 * sits in dead code, and the bundler drops this module — and the held-copy JSON
 * it would fetch is gitignored and never deployed anyway. The public site and
 * its held-copy gates never see any of it.
 */
import {
  tafsirKeyFor,
  type AdjacencyShard,
  type AyahAdjacency,
  type Edge,
  type TafsirEntry,
  type TafsirProvider,
  type TafsirSource,
} from "@hifth/core";
import type { CommentaryIntro } from "../tafsir/commentary";

/** Injected by Vite as a literal — see `define` in `vite.config.ts`. */
declare const __PITCH__: boolean;

/** True only in the private pitch build. A literal, so a public build drops the rest. */
export const PITCH: boolean = typeof __PITCH__ === "boolean" && __PITCH__;

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

/**
 * The book, as a commentary source. Its notes reach the drawer through the same
 * shape every other source does (decision `tafsir-provider`), so the pitch has
 * one drawer and one ✎, and a second source is a second provider, not a second
 * drawer.
 */
export const STUDY_QURAN: TafsirSource = {
  id: "study-quran",
  label: "The Study Quran",
  license: "Seyyed Hossein Nasr, editor-in-chief (HarperOne, 2015)",
  edition: "hafs-kfqc",
  lang: "en",
};

const BASE = import.meta.env.BASE_URL;

const fetched = new Map<number, Promise<PitchSurah | null>>();

/**
 * Fetch a surah's private pitch payload, or null if there is none / not pitch.
 * Each surah is asked for once: the roads and the notes both come from the same
 * file, and the two callers share the one request.
 */
export function loadPitchSurah(surah: number): Promise<PitchSurah | null> {
  if (!PITCH) return Promise.resolve(null);
  let pending = fetched.get(surah);
  if (!pending) {
    pending = fetch(`${BASE}assets/private/study-quran/${surah}.json`)
      .then((res) => (res.ok ? (res.json() as Promise<PitchSurah>) : null))
      .catch(() => null); // quiet on miss, like every other loader
    fetched.set(surah, pending);
  }
  return pending;
}

/** A surah's notes as the shared shape: one entry per verse, under the book's name. */
export function pitchEntries(surah: PitchSurah): TafsirEntry[] {
  return Object.values(surah.verses).flatMap((v) => {
    const ref = /^(\d+):(\d+)$/.exec(v.ref);
    if (!ref) return [];
    return [
      {
        key: tafsirKeyFor(STUDY_QURAN, Number(ref[1]), Number(ref[2])),
        translation: v.translation,
        commentary: v.commentary.map((text) => ({ text })),
        // The book's cross-references reach the drawer as roads, through the
        // surah's merged edges (`mergeShard`), not through the note.
        refs: [],
      },
    ];
  });
}

/** The book as a commentary source; `load` is the file loader, swapped in tests. */
export function makePitchProvider(
  load: (surah: number) => Promise<PitchSurah | null> = loadPitchSurah,
): TafsirProvider {
  return {
    source: STUDY_QURAN,
    has: (surah) => surah >= 1 && surah <= 114,
    load: async (surah) => {
      const s = await load(surah);
      return s ? pitchEntries(s) : [];
    },
  };
}

/** The mark on an edge that is one of the book's own cross-references. */
const BOOK_REF = "study-quran-xref";
const isBookRef = (e: Edge): boolean => e.src === BOOK_REF;

/** `extra` without any verse `kept` already goes to: the first line wins. */
function unseen(kept: readonly Edge[], extra: readonly Edge[]): Edge[] {
  const seen = new Set(kept.map((e) => e.to));
  return extra.filter((e) => !seen.has(e.to) && seen.add(e.to));
}

/**
 * Merge the demo's hand-picked roads into a base shard, per ayah, without
 * losing either side. The book's cross-references are left out: they are
 * linked by meaning, and everything this shard feeds (the similar-verse
 * buttons, the jump arrows, the pages kept ready) promises verses that *read*
 * alike. Mixed in, they outnumbered the look-alikes about six to one. They
 * reach the note's related list instead, through {@link withBookRefs}.
 */
export function mergeShard(
  base: AdjacencyShard | undefined,
  pitch: AdjacencyShard,
): AdjacencyShard {
  const out: Record<string, AyahAdjacency> = { ...(base ?? {}) };
  for (const [ayah, adj] of Object.entries(pitch)) {
    const own = adj.edges.filter((e) => !isBookRef(e));
    const prior = out[ayah];
    if (prior) {
      out[ayah] = { edges: [...prior.edges, ...unseen(prior.edges, own)], ext: [...prior.ext, ...adj.ext] };
    } else if (own.length > 0 || adj.ext.length > 0) {
      out[ayah] = { edges: unseen([], own), ext: adj.ext };
    }
  }
  return out;
}

/**
 * The related verses a note lists: the verse's own roads, then the book's
 * cross-references from it, each verse once. Where both name a verse, the
 * app's own line is kept (it says why the two belong together for a hafiz).
 */
export function withBookRefs(roads: readonly Edge[], pitch: AyahAdjacency | undefined): Edge[] {
  return [...roads, ...unseen(roads, (pitch?.edges ?? []).filter(isBookRef))];
}

/**
 * The surah's introduction to lead a verse's note with, or null. Only a link's
 * `?open=context` asks for it; otherwise the introduction lives behind the ⓘ
 * badge beside the surah's name (owner, 2026-10-04), not on verse 1's note.
 */
export function introFor(
  surah: PitchSurah | null,
  selectedKey: string | null,
  withContext = false,
): CommentaryIntro | null {
  if (!surah || !selectedKey || surah.intro.length === 0) return null;
  const ref = /:(\d+)$/.exec(selectedKey);
  if (!ref) return null;
  if (!withContext) return null;
  return { title: surah.title, paragraphs: surah.intro };
}
