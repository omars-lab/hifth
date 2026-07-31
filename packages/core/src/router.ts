/**
 * Router (spec §7) — the anchor-link grammar as a pure, framework-free codec.
 *
 * Sharing a view and cold-opening a teacher link are the *same* operation as a
 * live hop, run backwards: `serializeState` turns the app's current view into a
 * hash string, `parseHash` turns a hash string back into that view. There is no
 * separate deep-link path to drift from the live one — App feeds the parsed
 * state through the same `navigateTo`/`select` calls a tap would.
 *
 * Grammar (spec §7):
 *   #/<edition>/<surah>:<ayah>                 select + navigate
 *   #/<edition>/<surah>:<ayah>?w=3-7           word-span pulse
 *   #/<edition>/2:47-2:48                       highlighted ayah range
 *   #/<edition>/2:255?w=3-7&skin=tajweed        with skin
 *   #/<edition>/p7?field=tan                    on a different field
 *   #/<edition>/2:123?via=2:48                   hop context (breadcrumb)
 *   #/<edition>/2:123?trail=2:40,2:47,2:122      full hop chain
 *   #/<edition>/p7                              a bare page (no selection)
 *
 * DOM-free by construction: it speaks in canonical keys and plain records, never
 * touches `location`. L3 owns reading/writing `location.hash`; this owns the
 * string ↔ state mapping and its round-trip guarantee.
 */

import { isFieldId, type FieldId } from "./field.js";
import type { EditionId } from "./types.js";

/** A resolved (or resolvable) app view — what a link encodes and restores. */
export interface AppState {
  readonly edition: EditionId;
  /**
   * The primary target. Either a single ayah `{surah, ayah}` or an inclusive
   * ayah range `{surah, ayah, toAyah}` (same surah — spec §7 `2:47-2:48`).
   * `null` means "a bare page with no selection" (`#/…/p7`).
   */
  readonly select: AyahRef | AyahRange | null;
  /** A bare page, used only when `select` is null (the `p<N>` form). */
  readonly page?: number;
  /** Word span to pulse within the selection (spec §7 `?w=3-7`). Inclusive. */
  readonly word?: readonly [number, number];
  /** Runtime skin (spec §8). Absent = plain. */
  readonly skin?: "tajweed";
  /**
   * The surface the mus'haf lies on (`?field=`). Absent = `DEFAULT_FIELD`.
   *
   * The one parameter here that does not describe the *view*, and the one the
   * codec is deliberately lenient about — see `field.ts` and the failure-mode
   * column in `docs/query-params.md`.
   */
  readonly field?: FieldId;
  /** Breadcrumb origin (spec §7 `?via=`). A single hop's source ayah. */
  readonly via?: AyahRef;
  /** Full hop chain (spec §7 `?trail=`). Oldest → newest, excludes `select`. */
  readonly trail?: readonly AyahRef[];
}

export interface AyahRef {
  readonly surah: number;
  readonly ayah: number;
}

export interface AyahRange extends AyahRef {
  /** Inclusive end ayah in the same surah; `toAyah >= ayah`. */
  readonly toAyah: number;
}

function isRange(sel: AyahRef | AyahRange): sel is AyahRange {
  return (sel as AyahRange).toAyah !== undefined;
}

/** `2:48` → {surah:2, ayah:48}. Rejects non-positive / non-integer parts. */
function parseAyahRef(token: string): AyahRef | null {
  const m = /^(\d+):(\d+)$/.exec(token);
  if (!m) return null;
  const surah = Number(m[1]);
  const ayah = Number(m[2]);
  if (surah < 1 || surah > 114 || ayah < 1) return null;
  return { surah, ayah };
}

/** `3-7` → [3,7]; single `5` → [5,5]. Inclusive, from ≤ to, both ≥ 1. */
function parseSpan(token: string): readonly [number, number] | null {
  const m = /^(\d+)(?:-(\d+))?$/.exec(token);
  if (!m) return null;
  const from = Number(m[1]);
  const to = m[2] === undefined ? from : Number(m[2]);
  if (from < 1 || to < from) return null;
  return [from, to];
}

function spanToString(span: readonly [number, number]): string {
  return span[0] === span[1] ? `${span[0]}` : `${span[0]}-${span[1]}`;
}

function refToString(ref: AyahRef): string {
  return `${ref.surah}:${ref.ayah}`;
}

/**
 * Encode an app view to its anchor hash (leading `#/…`). The inverse of
 * `parseHash`: `parseHash(serializeState(s))` deep-equals `s` for any valid `s`.
 * Query params are emitted in a fixed order (w, skin, field, via, trail) so a given
 * state has exactly one serialization — links are stable and diff-friendly.
 */
