/**
 * Where the capture lost a verse, a person read it again off the printed page
 * and wrote it into a private file next to the capture. Two shapes reach here:
 *
 * - The book sometimes prints a verse's note before or inside the verse, and the
 *   capture took the note as the verse. The verse is then missing and the note
 *   sits in its place, sometimes after the verse with its own label ("105–7 …").
 * - A verse that runs over a page was cut at the page's foot, sometimes part way
 *   through a word.
 *
 * Given what was captured and what was read again, returns the verse and any
 * note the capture had filed under it. With nothing read again, the capture
 * stands as it is.
 */
export function settleTranslation(captured, fixed) {
  if (!fixed) return { translation: captured, note: "" };
  const cut = captured.trimEnd();
  if (fixed.startsWith(cut)) return { translation: fixed, note: "" };
  const note = captured.startsWith(fixed) ? captured.slice(fixed.length) : captured;
  return { translation: fixed, note: note.replace(/\s*\*\s*\*\s*\*\s*$/, "").trim() };
}

/**
 * The verses a note says it covers, from its label: "4–6 …" covers 4 to 6, and
 * the print shortens the end of a range to its last digits ("105–7" is 105 to
 * 107). A single verse's label, or no label, is not a range.
 */
export function noteRange(text) {
  const m = text.match(/^(\d+)[–-](\d+)\s/);
  if (!m) return null;
  const [from, short] = [m[1], m[2]];
  const to = short.length < from.length ? Number(from.slice(0, from.length - short.length) + short) : Number(short);
  return [Number(from), to];
}
