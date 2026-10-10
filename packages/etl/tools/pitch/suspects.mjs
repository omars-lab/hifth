/**
 * Places in a finished note that are worth a look against the printed page: a
 * bracket the paragraph opens and never closes, two verse references set side
 * by side with nothing between them, and a paragraph that opens on the last
 * word or closing quote of the sentence before it. All have been the capture's
 * slips (a closing bracket misread, a reference list cut at a page turn, the
 * margin's references run into the text, a paragraph break placed a word late),
 * but the print does the first two now and then, so these are leads to check,
 * not faults to mend. The `--suspects` listing of
 * extract.mjs prints them.
 */
const REF = "\\d+:\\d+(?:[–-]\\d+)?c?";
const BARE_REFS = new RegExp(`(?<![\\d:–-])${REF}\\s+(?=${REF}(?![\\d:]))`, "gu");
const PAIRS = { "(": ")", "[": "]" };
// A lower-case word, or nothing, then a stop, then the next sentence: a capital
// word after "Lit." or "V." is the book's own, so only a lower-case one is a lead.
const STRAY_OPENING = /^[\uE000\uE001]*(?:\p{Ll}[\p{L}’'-]{0,13})?[\uE000\uE001]*[.!?][”’")]*[\uE000\uE001]*\s+[\uE000]?[\p{Lu}“"(]|^[”’")][.!?]?\s/u;

/** Whether a paragraph opens on the last word or closing quote of the sentence before it. */
export const opensOnStray = (text) => STRAY_OPENING.test(text);

function openBracket(text) {
  const open = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c in PAIRS) open.push(i);
    else if (c === ")" || c === "]") {
      const top = open.at(-1);
      if (top !== undefined && PAIRS[text[top]] === c) open.pop();
    }
  }
  return open[0];
}

/** One paragraph's leads, each a kind and where in the text it starts. */
export function suspects(text) {
  const found = [];
  const at = openBracket(text);
  if (at !== undefined) found.push({ kind: "open-bracket", at });
  for (const m of text.matchAll(BARE_REFS)) found.push({ kind: "bare-refs", at: m.index });
  if (opensOnStray(text)) found.push({ kind: "stray-opening", at: 0 });
  return found;
}
