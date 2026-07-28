/**
 * Shared reader for the reader-facing licence record.
 *
 * `SOURCES.md` is prose for humans first, but one part of it is exact: each
 * `### <entry>` carries a ` ```colophon ` fence declaring the row the app shows
 * for that source. Two scripts now read those fences — `gate-license-copy.mjs`
 * asserts `Colophon.tsx` renders exactly them, and `check-source-offer.mjs`
 * follows their `href`s over the network — so the parsing lives here once.
 *
 * Same move, and the same reason, as `code-pointers.mjs`: two parsers of one
 * format drift, and the drift is silent until the day one of them is wrong.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";

export const SOURCES_PATH = join(ROOT, "SOURCES.md");
export const COLOPHON_PATH = join(ROOT, "apps", "web", "src", "components", "Colophon.tsx");

/** The row fields, in the order a failure should print them. */
export const FIELDS = ["what", "who", "licence", "href"];

/**
 * Every ```colophon fence in SOURCES.md, keyed by the `### <id>` it sits under.
 *
 * Parsed rather than imported because SOURCES.md is prose for humans first; the
 * fence is the one part of it that has to be exact, and marking that part
 * explicitly is cheaper than teaching a parser the rest of the document.
 */
export function readDeclarations(md = readFileSync(SOURCES_PATH, "utf8")) {
  const problems = [];
  const declarations = new Map();

  // Sections run from one `### id` heading to the next.
  const headings = [...md.matchAll(/^###\s+([A-Za-z0-9._-]+)\s*$/gm)];
  for (let i = 0; i < headings.length; i++) {
    const id = headings[i][1];
    const start = headings[i].index;
    const end = i + 1 < headings.length ? headings[i + 1].index : md.length;
    const section = md.slice(start, end);

    const fences = [...section.matchAll(/^```colophon\n([\s\S]*?)^```$/gm)];
    if (fences.length === 0) {
      problems.push(
        `SOURCES.md § ${id} — no \`\`\`colophon fence. Every source declares what the ` +
          `app tells the reader about it, or declares that it tells them nothing:\n` +
          `      \`\`\`colophon\n` +
          `      not-credited: <why this source is not named in the app>\n` +
          `      \`\`\``,
      );
      continue;
    }
    if (fences.length > 1) {
      problems.push(`SOURCES.md § ${id} — ${fences.length} colophon fences; expected one`);
      continue;
    }

    const row = {};
    for (const line of fences[0][1].split("\n")) {
      if (line.trim() === "") continue;
      const at = line.indexOf(":");
      if (at === -1) {
        problems.push(`SOURCES.md § ${id} — colophon line is not \`key: value\`: ${line.trim()}`);
        continue;
      }
      row[line.slice(0, at).trim()] = line.slice(at + 1).trim();
    }
    declarations.set(id, row);
  }

  return { declarations, problems };
}

/**
 * The CREDITS array as `Colophon.tsx` actually declares it.
 *
 * Comment lines go first: the docblock above CREDITS quotes the very phrase
 * gate:license-copy forbids ("non-commercial use only", as the account of why
 * it was wrong), and a gate that fails on its own explanation would be a bad
 * joke.
 */
export function readCredits(tsx = readFileSync(COLOPHON_PATH, "utf8")) {
  const open = tsx.indexOf("const CREDITS");
  if (open === -1) return { credits: [], problems: ["Colophon.tsx — no `const CREDITS` found"] };
  const from = tsx.indexOf("[", open);
  const to = tsx.indexOf("\n];", from);
  if (from === -1 || to === -1) {
    return { credits: [], problems: ["Colophon.tsx — could not find the bounds of CREDITS"] };
  }

  const body = tsx
    .slice(from, to)
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
    .join("\n");

  const credits = [...body.matchAll(/\{([^{}]*)\}/g)].map((m) => {
    const row = {};
    for (const f of m[1].matchAll(/(\w+)\s*:\s*"((?:[^"\\]|\\.)*)"/g)) row[f[1]] = f[2];
    return row;
  });

  // Zero rows means the parser lost, not that the app credits nobody. Say so
  // rather than passing: a gate that quietly matches nothing against nothing is
  // the failure mode gate:license-copy exists to prevent.
  const problems =
    credits.length === 0 ? ["Colophon.tsx — CREDITS parsed as empty; the parser is broken"] : [];
  return { credits, problems };
}

/**
 * The attribution links the app puts in front of a reader, with the entry that
 * declared each. These are licence terms, not decoration: corpus.quran.com's
 * terms require the link, and the mutashabihat data asks for a mention in the
 * app itself — so a dead one is a term being quietly failed.
 */
export function creditedHrefs() {
  const { declarations, problems } = readDeclarations();
  const links = [];
  for (const [id, row] of declarations) {
    if (row["not-credited"] || !row.href) continue;
    links.push({ id, href: row.href, who: row.who ?? "" });
  }
  return { links, problems };
}
