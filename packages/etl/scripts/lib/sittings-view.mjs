/**
 * What the front door shows, written once and run twice.
 *
 * ── Why this is a module and not just part of the builder ────────────────
 *
 * The front door had one honest number on it and everything else was a
 * photograph. The tiles, the totals, the sentence saying how many sittings
 * there are and how long each takes — all of it was worked out on the machine
 * at the moment the page was generated and then frozen into the file. Only the
 * progress bars asked anything of the outside world.
 *
 * That is fine right up until the sittings behind the door change, which is the
 * normal case rather than the exception: finishing a sitting is what a reader is
 * there to do, and every re-deal moves which marks are in which part. So a
 * reader would finish one and it would sit there looking exactly as unfinished
 * as the fifteen beside it, and the only thing that could correct the page was
 * somebody remembering to regenerate it.
 *
 * The fix is to let the page work out the same things the builder does, from a
 * listing the serving side reads off the disk each time it is asked. Which means
 * the arithmetic and the drawing have to happen in two runtimes: here in Node,
 * to bake a page that is true the moment it is written and stays readable with
 * nothing serving it; and in a browser, against whatever is on the disk now.
 *
 * Two runtimes, one reading — the same discipline, and for the same reason, as
 * `standingIds` in `answered.mjs`. Rather than restate any of this in a
 * generated script, the builder ships these functions' own source text into the
 * page and calls them there. A test pulls the shipped copies back out and makes
 * them agree with these.
 *
 * ── The rule that keeps that possible ────────────────────────────────────
 *
 * **Every function here is closed over nothing but the others.** No imports, no
 * module-level constants, no shared tables — anything a function needs that is
 * not its own argument is either written inside its body or passed in. That is
 * why `howLong` takes the seconds-per-mark estimate and `bandCopy` takes the
 * table of band titles instead of reading either from a constant: a binding at
 * module scope reads perfectly here and is `undefined` in the page.
 *
 * The editorial half stays out of this file entirely. Titles like "barely
 * accepted" belong to whoever is explaining the plan, not to the arithmetic.
 */

/** HTML-safe, quotes included, because these strings end up inside attributes. */
export function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A count as a person says it, up to twenty, and as digits after that. */
export function word(n) {
  const words = [
    "no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen", "twenty",
  ];
  return n >= 0 && n < words.length ? words[n] : String(n);
}

/** The same, to open a sentence. */
export function Word(n) {
  const w = word(n);
  return w[0].toUpperCase() + w.slice(1);
}

/** Grouped digits. Spelled out rather than left to the locale default, which is
 *  the machine's locale in Node and the reader's in a browser — and the two
 *  disagreeing would make the baked page and the live one differ by a comma. */
export function num(n) {
  return Number(n).toLocaleString("en-US");
}

/**
 * About how long a sitting of n marks takes, said the way a person would say it.
 *
 * The rate is an argument rather than a constant because it is an estimate taken
 * from sittings already sat, and the page says so. Passing it keeps this
 * function shippable into the browser.
 */
export function howLong(n, secondsPerMark) {
  const mins = Math.round((n * secondsPerMark) / 60);
  if (mins < 45) return `about ${Math.round(mins / 5) * 5} minutes`;
  if (mins < 80) return "about an hour";
  return `about ${(mins / 60).toFixed(1).replace(/\.0$/, "")} hours`;
}

/**
 * The two kinds of sitting, and the census of the deal behind the parts.
 *
 * Population, already-answered and pool are properties of the DEAL rather than
 * of any one part, so they are read off the first part and the rest are checked
 * against it. `mixed` is that check's answer: parts on disk from two different
 * builds, which is the one state where a front door would quietly mislead about
 * how much work is left. What to do about it differs by runtime — the builder
 * refuses to write a page at all, the page says so and carries on — so this
 * reports it and decides nothing.
 */
export function census(sittings) {
  const tail = (s) => String(s && s.slice ? s.slice : "").split("-").pop();
  const bands = sittings.filter((s) => s.band);
  const parts = sittings
    .filter((s) => s.part)
    .sort((a, b) => Number(String(a.part).split("/")[0]) - Number(String(b.part).split("/")[0]));
  const deal = parts.length ? parts[0] : null;
  const shown = parts.reduce((t, p) => t + (p.shown || 0), 0);
  return {
    bands,
    parts,
    deal,
    mixed: deal ? parts.filter((p) => tail(p) !== tail(deal)) : [],
    shown,
    answered: deal ? deal.alreadyAnswered || 0 : 0,
    population: deal ? deal.population || 0 : 0,
    per: parts.length ? Math.round(shown / parts.length) : 0,
    // Which deal these parts came out of, so a page can tell it is looking at a
    // different set of parts than the one it was drawn from.
    dealId: deal ? tail(deal) : "?",
  };
}

