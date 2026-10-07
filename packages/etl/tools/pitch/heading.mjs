/**
 * The printed book sets each verse's translation in bold above its note, and
 * the capture sometimes took that heading in as the note's first words: the
 * drawer then showed the verse twice, once as the verse and again as the
 * opening of its note. A heading can run on into the next verses ("…, 2 …, 3 …")
 * when one note covers several, and it ends at the note's own label ("1–3 …"),
 * at a full stop, or at the end of the block.
 *
 * Only the whole translation counts as a heading. A note that quotes part of
 * its verse, or opens with words that merely begin like it, is left alone.
 * The capture usually puts the verse's own number in front ("4 <heading> 4 …"),
 * so that is read past first, and the heading sometimes drops the verse's
 * closing full stop, so the note's number follows the last word directly.
 * `translationOf(n)` gives verse n of the same surah, "" when there is none.
 */
const GAP = "[\\s\\u00a0]";
const LABEL = new RegExp(`^[.,;:!?]?${GAP}*(\\d+)${GAP}+`);
// The note's own label, where the heading stops: a verse up to this one, or a
// range that starts there ("1–3").
const END = new RegExp(`^[.,;:!?]?${GAP}*(?=(\\d+)(?:[–-]\\d+)?${GAP})`);

/** The ways the heading may print a verse: as stored, without its closing
 * mark (the heading puts ";", "," or the next number there), and, for a verse the
 * heading runs on into, starting with a small letter. */
function forms(verse, runOn) {
  const bare = verse.replace(/[.;,!?]$/, "");
  const out = [verse, bare];
  if (runOn) out.push(...out.map((f) => f.charAt(0).toLowerCase() + f.slice(1)));
  return out.filter(Boolean);
}

export function dropVerseHeading(text, ayah, translationOf) {
  const start = text.match(LABEL);
  const body = start && Number(start[1]) === ayah ? text.slice(start[0].length) : text;
  const own = forms(translationOf(ayah).trim(), false).find((f) => body.startsWith(f));
  if (!own) return text;
  let rest = body.slice(own.length);
  let last = own;
  for (let next = ayah + 1; ; next++) {
    const m = rest.match(LABEL);
    if (!m || Number(m[1]) !== next) break;
    const tail = rest.slice(m[0].length);
    const verse = forms(translationOf(next).trim(), true).find((f) => tail.startsWith(f));
    if (!verse) break;
    rest = tail.slice(verse.length);
    last = verse;
  }
  const label = rest.match(END);
  if (label && Number(label[1]) <= ayah) return rest.slice(label[0].length);
  if (/^[.,;:!?]?[\s\u00a0]*$/.test(rest)) return "";
  const after = rest.replace(/^[\s\u00a0]+/, "");
  return /[.!?][”’]?$/.test(last) && rest !== after ? after : text;
}
