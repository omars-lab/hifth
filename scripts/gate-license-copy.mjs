#!/usr/bin/env node
/**
 * CI gate: the licence the app tells the reader is the licence SOURCES.md records.
 *
 * `gate:license` already proves every bundled edition *has* an entry. It says
 * nothing about whether the entry and the screen agree, and they once did not:
 * the colophon credited the KFGQPC page artwork as «للاستعمال غير التجاري»
 * — non-commercial use only — which is the *Libyan Endowments Qālūn* edition's
 * term for an edition Hifth does not vendor. SOURCES.md had it right the whole
 * time. Every reader was told the artwork was more restricted than it is, and
 * nothing failed, because the two statements lived in two files and only one of
 * them was ever read by a machine.
 *
 * So bind them. Each `### <entry>` in SOURCES.md declares the exact reader-facing
 * row in a ```colophon fence, and this gate asserts `Colophon.tsx`'s CREDITS is
 * that set of rows, byte for byte. The record stops being a parallel account of
 * the licence and becomes its source; the component becomes one renderer of it.
 * Changing what the reader is told now requires changing the file a lawyer would
 * read, in the same commit, which is the whole point.
 *
 * An entry that should not be credited says so, in the fence, with a reason —
 * because "no row" and "nobody got round to it" are indistinguishable otherwise.
 *
 * Run: `pnpm gate:license-copy` (also in `pnpm gates`, `make ci` and CI).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SOURCES = join(ROOT, "SOURCES.md");
const COLOPHON = join(ROOT, "apps", "web", "src", "components", "Colophon.tsx");

/** The row fields, in the order a failure should print them. */
const FIELDS = ["what", "who", "licence", "href"];

/**
 * Claims that would repeat the defect this gate exists for. A source really
 * licensed non-commercially may of course be credited as such — it just has to
 * say `commercial-use: restricted` in its own fence first, so the claim is a
 * decision recorded in SOURCES.md rather than a phrase that drifted in.
 */
const NON_COMMERCIAL = [
  /غير\s+(?:ال)?تجاري/, // «غير تجاري» / «غير التجاري»
  /non[-\s]?commercial/i,
  /\bCC[ -]BY[ -]NC\b/i,
];

/**
 * Every ```colophon fence in SOURCES.md, keyed by the `### <id>` it sits under.
 *
 * Parsed rather than imported because SOURCES.md is prose for humans first; the
 * fence is the one part of it that has to be exact, and marking that part
 * explicitly is cheaper than teaching a parser the rest of the document.
 */
function readDeclarations(md) {
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
 * Comment lines go first: the docblock above CREDITS quotes the very phrase this
 * gate forbids ("non-commercial use only", as the account of why it was wrong),
 * and a gate that fails on its own explanation would be a bad joke.
 */
function readCredits(tsx) {
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
  // the failure mode this whole file exists to prevent.
  const problems =
    credits.length === 0 ? ["Colophon.tsx — CREDITS parsed as empty; the parser is broken"] : [];
  return { credits, problems };
}

const md = readFileSync(SOURCES, "utf8");
const tsx = readFileSync(COLOPHON, "utf8");

const { declarations, problems: mdProblems } = readDeclarations(md);
const { credits, problems: tsxProblems } = readCredits(tsx);
const problems = [...mdProblems, ...tsxProblems];

// The declared rows, minus the entries that declare they are not credited.
const declared = new Map();
for (const [id, row] of declarations) {
  if (row["not-credited"]) continue;
  const missing = FIELDS.filter((f) => !row[f]);
  if (missing.length > 0) {
    problems.push(
      `SOURCES.md § ${id} — colophon fence is missing ${missing.join(", ")} ` +
        `(needs ${FIELDS.join(", ")}, or a single \`not-credited: <reason>\`)`,
    );
    continue;
  }
  if (declared.has(row.href)) {
    problems.push(`SOURCES.md — two entries declare the same colophon href: ${row.href}`);
    continue;
  }
  declared.set(row.href, { id, row });

  const claim = NON_COMMERCIAL.find((re) => re.test(row.licence));
  if (claim && row["commercial-use"] !== "restricted") {
    problems.push(
      `SOURCES.md § ${id} — the colophon line claims non-commercial terms (matched ${claim}):\n` +
        `      ${row.licence}\n` +
        `      This is the defect the gate was written for: «غير التجاري» is the Libyan\n` +
        `      Endowments Qālūn edition's term, and it was once carried over to the KFGQPC\n` +
        `      artwork, which permits digital and commercial use and reserves only printing.\n` +
        `      If this source really is non-commercial, record that decision in the fence:\n` +
        `        commercial-use: restricted`,
    );
  }
}

// Every rendered row must be a declared row, and every declared row rendered.
const rendered = new Map();
for (const row of credits) {
  if (!row.href) {
    problems.push(`Colophon.tsx — a CREDITS row has no href: ${JSON.stringify(row)}`);
    continue;
  }
  if (rendered.has(row.href)) problems.push(`Colophon.tsx — duplicate CREDITS href: ${row.href}`);
  rendered.set(row.href, row);
}

for (const [href, { id, row }] of declared) {
  const shown = rendered.get(href);
  if (!shown) {
    problems.push(
      `SOURCES.md § ${id} declares a colophon row the app never shows (href ${href}). ` +
        `Add it to CREDITS in Colophon.tsx, or declare \`not-credited: <reason>\`.`,
    );
    continue;
  }
  for (const f of FIELDS) {
    if (shown[f] !== row[f]) {
      problems.push(
        `${id} — colophon \`${f}\` differs between the record and the screen:\n` +
          `      SOURCES.md:   ${row[f]}\n` +
          `      Colophon.tsx: ${shown[f]}`,
      );
    }
  }
}

for (const href of rendered.keys()) {
  if (!declared.has(href)) {
    problems.push(
      `Colophon.tsx credits ${href}, which no SOURCES.md entry declares. ` +
        `The app may not tell a reader about a source the record does not cover.`,
    );
  }
}

if (problems.length > 0) {
  console.error("gate:license-copy — FAIL:");
  for (const p of problems) console.error("  -", p);
  process.exit(1);
}

const silent = [...declarations].filter(([, r]) => r["not-credited"]).map(([id]) => id);
console.log(
  `gate:license-copy — OK (${declared.size} credited row(s) match SOURCES.md` +
    (silent.length > 0 ? `; not credited by declaration: ${silent.join(", ")}` : "") +
    ")",
);
