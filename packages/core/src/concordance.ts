/**
 * Editions and the concordance seam (Loop 6a, spec §1 + §7).
 *
 * Spec §1 is blunt: "Cross-edition resolution goes through a concordance table
 * (edition-A ayah ↔ edition-B ayah), **never** by assuming index equality."
 * Today exactly one edition is vendored, so nothing crosses — which is precisely
 * why the seam has to be built now, while there is no second edition to paper
 * over a mistake with. Two rules keep it honest:
 *
 * 1. **No table, no mapping.** `Concordance.map` returns null when it holds no
 *    table for the pair. It never falls back to "same numbers, probably".
 * 2. **Identity is a claim the *data* makes, not one the code assumes.** A table
 *    declares `base: "identity"` to say "these two countings agree except for
 *    the deltas listed here" — the assertion of an editor who checked, recorded
 *    in the file. `base: "explicit"` means only listed ayahs map at all. The
 *    code merely obeys whichever the table says.
 *
 * The registry below is the honest inventory the EditionPicker renders: what
 * exists, and what does not *with the actual reason*. Un-vendored editions are
 * surfaced-and-disabled, the same rule the hop rail follows for edges pointing
 * at pages that are not vendored yet — never a ghost.
 */

import { formatAyahKey, parseAyahKey } from "./keys.js";
import type { EditionId } from "./types.js";

/** Whether an edition's assets are actually in the build. */
export type EditionStatus = "vendored" | "unvendored";

export interface EditionMeta {
  readonly id: EditionId;
  /** Arabic label for chrome. */
  readonly label: string;
  /** The riwayah, named the way a hafiz names it. */
  readonly riwayah: string;
  readonly status: EditionStatus;
  /**
   * How many pages this print has — a property of the paper, not of the build.
   *
   * Optional on purpose. It is the length of the *book*, so it is only ever
   * present when someone has confirmed it for that specific print; a guess here
   * would be a slider that scrolls a hafiz past the end of a mus'haf. Absent
   * means "we do not know", and callers must fall back to what is vendored
   * rather than to a number that looks about right.
   */
  readonly pages?: number;
  /**
   * Why an `unvendored` edition is not selectable — shown verbatim in the
   * picker. These are real blockers recorded in PLAN's follow-ups, not
   * placeholder copy; if a reason stops being true, the entry changes.
   */
  readonly reason?: string;
}

/**
 * Editions Hifth knows about. Only `hafs-kfqc` ships assets (PLAN §Loop 4b
 * vendors its remaining pages); the rest are listed so the picker can be
 * truthful about the shape of the app rather than implying it is single-edition
 * by nature.
 */
export const EDITIONS: readonly EditionMeta[] = [
  {
    id: "hafs-kfqc",
    label: "حفص · مجمع الملك فهد",
    riwayah: "رواية حفص عن عاصم",
    status: "vendored",
    // The Madani mus'haf's 604 pages — the number printed in its own corners,
    // and the one SOURCES.md's layout match was made against. The other three
    // entries have no `pages` because nobody here has counted them, and the
    // IndoPak rasm in particular paginates differently from print to print.
    pages: 604,
  },
  {
    id: "warsh-libya",
    label: "ورش · أوقاف ليبيا",
    riwayah: "رواية ورش عن نافع",
    status: "unvendored",
    // PLAN follow-up ②: the Libyan Endowments editions are licensed for
    // non-commercial use only, so they cannot be vendored without approval.
    reason: "ترخيصها غير تجاري — تحتاج إذنًا قبل إضافتها",
  },
  {
    id: "qalun-libya",
    label: "قالون · أوقاف ليبيا",
    riwayah: "رواية قالون عن نافع",
    status: "unvendored",
    reason: "ترخيصها غير تجاري — تحتاج إذنًا قبل إضافتها",
  },
  {
    id: "hafs-indopak",
    label: "حفص · الرسم الهندي",
    riwayah: "رواية حفص عن عاصم",
    status: "unvendored",
    // No vendored asset source with a resolved licence + polygon layer yet.
    reason: "لا مصدر صفحات مرخّص بعد",
  },
];

/** The edition entry for an id, or null if we do not know it. */
export function editionMeta(id: EditionId): EditionMeta | null {
  return EDITIONS.find((e) => e.id === id) ?? null;
}

/**
 * One direction of a concordance: `from` → `to`.
 *
 * `deltas` is keyed by the source ayah's bare `surah:ayah` ref; a value is the
 * target ref, or `null` for "this ayah has no counterpart" (splits and merges
 * across countings are real — an ayah can vanish into its neighbour).
 */
export interface ConcordanceTable {
  readonly from: EditionId;
  readonly to: EditionId;
  /**
   * `identity`: the table asserts the two countings agree outside `deltas`.
   * `explicit`: only refs listed in `deltas` map; everything else is unknown.
   */
  readonly base: "identity" | "explicit";
  readonly deltas: Readonly<Record<string, string | null>>;
}

const REF_RE = /^(\d+):(\d+)$/;

/**
 * The cross-edition mapping table (spec §4 `concordance`). Empty until an ETL
 * pass loads tables into it — an empty concordance answers "I don't know" to
 * every question, which is the correct answer while one edition exists.
 */
export class Concordance {
  private readonly tables = new Map<string, ConcordanceTable>();

  /** Register one direction. Re-adding a pair replaces it. */
  add(table: ConcordanceTable): void {
    this.tables.set(`${table.from}>${table.to}`, table);
  }

  /** Whether a table exists for `from → to`. */
  has(from: EditionId, to: EditionId): boolean {
    return from === to || this.tables.has(`${from}>${to}`);
  }

  /**
   * Map a canonical ayah key into `to`'s numbering.
   *
   * Returns null when there is no table (never a guess), when the table is
   * `explicit` and does not list the ref, or when the table says the ayah has
   * no counterpart. A key already in `to` maps to itself — that is not index
   * arithmetic, it is the same edition.
   */
  map(key: string, to: EditionId): string | null {
    const parsed = parseAyahKey(key);
    if (!parsed) return null;
    if (parsed.edition === to) return key;
    const table = this.tables.get(`${parsed.edition}>${to}`);
    if (!table) return null;

    const ref = `${parsed.surah}:${parsed.ayah}`;
    if (Object.prototype.hasOwnProperty.call(table.deltas, ref)) {
      const mapped = table.deltas[ref];
      if (mapped == null) return null; // recorded as having no counterpart
      const m = REF_RE.exec(mapped);
      if (!m) return null;
      return formatAyahKey(to, Number(m[1]), Number(m[2]));
    }
    // Unlisted: only the table's own identity claim can carry it across.
    if (table.base !== "identity") return null;
    return formatAyahKey(to, parsed.surah, parsed.ayah);
  }
}
