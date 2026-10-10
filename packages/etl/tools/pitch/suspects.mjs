/**
 * Places in a finished note that are worth a look against the printed page: a
 * bracket the paragraph opens and never closes, and two verse references set
 * side by side with nothing between them. Both have been the capture's slips
 * (a closing bracket misread, a reference list cut at a page turn, the margin's
 * references run into the text), but the print does it too now and then, so
 * these are leads to check, not faults to mend. The `--suspects` listing of
 * extract.mjs prints them.
 */
const REF = "\\d+:\\d+(?:[–-]\\d+)?c?";
const BARE_REFS = new RegExp(`(?<![\\d:–-])${REF}\\s+(?=${REF}(?![\\d:]))`, "gu");
const PAIRS = { "(": ")", "[": "]" };

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
  return found;
}
