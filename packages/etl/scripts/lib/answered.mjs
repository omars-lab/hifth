/**
 * Which marks carry a standing answer, and what that set is called.
 *
 * This lived inside `build-mark-report.mjs` until an auditor needed the same
 * question answered, and the tempting thing — reading the answers a second time,
 * slightly differently — is the one mistake this module exists to prevent. Two
 * readings of the word *answered* disagree eventually, and when they do, the
 * builder drops a mark the auditor still counts and neither of them is obviously
 * wrong. There is one reading. It is here.
 *
 * Two shapes arrive and both are legitimate. The serving side appends one line per
 * answer to a running log as it is given; a reader who finishes a sitting hands over
 * a single document instead. Nobody should be punished for having banked their work
 * one way rather than the other, so both are read, in any mix, into one set.
 *
 * A retraction takes a mark back out. That is the whole reason this counts rather
 * than collects: a reader who says something and then takes it back has not answered,
 * and the log keeps both statements because it is a log.
 */
import { readFileSync } from "node:fs";

/**
 * FNV-1a, and it is here because it is the name of the answered set, not because
 * anybody needs a hash.
 *
 * The same eight characters appear in nine other scripts in this directory, each
 * with its own copy. Consolidating those is worth doing and is not done here — a
 * change to the function changes every sitting's identity at once, which is a
 * separate decision from where the function lives.
 */
export function fingerprint(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Every mark with a standing answer across the given logs and hand-overs.
 *
 * A statement names the mark it is about, and a retraction names the mark it is
 * taking back — so this counts per mark rather than collecting, and a mark whose
 * answers were all withdrawn returns to the pool exactly as if it had never been
 * seen. Anything else would quietly bury the marks a reader found hardest, which are
 * the ones worth the most.
 *
 * A file that cannot be read throws rather than being skipped. The alternative is a
 * sitting that silently re-asks two hundred questions somebody has already answered,
 * and neither the reader nor the auditor can tell that from a sitting that was
 * supposed to.
 */
export function readAnswered(paths) {
  const net = new Map();
  const bump = (ev) => {
    if (!ev || !ev.id) return;
    const d = ev.kind === "retracted" ? -1 : 1;
    net.set(ev.id, (net.get(ev.id) || 0) + d);
  };
  for (const p of paths) {
    const text = readFileSync(p, "utf8");
    if (p.endsWith(".jsonl")) {
      for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        const rec = JSON.parse(line);
        bump(rec.payload || rec);
      }
    } else {
      const doc = JSON.parse(text);
      for (const ev of Array.isArray(doc) ? doc : doc.said || []) bump(ev);
    }
  }
  return new Set([...net].filter(([, n]) => n > 0).map(([id]) => id));
}

/**
 * What a sitting built against this answered set is called.
 *
 * Dropping answered marks moves every card, so it has to move the sitting's name —
 * the page keeps *how far you got* under a key built from what the sitting is, and a
 * position measured against a hundred and seventeen cards points nowhere in a
 * rebuilt eighty. So the answered set is part of the identity, and this is the part
 * of the identity it contributes.
 *
 * Sorted before joining, because the set is a set: the same marks answered in a
 * different order are the same sitting, and a name that disagreed would rebuild
 * every part for no reason.
 */
export function answeredKey(answered) {
  return answered.size ? `-a${fingerprint([...answered].sort().join(","))}` : "";
}