/**
 * How many marks a sitting is asking about.
 *
 * The card list is the truth and the header's own count is the fallback, which
 * matters for exactly one case: a sitting whose card list is torn still gets
 * listed off its header, and a tile reading "0 of 0" would say the opposite of
 * what is true about it.
 */
export function sizeOf(s) {
  return (s.ids && s.ids.length) || s.shown || 0;
}

/** How many of a sitting's marks carry a standing answer. */
export function doneCount(s, standing) {
  let n = 0;
  for (const id of s.ids || []) if (standing.has(id)) n += 1;
  return n;
}

/** Whether a sitting has nothing left to ask. A sitting of nothing is not one. */
export function isDone(s, n) {
  const of = sizeOf(s);
  return of > 0 && n >= of;
}

/** The editorial line for a band, or the band's own range when nobody wrote one. */
export function bandCopy(id, table) {
  const row = (table || []).filter((r) => r[0] === id)[0];
  return row ? { title: row[1], blurb: row[2] } : { title: String(id), blurb: "a band of confidence" };
}

/**
 * One tile for one of the numbered sittings.
 *
 * Built as a string rather than as elements because the same function has to
 * produce the checked-in page in Node, where there is no document. The bar is
 * drawn rather than written out because sixteen of these are read at a glance
 * and sixteen fractions are not.
 */
export function partTile(p, n) {
  const of = sizeOf(p);
  const at = String(p.part).split("/")[0];
  return (
    `<li><a class="sit part${isDone(p, n) ? " done" : ""}" href="${esc(p.name)}" data-part="${esc(at)}">` +
    `<span class="pn">${esc(at)}</span>` +
    `<span class="bar"><i style="width:${of ? Math.round((n / of) * 100) : 0}%"></i></span>` +
    `<span class="pc">${n} of ${of}</span></a></li>`
  );
}

/** One tile for one band of confidence, with the same bar for the same reason. */
export function bandTile(b, n, title, blurb) {
  const of = sizeOf(b);
  return (
    `<li><a class="sit band${isDone(b, n) ? " done" : ""}" href="${esc(b.name)}" data-band="${esc(b.band)}">` +
    `<span class="name">${esc(title)}<small>${esc(blurb)}</small></span>` +
    `<span class="bar"><i style="width:${of ? Math.round((n / of) * 100) : 0}%"></i></span>` +
    `<span class="n">${n} of ${of}</span></a></li>`
  );
}

/**
 * Whether anybody has yet checked that the confidence number means anything.
 *
 * A sentence rather than a count, and it lives here rather than in the page's
 * prose for the reason everything else here does: it is derived from the data, so
 * writing it twice means two runtimes disagreeing about whether a band has been
 * sat. The genuinely editorial half — what "barely accepted" means — is not in
 * this file and never should be.
 *
 * Note it counts standing answers rather than reading the already-answered figure
 * off a band's header. That figure is how many marks had been answered when the
 * band was built, which is a fact about the deal and not about this band, and it
 * was quietly answering a different question than the sentence asked.
 */
export function bandsLine(bands, standing) {
  let started = 0;
  let finished = 0;
  for (const b of bands) {
    const n = doneCount(b, standing);
    if (n > 0) started += 1;
    if (isDone(b, n)) finished += 1;
  }
  if (!bands.length) return "<strong>There are none to check it with.</strong>";
  if (finished >= bands.length) return `<strong>All ${word(bands.length)} have been sat.</strong>`;
  if (finished) {
    return `<strong>${Word(finished)} of the ${word(bands.length)} ${finished === 1 ? "has" : "have"} been sat.</strong>`;
  }
  if (started) {
    return `<strong>${Word(started)} of the ${word(bands.length)} ${started === 1 ? "has" : "have"} been started.</strong>`;
  }
  return "<strong>Nothing has ever checked that.</strong>";
}

/**
 * Where a reader should carry on, given how far each sitting has got.
 *
 * A sitting somebody is in the middle of beats a fresh one, because a part left
 * half-done is the only place the next re-deal cannot help them: finishing it is
 * what puts its marks beyond being dealt again. Nothing to carry on with is a
 * real answer and comes back null.
 */
export function carryOn(sittings, standing) {
  let started = null;
  let fresh = null;
  for (const s of sittings) {
    const n = doneCount(s, standing);
    if (isDone(s, n)) continue;
    if (n > 0) {
      if (!started) started = { sitting: s, done: n, of: sizeOf(s) };
    } else if (!fresh) {
      fresh = { sitting: s, done: 0, of: sizeOf(s) };
    }
  }
  return started || fresh;
}
