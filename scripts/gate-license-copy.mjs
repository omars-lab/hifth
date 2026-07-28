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
import { FIELDS, readDeclarations, readCredits } from "./colophon-record.mjs";

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

const { declarations, problems: mdProblems } = readDeclarations();
const { credits, problems: tsxProblems } = readCredits();
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
