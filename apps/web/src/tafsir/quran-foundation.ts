/**
 * The open, live commentary provider — the Quran Foundation's tafsir service
 * (decisions `tafseer-source` = C and `tafsir-provider`), the second source to
 * plug into the same `@hifth/core` seam as the side-loaded Study Quran, and the
 * one that proves the seam is genuinely generic: the panel renders a note from
 * it without learning that this one arrived over the network rather than from a
 * folder in the reader's browser.
 *
 * ## It holds no text — it only knows how to ask
 *
 * Unlike the side-loaded provider (`sideload.ts`), which stores a private book's
 * bytes in IndexedDB, this provider ships nothing: it fetches each surah's tafsir
 * live and maps the reply into `TafsirEntry`s. That is exactly why it is allowed
 * to ship with the app while the Study Quran cannot — the scripture-text gate
 * forbids a committed passage, and there is none here, only a URL to ask.
 *
 * ## Configured, never hard-coded to one text
 *
 * The service serves over a hundred tafsirs, in Arabic and English, and the
 * owner has not yet picked which one is the default (decision `tafseer-source`
 * chose the *service*, not a single edition). So the choice is config: the base
 * URL and the tafsir id come from the build's env (`VITE_TAFSIR_QF_*`). With no
 * config the provider is simply not registered — like the import control in the
 * Colophon, an unwired seam shows no dead surface, it shows nothing. Wiring a
 * tafsir id is a one-line env change, not a code change, so picking the edition
 * stays a decision the owner makes, not one baked in here.
 *
 * ## Never throws, and quiet on failure
 *
 * Same contract as every provider: `load` returns `[]` — never throws — for a
 * network error, a rate-limit, an offline device, or a surah the service does
 * not answer. A missing note is then a quiet absent `✎`, never an error the app
 * has to catch. `has` is the cheap synchronous gate (every surah 1..114 is in
 * range) the UI checks before it even attempts a fetch.
 *
 * ## Cross-references
 *
 * The Study Quran export parsed "see also vv. 47" style refs into `tafsir-ref`
 * edges. A live tafsir's prose is arbitrary across a hundred editions and two
 * languages, so parsing refs from it reliably is a different, fragile problem;
 * this provider leaves `refs` empty and lets the panel show the note itself. If
 * a chosen edition later proves to carry machine-readable refs, that parse is a
 * localized addition here, not a change to the seam.
 */
import {
  registerTafsirProvider,
  tafsirKeyFor,
  type TafsirEntry,
  type TafsirProvider,
  type TafsirSource,
} from "@hifth/core";

/** The reserved source id for the live provider. Exported so the app can give a
 * side-loaded private edition precedence over this open fallback until the
 * source chooser (deferred in the `tafsir-provider` decision) is built. */
export const LIVE_TAFSIR_ID = "quran-foundation";

const SURAH_MIN = 1;
const SURAH_MAX = 114;

/** What the build must supply to turn the live provider on. Base URL and tafsir
 * id are required; the rest name the edition for the source line and carry an
 * optional auth header for the keyed tier of the service. */
export interface LiveTafsirConfig {
  /** e.g. `https://api.quran.com/api/v4` — no trailing slash needed. */
  readonly base: string;
  /** The service's tafsir resource id (which of its 100+ editions). */
  readonly tafsirId: string;
  /** Human label for the source line; falls back to the id. */
  readonly label?: string;
  /** Licence text shown beside the label; falls back to "live lookup". */
  readonly license?: string;
  /** The ayah edition its verse keys span; defaults to the app's `hafs-kfqc`. */
  readonly edition?: string;
  /** Optional bearer token for the keyed tier (never logged, never committed). */
  readonly token?: string;
}

/** One tafsir item as the service returns it (only the fields we read). The
 * text is HTML; `verse_key` is `"S:A"`. */
interface RawTafsirItem {
  readonly verse_key?: string;
  readonly text?: string;
}

interface RawTafsirReply {
  readonly tafsirs?: readonly RawTafsirItem[];
}

/** Read the live config from the build env. Returns null when the two required
 * fields are absent, which is the "provider off" signal the registrar honours. */
export function liveTafsirConfigFromEnv(env: ImportMetaEnv): LiveTafsirConfig | null {
  const base = env.VITE_TAFSIR_QF_BASE;
  const tafsirId = env.VITE_TAFSIR_QF_ID;
  if (typeof base !== "string" || base.length === 0) return null;
  if (typeof tafsirId !== "string" || tafsirId.length === 0) return null;
  return {
    base: base.replace(/\/+$/, ""),
    tafsirId,
    ...(env.VITE_TAFSIR_QF_LABEL ? { label: env.VITE_TAFSIR_QF_LABEL } : {}),
    ...(env.VITE_TAFSIR_QF_LICENSE ? { license: env.VITE_TAFSIR_QF_LICENSE } : {}),
    ...(env.VITE_TAFSIR_QF_EDITION ? { edition: env.VITE_TAFSIR_QF_EDITION } : {}),
    ...(env.VITE_TAFSIR_QF_TOKEN ? { token: env.VITE_TAFSIR_QF_TOKEN } : {}),
  };
}

