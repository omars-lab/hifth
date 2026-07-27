/**
 * The jumper's query language (Loop 6a) — pure, DOM-free, edition-agnostic.
 *
 * One text field has to answer three different questions a hafiz asks out loud:
 * "البقرة", "الجزء التاسع", "٢:٢٥٥". Rather than three modes with a segmented
 * control, the field parses whatever was typed and offers every reading of it,
 * best first. The UI only renders and formats — ranking, validation and the
 * surah/juz tables all live here so they can be tested without a browser.
 *
 * The 114 surah names are *not* here: they are presentation (L3 owns the name
 * table in `apps/web/src/format.ts`), so the caller injects them, exactly as the
 * highlighter takes an injected `labelFor`.
 */

import { AYAH_COUNTS, JUZ_STARTS, ayahCount } from "./quran-meta.js";

/** What a query resolved to. Every target lands on a real `surah:ayah`. */
export interface JumpTarget {
  /** How the target was named — drives the row's wording, not the landing. */
  readonly kind: "surah" | "juz" | "ayah";
  readonly surah: number;
  readonly ayah: number;
  /** Present on `juz` targets: the juz number the query asked for. */
  readonly juz?: number;
}

/** How many candidates the jumper offers at once (a thumb-sized list). */
export const MAX_JUMP_RESULTS = 8;

// Harakat, the superscript alef, and tatweel: decoration over the skeleton a
// typist actually produces. Stripped on both sides before matching.
const TASHKEEL = /[ً-ْٰـ]/g;
// Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹) digits.
const ARABIC_DIGITS = /[٠-٩۰-۹]/g;

/** Rewrite Arabic-Indic and Persian digits to ASCII so one regex can read both. */
export function toWesternDigits(s: string): string {
  return s.replace(ARABIC_DIGITS, (d) => {
    const c = d.codePointAt(0)!;
    return String(c >= 0x06f0 ? c - 0x06f0 : c - 0x0660);
  });
}

/**
 * Fold an Arabic string to its matching skeleton: no tashkeel, one alef, one
 * ya, one ha. A hafiz typing on a phone keyboard writes "الاعراف" or "الأعراف"
 * for the same surah, and neither is a spelling mistake worth punishing.
 */
export function normalizeArabic(s: string): string {
  return s
    .normalize("NFKC")
    .replace(TASHKEEL, "")
    .replace(/[أإآٱ]/g, "ا") // أ إ آ ٱ → ا
    .replace(/ى/g, "ي") // ى → ي
    .replace(/ئ/g, "ي") // ئ → ي
    .replace(/ؤ/g, "و") // ؤ → و
    .replace(/ة/g, "ه") // ة → ه
    .replace(/\s+/g, " ")
    .trim();
}

/** Drop a leading definite article, so "بقرة" finds "البقرة". */
function stripAl(s: string): string {
  return s.startsWith("ال") ? s.slice(2) : s;
}

/** A valid `surah:ayah` pair, or null. */
function ayahTarget(surah: number, ayah: number): JumpTarget | null {
  if (surah < 1 || surah > 114) return null;
  if (ayah < 1 || ayah > AYAH_COUNTS[surah - 1]!) return null;
  return { kind: "ayah", surah, ayah };
}

/** The first ayah of a juz (1..30), or null. */
function juzTarget(juz: number): JumpTarget | null {
  const start = JUZ_STARTS[juz - 1];
  if (!start) return null;
  return { kind: "juz", surah: start[0], ayah: start[1], juz };
}

/** The head of a surah (1..114), or null. */
function surahTarget(surah: number): JumpTarget | null {
  if (surah < 1 || surah > 114) return null;
  return { kind: "surah", surah, ayah: 1 };
}

