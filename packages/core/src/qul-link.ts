/**
 * Outbound deep-links to the Quranic Universal Library (qul.tarteel.ai).
 *
 * The app measures its own numbers against that library and links back to it,
 * carrying none of its bytes — the `qul-reliance` decision. This module is the
 * "links back to it" half: a per-verse reference page a reader can open, built
 * from the verse's own address and nothing downloaded.
 *
 * The library addresses a verse by its ABSOLUTE ordinal in the mushaf — the
 * running count of ayahs from the very start, 1..6236 — not by `surah:ayah`.
 * `toAbsoluteAyah` already owns that ordinal (it is a property of the Hafs text,
 * not of any layout), so the URL is derivable with no new data:
 *
 *   1:1 → /cms/verses/1        (the first ayah overall)
 *   2:1 → /cms/verses/8        (Al-Fatiha has 7 ayahs, so 2:1 is the 8th)
 *
 * No verse text ever rides in the URL — only the ordinal — so a deep-link
 * discloses which verse a reader is looking at and nothing more.
 */

import { parseAyahKey } from "./keys.js";
import { toAbsoluteAyah } from "./quran-meta.js";

/** The library's per-verse reference page, without the ordinal. */
export const QUL_VERSE_BASE = "https://qul.tarteel.ai/cms/verses";

/**
 * The library's reference page for `surah:ayah`. Throws `RangeError` on an
 * out-of-range surah or ayah (via `toAbsoluteAyah`), so a bad address fails
 * loudly here rather than minting a link to a verse that does not exist.
 */
export function qulVerseUrl(surah: number, ayah: number): string {
  return `${QUL_VERSE_BASE}/${toAbsoluteAyah(surah, ayah)}`;
}

/**
 * The same, from a canonical ayah key (`quran/<edition>/<surah>:<ayah>`). Any
 * `#w…` word anchor is ignored — the library pages a verse, not a word. Returns
 * `null` for a key this project cannot parse or address, so a caller can offer
 * the link only when it is real; it never throws.
 */
export function qulVerseUrlFromKey(key: string): string | null {
  const hash = key.indexOf("#");
  const bare = hash === -1 ? key : key.slice(0, hash);
  const parsed = parseAyahKey(bare);
  if (!parsed) return null;
  try {
    return qulVerseUrl(parsed.surah, parsed.ayah);
  } catch {
    return null;
  }
}