function sourceOf(config: LiveTafsirConfig): TafsirSource {
  return {
    id: LIVE_TAFSIR_ID,
    label: config.label && config.label.length > 0 ? config.label : config.tafsirId,
    license: config.license && config.license.length > 0 ? config.license : "live lookup",
    edition: config.edition && config.edition.length > 0 ? config.edition : "hafs-kfqc",
  };
}

/** Strip HTML to plain text: the panel renders `block.text` as text content, so
 * a live tafsir's markup must be flattened or it would show as literal tags.
 *
 * Tags are removed first with a space so a word never fuses to its neighbour
 * across a `</p><p>` break; then the DOM decodes *every* entity — `&amp;` but
 * also `&mdash;`, `&hellip;`, numeric `&#8212;` and the rest — rather than a
 * hand-kept table that silently leaves the ones it forgot on screen (a live
 * tafsir's prose is full of them). Reading `textContent` never executes markup.
 */
export function stripHtml(html: string): string {
  const noTags = html.replace(/<[^>]*>/g, " ");
  let decoded = noTags;
  try {
    decoded = new DOMParser().parseFromString(noTags, "text/html").body.textContent ?? noTags;
  } catch {
    // No DOM (should not happen in the browser): fall back to the raw text.
  }
  return decoded
    .replace(/\s+/g, " ")
    // A tag between a word and its punctuation ("God</b>.") leaves a stray space
    // before the mark; tighten it, for Latin and Arabic punctuation both.
    .replace(/\s+([.,;:!?)\]،؛؟])/g, "$1")
    .replace(/([([])\s+/g, "$1")
    .trim();
}

/** Map one surah's reply into entries: one block of stripped commentary per
 * verse that has text, keyed through the grammar from the source id. A verse
 * with no text, or a `verse_key` for another surah, is dropped. */
function entriesFromReply(reply: RawTafsirReply, source: TafsirSource, surah: number): TafsirEntry[] {
  const entries: TafsirEntry[] = [];
  for (const item of reply.tafsirs ?? []) {
    if (typeof item.verse_key !== "string" || typeof item.text !== "string") continue;
    const [sStr, aStr] = item.verse_key.split(":");
    const s = Number(sStr);
    const a = Number(aStr);
    if (s !== surah || !Number.isInteger(a) || a < 1) continue;
    const text = stripHtml(item.text);
    if (text.length === 0) continue;
    entries.push({
      key: tafsirKeyFor(source, surah, a),
      refs: [],
      commentary: [{ text, channel: "live" }],
    });
  }
  return entries;
}

/**
 * Build a live provider over the service. `fetchImpl` is injected so tests drive
 * it without a network; production passes the global `fetch`. A tiny in-memory
 * cache keeps a surah from being refetched within a session (the app already
 * dedupes per selection, so this only helps a re-open after a provider swap).
 */
export function makeLiveTafsirProvider(
  config: LiveTafsirConfig,
  fetchImpl: typeof fetch = fetch,
): TafsirProvider {
  const source = sourceOf(config);
  const cache = new Map<number, readonly TafsirEntry[]>();

  return {
    source,
    has: (surah) => Number.isInteger(surah) && surah >= SURAH_MIN && surah <= SURAH_MAX,
    load: async (surah) => {
      if (!Number.isInteger(surah) || surah < SURAH_MIN || surah > SURAH_MAX) return [];
      const cached = cache.get(surah);
      if (cached) return cached;
      const url = `${config.base}/quran/tafsirs/${encodeURIComponent(config.tafsirId)}?chapter_number=${surah}`;
      try {
        const res = await fetchImpl(url, {
          headers: {
            Accept: "application/json",
            ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
          },
        });
        if (!res.ok) return [];
        const reply = (await res.json()) as RawTafsirReply;
        const entries = entriesFromReply(reply, source, surah);
        cache.set(surah, entries);
        return entries;
      } catch {
        return [];
      }
    },
  };
}

/**
 * Register the live provider if the build is configured for it. Returns the
 * source id registered, or null when there is no config (the provider stays
 * off). Called once at startup alongside `restoreTafsirProviders`.
 */
export function registerLiveTafsirProvider(
  env: ImportMetaEnv = import.meta.env,
  fetchImpl: typeof fetch = fetch,
): string | null {
  const config = liveTafsirConfigFromEnv(env);
  if (!config) return null;
  registerTafsirProvider(makeLiveTafsirProvider(config, fetchImpl));
  return LIVE_TAFSIR_ID;
}
