/**
 * The book's key to the initials its notes cite commentators by.
 *
 * The Study Quran names its sources in brackets by initials, and says who they
 * are only in a key at the front of the volume. The capture's own reading of
 * that key garbled its accents, so the key is typed by hand from the page
 * pictures into the capture's folder, next door; this turns that copy into what
 * the note looks initials up in. It carries no names itself: the key is held,
 * like the rest of the book, and only ever reaches the gitignored pitch data.
 */

// Initials as the book prints them: a capital, then at most two more letters.
const INITIALS = /^\p{Lu}\p{L}{0,2}$/u;

/** `{ key: [{ sig, who, work, also? }] }` → `{ [sig]: { who, work, also? } }`, checked. */
export function readKey(raw) {
  const out = {};
  for (const e of raw.key ?? []) {
    const sig = String(e.sig ?? "").normalize("NFC");
    const who = String(e.who ?? "").normalize("NFC").trim();
    const work = String(e.work ?? "").normalize("NFC").trim();
    if (!INITIALS.test(sig)) throw new Error(`key: "${sig}" is not initials`);
    if (!/\(.*\bd\. /.test(who)) throw new Error(`key ${sig}: the name carries no dates`);
    if (!work) throw new Error(`key ${sig}: no work named`);
    if (sig in out) throw new Error(`key: ${sig} is in the key twice`);
    out[sig] = { who, work, ...(e.also ? { also: String(e.also).normalize("NFC").trim() } : {}) };
  }
  return out;
}
