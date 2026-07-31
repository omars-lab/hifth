#!/usr/bin/env node
/**
 * CI gate: the link grammar the code implements is the one the catalog documents.
 *
 * Hifth has no server and no session store — the URL is the whole of the app's
 * state. That makes the query grammar a public interface: a teacher's link has
 * to keep working, and «what happens when this value is wrong» is part of the
 * contract, not an implementation detail. It is also exactly the kind of thing
 * that rots quietly. A key added to `parseHash` and not to `serializeState` is a
 * parameter that can be read and never written; a key documented as rejecting
 * that in fact falls back is a promise about corrupt links that nothing keeps.
 *
 * So the three statements are bound together:
 *
 *   1. `parseHash` reads a key ⇔ `serializeState` writes it ⇔ the catalog has a
 *      row for it.
 *   2. The catalog's failure-mode column matches the code: a key whose parse
 *      branch can `return null` is `reject`, one that cannot is `fall back`.
 *   3. Every field id in core's `FIELDS` has a CSS block, a documented row, and
 *      the same colours in both — and every block names an ink, because a field
 *      is a wash *and* the ink that survives it (packages/core/src/field.ts).
 *   4. The token layer's own default wash *is* `DEFAULT_FIELD`'s block. The
 *      document is painted from `tokens.css` before `field.css` is parsed, so a
 *      drift between the two is a desk that changes colour during load — and it
 *      would show on exactly one frame, which is to say in no test anyone runs
 *      by hand.
 *
 * This reads the sources as text on purpose. Importing them would prove the
 * modules load, not that the doc describes them, and the CSS is not importable
 * from node at all.
 *
 * Run: `pnpm gate:params` (also in `pnpm gates`, `make ci` and CI).
 */
import { readFileSync } from "node:fs";

const ROUTER = "packages/core/src/router.ts";
const FIELD_TS = "packages/core/src/field.ts";
const FIELD_CSS = "apps/web/src/styles/field.css";
const TOKENS = "apps/web/src/styles/tokens.css";
const DOC = "docs/query-params.md";

const problems = [];
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const router = read(ROUTER);
const fieldTs = read(FIELD_TS);
const fieldCss = read(FIELD_CSS);
const tokens = read(TOKENS);
const doc = read(DOC);

/* ---- 1. what the code reads, writes, and refuses ------------------------- */

/** The body of `if (params.has("k")) { … }`, by brace matching from the `{`. */
function parseBranches(src) {
  const out = new Map();
  const re = /if \(params\.has\("([^"]+)"\)\) \{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    let depth = 0;
    let i = re.lastIndex - 1;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}" && --depth === 0) break;
    }
    out.set(m[1], src.slice(re.lastIndex, i));
  }
  return out;
}