export function serializeState(state: AppState): string {
  const { edition, select } = state;
  let path: string;

  if (select === null) {
    const page = state.page ?? 1;
    path = `#/${edition}/p${page}`;
  } else if (isRange(select)) {
    // The spec's literal range form repeats the surah on both endpoints.
    path = `#/${edition}/${select.surah}:${select.ayah}-${select.surah}:${select.toAyah}`;
  } else {
    path = `#/${edition}/${refToString(select)}`;
  }

  const q: string[] = [];
  if (state.word) q.push(`w=${spanToString(state.word)}`);
  if (state.skin) q.push(`skin=${state.skin}`);
  if (state.field) q.push(`field=${state.field}`);
  if (state.via) q.push(`via=${refToString(state.via)}`);
  if (state.trail && state.trail.length > 0) {
    q.push(`trail=${state.trail.map(refToString).join(",")}`);
  }

  return q.length ? `${path}?${q.join("&")}` : path;
}

/**
 * Decode an anchor hash to an app view, or `null` if it is not a well-formed
 * spec-§7 link. Tolerant of a missing leading `#` and of an empty/`#` hash
 * (returns `null` — "no deep link, use defaults"). Unknown query keys are
 * ignored; malformed *known* keys (e.g. `w=abc`) reject the whole hash so a
 * corrupt link never restores a half-wrong view.
 */
export function parseHash(hash: string): AppState | null {
  let h = hash.trim();
  if (h.startsWith("#")) h = h.slice(1);
  if (h === "" || h === "/") return null;
  if (!h.startsWith("/")) return null;
  h = h.slice(1);

  const qIndex = h.indexOf("?");
  const pathPart = qIndex === -1 ? h : h.slice(0, qIndex);
  const queryPart = qIndex === -1 ? "" : h.slice(qIndex + 1);

  // path = <edition>/<target>
  const slash = pathPart.indexOf("/");
  if (slash === -1) return null;
  const edition = pathPart.slice(0, slash) as EditionId;
  const target = pathPart.slice(slash + 1);
  if (edition === "" || target === "") return null;

  let select: AyahRef | AyahRange | null = null;
  let page: number | undefined;

  if (target.startsWith("p")) {
    const n = Number(target.slice(1));
    if (!Number.isInteger(n) || n < 1) return null;
    page = n;
  } else if (target.includes("-")) {
    // Ranges come in the spec's literal form (`2:47-2:48`) and in the compact
    // tail form (`2:47-48`) older links used; both mean the same inclusive span,
    // and both serialize back out as the literal form. Ranges never cross surahs.
    const dash = target.indexOf("-");
    const ref = parseAyahRef(target.slice(0, dash));
    if (!ref) return null;
    const tail = target.slice(dash + 1);
    let toAyah: number;
    if (tail.includes(":")) {
      const end = parseAyahRef(tail);
      if (!end || end.surah !== ref.surah) return null;
      toAyah = end.ayah;
    } else {
      toAyah = Number(tail);
    }
    if (!Number.isInteger(toAyah) || toAyah < ref.ayah) return null;
    select = { ...ref, toAyah };
  } else {
    select = parseAyahRef(target);
    if (!select) return null;
  }

  const params = new Map<string, string>();
  if (queryPart) {
    for (const pair of queryPart.split("&")) {
      if (!pair) continue;
      const eq = pair.indexOf("=");
      const k = eq === -1 ? pair : pair.slice(0, eq);
      const v = eq === -1 ? "" : pair.slice(eq + 1);
      params.set(k, v);
    }
  }

  const out: {
    edition: EditionId;
    select: AyahRef | AyahRange | null;
    page?: number;
    word?: readonly [number, number];
    skin?: "tajweed";
    field?: FieldId;
    via?: AyahRef;
    trail?: readonly AyahRef[];
  } = { edition, select };
  if (page !== undefined) out.page = page;

  if (params.has("w")) {
    const span = parseSpan(params.get("w")!);
    if (!span) return null;
    out.word = span;
  }
  if (params.has("skin")) {
    if (params.get("skin") !== "tajweed") return null;
    out.skin = "tajweed";
  }
  // The one key that does not reject. `w`, `skin`, `via` and `trail` all say
  // *what you are looking at*, and half-restoring those is a lie about where the
  // reader is; `field` says what the desk under it is painted. A link mangled in
  // a chat client should still open the ayah, so an unreadable value is dropped
  // and the default stands. `docs/query-params.md` states this per key.
  if (params.has("field")) {
    const raw = params.get("field")!;
    if (isFieldId(raw)) out.field = raw;
  }
  if (params.has("via")) {
    const via = parseAyahRef(params.get("via")!);
    if (!via) return null;
    out.via = via;
  }
  if (params.has("trail")) {
    const raw = params.get("trail")!;
    if (raw === "") return null;
    const refs: AyahRef[] = [];
    for (const tok of raw.split(",")) {
      const r = parseAyahRef(tok);
      if (!r) return null;
      refs.push(r);
    }
    out.trail = refs;
  }

  return out;
}

/** Build the canonical key for an ayah ref under an edition (spec §1). */
export function refToKey(edition: EditionId, ref: AyahRef): string {
  return `quran/${edition}/${ref.surah}:${ref.ayah}`;
}

/** Parse a canonical ayah key back to {surah, ayah}, or null. */
export function keyToRef(key: string): AyahRef | null {
  const m = /\/(\d+):(\d+)$/.exec(key);
  if (!m) return null;
  return { surah: Number(m[1]), ayah: Number(m[2]) };
}
