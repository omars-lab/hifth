// The copy of a reader's marks kept on hifth.app (docs/design/sign-in.md, step 21). The addresses
// are in sign-in-api.mjs; this is what they do to the database. The server never merges or reads
// inside a copy beyond checking it is a marks file: the device merges what it fetches with what it
// holds, and sends the result back whole.

/**
 * The largest copy kept, in bytes. Cloudflare's database holds at most 2,000,000 bytes in a row,
 * and a thousand notes of 500 letters each, more than any reader we can picture, is about 750,000
 * once written out.
 */
export const MOST_COPY_BYTES = 1_500_000;

/** The parts a marks file may have (toBookmarkFile in packages/core/src/bookmarks.ts). */
const LISTS = ["bookmarks", "notes", "scopedNotes", "confusions", "removed"];
const KEYS = new Set(["kind", "version", "savedAt", ...LISTS]);

/**
 * Whether this is a marks file and nothing else. It must say it is one, and carry only the parts a
 * marks file has, so the copy can never be made to hold anything more, such as the record of the
 * pages a reader opened, which leaves the device only by its own tick box.
 */
export function isMarksFile(x) {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  if (x.kind !== "hifth.bookmarks") return false;
  if (!Number.isInteger(x.version) || x.version < 1 || x.version > 99) return false;
  if (!Array.isArray(x.bookmarks)) return false;
  for (const key of Object.keys(x)) if (!KEYS.has(key)) return false;
  for (const list of LISTS) if (x[list] !== undefined && !Array.isArray(x[list])) return false;
  return true;
}

/** The reader's copy as { marks, number, savedAt }, or null when they have none. */
export async function readCopy(db, accountId) {
  const row = await db.prepare("SELECT marks, number, saved_at FROM marks_copies WHERE account_id = ?").bind(accountId).first();
  return row ? { marks: JSON.parse(row.marks), number: row.number, savedAt: row.saved_at } : null;
}

/**
 * Replaces the reader's copy whole, but only if the copy is still the one numbered `after` (0 when
 * the device has seen none). Returns { ok: true, number } with the new number, or
 * { ok: false, number } with the number of the copy it would have written over, which the device
 * fetches and merges before trying again. The check and the write are one statement, so two
 * devices writing at once cannot both win.
 */
export async function keepCopy(db, accountId, marks, after, { now = Date.now() } = {}) {
  const text = JSON.stringify(marks);
  const written =
    after === 0
      ? await db
          .prepare("INSERT INTO marks_copies (account_id, marks, number, saved_at) VALUES (?, ?, 1, ?) ON CONFLICT (account_id) DO NOTHING")
          .bind(accountId, text, now)
          .run()
      : await db
          .prepare("UPDATE marks_copies SET marks = ?, number = number + 1, saved_at = ? WHERE account_id = ? AND number = ?")
          .bind(text, now, accountId, after)
          .run();
  if (written.meta.changes === 1) return { ok: true, number: after + 1 };
  const number = await db.prepare("SELECT number FROM marks_copies WHERE account_id = ?").bind(accountId).first("number");
  return { ok: false, number: number ?? 0 };
}

/** Removes the reader's copy. The account and its sessions stay. */
export async function dropCopy(db, accountId) {
  await db.prepare("DELETE FROM marks_copies WHERE account_id = ?").bind(accountId).run();
}
