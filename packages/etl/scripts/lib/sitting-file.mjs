/**
 * Reading a built sitting back off the disk.
 *
 * A sitting is one HTML file with two JSON literals in it, which is not a format —
 * but it is the format, and deliberately: the whole point of the instrument is that a
 * part is a single file a reader can open anywhere with nothing installed. Parsing it
 * back is what that costs, and it is cheap, because both literals are emitted by
 * `JSON.stringify` onto one line apiece.
 *
 * Three things now ask a built sitting what it is — the auditor, the front door, and
 * anything that comes next — and they were about to ask it in three slightly different
 * ways. That is the same drift `answered.mjs` was extracted to stop, with a worse
 * failure: a reader of the header that tolerates a shape the other rejects gives one
 * caller sixteen parts and the other fifteen, and the missing one is invisible in both
 * reports. There is one reading. It is here.
 *
 * Faults are returned rather than thrown or printed. A front door that refuses to
 * render because one of twenty-one files is torn is worse than one that lists the
 * twenty and says which one it could not read, and only the caller knows which of
 * those two it is.
 */
import { readFileSync } from "node:fs";

const HEAD = /^const HEAD = (\{.*\});$/m;
const CARDS = /^const CARDS = (\[.*\]);$/m;

/**
 * What one file says about itself.
 *
 * Returns null when the file is not a sitting at all — the output directory holds
 * plenty of other pages, and the front door and the auditor both walk it whole. A
 * file that *is* a sitting but whose card list is unreadable comes back with its
 * header, no ids, and a fault saying so: the header is what carries the counts, so
 * half a sitting is still worth listing and is not worth trusting.
 */
export function readSitting(file) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return null;
  }

  const head = HEAD.exec(text);
  if (!head) return null;
  let parsed;
  try {
    parsed = JSON.parse(head[1]);
  } catch {
    return null;
  }
  if (parsed.built !== "mark-report") return null;

  const faults = [];
  const cards = CARDS.exec(text);
  let ids = [];
  if (!cards) {
    faults.push("no card list found, so the marks it asks about cannot be checked");
  } else {
    try {
      ids = JSON.parse(cards[1]).map((c) => c.id);
    } catch {
      faults.push("the card list does not parse, so the marks it asks about cannot be checked");
    }
  }
  return { file, head: parsed, ids, faults };
}