// Prefixed forms, so "ج٩" and "جزء ٩" both mean the ninth juz and nothing else.
const JUZ_PREFIX = /^(?:جزء|ج|juz|j)\s*(\d+)$/i;
const SURAH_PREFIX = /^(?:سورة|سوره|س|surah|sura|s)\s*(\d+)$/i;
// "2:255", "2 255", "2/255", "البقرة 255" — the separator is whatever came to hand.
const PAIR = /^(.*?)\s*[:：/\-.\s]\s*(\d+)$/;

/**
 * Rank surahs by how a name matches: exact skeleton first, then prefix, then
 * substring, each group in mushaf order. A hafiz typing "الن" wants النساء
 * before المنافقون — the surah whose *name starts* with what was typed.
 */
function matchNames(query: string, names: readonly string[]): number[] {
  const q = stripAl(normalizeArabic(query));
  if (q.length === 0) return [];
  const exact: number[] = [];
  const prefix: number[] = [];
  const infix: number[] = [];
  names.forEach((raw, i) => {
    const name = stripAl(normalizeArabic(raw));
    if (name === q) exact.push(i + 1);
    else if (name.startsWith(q)) prefix.push(i + 1);
    else if (name.includes(q)) infix.push(i + 1);
  });
  return [...exact, ...prefix, ...infix];
}

/** Append `target` unless an identical one is already in the list. */
function push(out: JumpTarget[], target: JumpTarget | null): void {
  if (!target) return;
  if (out.some((t) => t.kind === target.kind && t.surah === target.surah && t.ayah === target.ayah)) {
    return;
  }
  out.push(target);
}

/**
 * Parse a jumper query into landing candidates, best first.
 *
 * The orderings are opinionated because the ambiguity is real:
 * - a bare number is **a surah before a juz** (there are 114 surahs and 30 juz;
 *   "٣" said aloud is far more often آل عمران than the third juz), but the juz
 *   reading is always offered too rather than guessed away;
 * - `S:A` is unambiguous, and an out-of-range ayah yields nothing rather than
 *   being clamped — silently landing on a different ayah than the one asked for
 *   is the one failure a navigation instrument may not have;
 * - a name plus a number ("البقرة ٢٥٥") is that surah's ayah, then the surah head.
 */
export function parseJump(
  query: string,
  names: readonly string[],
  limit: number = MAX_JUMP_RESULTS,
): JumpTarget[] {
  const q = toWesternDigits(query).replace(/\s+/g, " ").trim();
  const out: JumpTarget[] = [];
  if (q.length === 0) return out;

  const juzPrefix = JUZ_PREFIX.exec(q);
  if (juzPrefix) {
    push(out, juzTarget(Number(juzPrefix[1])));
    return out.slice(0, limit);
  }

  const surahPrefix = SURAH_PREFIX.exec(q);
  if (surahPrefix) {
    push(out, surahTarget(Number(surahPrefix[1])));
    return out.slice(0, limit);
  }

  const pair = PAIR.exec(q);
  if (pair) {
    const [, head, ayahStr] = pair;
    const ayah = Number(ayahStr);
    if (/^\d+$/.test(head!)) {
      push(out, ayahTarget(Number(head), ayah));
    } else {
      // "<name> <n>" — that surah's ayah n, then the surah itself as a fallback
      // for a mistyped ayah number (the head is still a real destination).
      for (const surah of matchNames(head!, names)) {
        push(out, ayahTarget(surah, ayah));
        push(out, surahTarget(surah));
        if (out.length >= limit) break;
      }
    }
    if (out.length > 0) return out.slice(0, limit);
  }

  if (/^\d+$/.test(q)) {
    const n = Number(q);
    push(out, surahTarget(n));
    push(out, juzTarget(n));
    return out.slice(0, limit);
  }

  for (const surah of matchNames(q, names)) {
    push(out, surahTarget(surah));
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}

/** Ayah count of the target's surah — the jumper shows it as a range hint. */
export function targetAyahCount(target: JumpTarget): number {
  return ayahCount(target.surah);
}