const branches = parseBranches(router);
const parsed = new Set(branches.keys());
const written = new Set([...router.matchAll(/q\.push\(`([a-z]+)=/g)].map((m) => m[1]));
// A key that cannot refuse the link is a key that falls back.
const tolerant = new Set([...branches].filter(([, body]) => !/return null/.test(body)).map(([k]) => k));

if (parsed.size === 0) {
  problems.push(`${ROUTER} — found no \`params.has("…")\` branches. Has parseHash been rewritten?`);
}

/* ---- 2. what the catalog says -------------------------------------------- */

/** Rows of the first markdown table whose header cell 0 is `head`. */
function table(md, head) {
  const rows = [];
  let inside = false;
  for (const line of md.split("\n")) {
    const cells = line.trim().startsWith("|")
      ? line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim())
      : null;
    if (!cells) {
      if (inside) break;
      continue;
    }
    if (!inside) {
      if (cells[0] === head) inside = true;
      continue;
    }
    if (/^-+$/.test(cells[0].replace(/[:\s]/g, "") || "-")) continue;
    rows.push(cells);
  }
  return rows;
}

const unbacktick = (s) => s.replace(/^`|`$/g, "");
const paramRows = table(doc, "Key").filter((r) => r[0].startsWith("`"));
const documented = new Map(paramRows.map((r) => [unbacktick(r[0]), r[4]]));

const MODES = new Set(["reject", "fall back"]);
for (const [key, mode] of documented) {
  if (!MODES.has(mode)) {
    problems.push(
      `${DOC} — \`${key}\` declares failure mode "${mode}"; it must be one of ${[...MODES].map((m) => `"${m}"`).join(" or ")}.`,
    );
  }
}

for (const key of parsed) {
  if (!documented.has(key)) {
    problems.push(`${ROUTER} parses \`${key}=\`, which ${DOC} does not document. Add its row.`);
  }
  if (!written.has(key)) {
    problems.push(
      `${ROUTER} parses \`${key}=\` but serializeState never emits it — the parameter can be read and never shared.`,
    );
  }
}
for (const key of written) {
  if (!parsed.has(key)) {
    problems.push(
      `${ROUTER} emits \`${key}=\` but parseHash never reads it — links carry a value that restores nothing.`,
    );
  }
}
for (const key of documented.keys()) {
  if (!parsed.has(key)) {
    problems.push(`${DOC} documents \`${key}=\`, which ${ROUTER} does not parse.`);
  }
}

for (const [key, mode] of documented) {
  if (!parsed.has(key) || !MODES.has(mode)) continue;
  const actual = tolerant.has(key) ? "fall back" : "reject";
  if (actual !== mode) {
    problems.push(
      `\`${key}=\` is documented as "${mode}" and behaves as "${actual}".\n` +
        `      A branch in parseHash that can \`return null\` refuses the whole link;\n` +
        `      one that cannot drops the value and lets the link stand. Fix whichever is wrong —\n` +
        `      and if the code is right, the argument for the change belongs in ${DOC}.`,
    );
  }
}

/* ---- 3. the fields: one list, three renderings --------------------------- */

const fieldsDecl = /export const FIELDS: readonly FieldId\[\] = \[([^\]]*)\]/.exec(fieldTs);
if (!fieldsDecl) {
  problems.push(`${FIELD_TS} — could not read the FIELDS array; this gate needs it verbatim.`);
}
const fields = fieldsDecl ? [...fieldsDecl[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];

const cssBlocks = new Map();
for (const m of fieldCss.matchAll(/:root\[data-field="([^"]+)"\]\s*\{([^}]*)\}/g)) {
  const decl = Object.fromEntries(
    [...m[2].matchAll(/(--[a-z-]+):\s*([^;]+);/g)].map((d) => [d[1], d[2].trim()]),
  );
  cssBlocks.set(m[1], decl);
}

const docFields = new Map(
  table(doc, "id")
    .filter((r) => r[0].startsWith("`"))
    .map((r) => [unbacktick(r[0]), r]),
);

for (const id of fields) {
  const css = cssBlocks.get(id);
  if (!css) {
    problems.push(`${FIELD_CSS} has no \`:root[data-field="${id}"]\` block, but core lists it.`);
  }
  if (!docFields.has(id)) {
    problems.push(`${DOC} has no row for the field \`${id}\`, but core lists it.`);
  }
  if (!css || !docFields.has(id)) continue;

  for (const prop of ["--field-near", "--field-far", "--ink-on-field"]) {
    if (!css[prop]) {
      problems.push(
        `${FIELD_CSS} — \`${id}\` does not set ${prop}. A field is a wash *and* the ink that\n` +
          `      survives it; a block missing one of the three is half a decision.`,
      );
    }
  }

  const row = docFields.get(id);
  const [near, far] = [...row[1].matchAll(/`(#[0-9a-f]{6})`/gi)].map((m) => m[1].toLowerCase());
  const ink = unbacktick(row[2]);
  const declaredInk = (css["--ink-on-field"] ?? "").replace(/^var\(|\)$/g, "");
  if (css["--field-near"] && near !== css["--field-near"].toLowerCase()) {
    problems.push(`\`${id}\` near stop: ${DOC} says ${near}, ${FIELD_CSS} says ${css["--field-near"]}.`);
  }
  if (css["--field-far"] && far !== css["--field-far"].toLowerCase()) {
    problems.push(`\`${id}\` far stop: ${DOC} says ${far}, ${FIELD_CSS} says ${css["--field-far"]}.`);
  }
  if (css["--ink-on-field"] && ink !== declaredInk) {
    problems.push(`\`${id}\` ink: ${DOC} says ${ink}, ${FIELD_CSS} says ${css["--ink-on-field"]}.`);
  }
}

for (const id of cssBlocks.keys()) {
  if (!fields.includes(id)) {
    problems.push(
      `${FIELD_CSS} styles \`data-field="${id}"\`, which is not in FIELDS — no link can ever select it.`,
    );
  }
}
for (const id of docFields.keys()) {
  if (!fields.includes(id)) {
    problems.push(`${DOC} documents the field \`${id}\`, which is not in FIELDS.`);
  }
}

/* ---- 4. the token layer paints the default, one frame early ---------------- */

const defaultDecl = /export const DEFAULT_FIELD: FieldId = "([^"]+)"/.exec(fieldTs);
if (!defaultDecl) {
  problems.push(`${FIELD_TS} — could not read DEFAULT_FIELD; this gate needs it verbatim.`);
} else if (!fields.includes(defaultDecl[1])) {
  problems.push(`${FIELD_TS} — DEFAULT_FIELD is \`${defaultDecl[1]}\`, which is not in FIELDS.`);
} else {
  const dflt = cssBlocks.get(defaultDecl[1]) ?? {};
  for (const prop of ["--field-near", "--field-far", "--ink-on-field"]) {
    const found = [...tokens.matchAll(new RegExp(`${prop}:\\s*([^;]+);`, "g"))].map((m) => m[1].trim());
    if (found.length !== 1) {
      problems.push(
        `${TOKENS} declares ${prop} ${found.length} time(s); this gate reads exactly one, ` +
          `because the default desk has to be one colour.`,
      );
      continue;
    }
    if (dflt[prop] && found[0].toLowerCase() !== dflt[prop].toLowerCase()) {
      problems.push(
        `${prop}: ${TOKENS} says ${found[0]}, but \`${defaultDecl[1]}\` (DEFAULT_FIELD) says ${dflt[prop]}.\n` +
          `      The document is painted from tokens.css before field.css is parsed, so these\n` +
          `      disagreeing means the desk changes colour on the first frame.`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error("gate:params — FAIL:");
  for (const p of problems) console.error("  -", p);
  process.exit(1);
}

console.log(
  `gate:params — OK (${documented.size} parameter(s): ` +
    `${[...documented].map(([k, m]) => `${k}=${m === "reject" ? "strict" : "lenient"}`).join(", ")}; ` +
    `${fields.length} field(s) in step across core, CSS and the catalog, ` +
    `default \`${defaultDecl?.[1] ?? "?"}\` painted by the token layer)`,
);
