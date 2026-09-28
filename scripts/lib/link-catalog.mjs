/**
 * The parameter page (docs/query-params.md) as the one list of every link the
 * app answers to. `gate:params` already binds its key table to the code; these
 * two checks cover what that left loose:
 *
 *   - the Examples table: every link on it does what its row says, run through
 *     the app's own link reader, and every key has at least one;
 *   - the Settings table: the settings read before the `#` (so far `phonebar`)
 *     are listed, and every listed one is read.
 *
 * Kept apart from the gate so a test can hand it a made-up page and watch it
 * refuse (packages/etl/scripts/link-catalog.test.mjs).
 */

/** Rows of the first markdown table whose header cell 0 is `head`. */
export function table(md, head) {
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

export const unbacktick = (s) => s.replace(/^`|`$/g, "");

const keyedRows = (md, head) => table(md, head).filter((r) => r[0].startsWith("`"));

/**
 * What is wrong with the Examples table ("| Link | The app | … |"). The middle
 * cell says `opens` (the app opens it and writes it back unchanged), `opens as
 * `…`` (it opens and writes back that), or `refuses`.
 */
export function exampleProblems(md, { parseHash, serializeState }) {
  const problems = [];
  const keys = keyedRows(md, "Key").map((r) => unbacktick(r[0]));
  const examples = keyedRows(md, "Link").map((r) => [unbacktick(r[0]), r[1]]);
  if (examples.length === 0) {
    problems.push("there is no Examples table (a table headed `| Link | The app | … |`).");
  }

  for (const [link, claim] of examples) {
    const state = parseHash(link);
    const back = state ? serializeState(state) : null;
    const as = /^opens as `([^`]+)`$/.exec(claim);
    if (claim === "refuses") {
      if (state) problems.push(`\`${link}\` says it is refused, but the app opens it (as \`${back}\`).`);
    } else if (claim === "opens" || as) {
      const want = as ? as[1] : link;
      if (!state) problems.push(`\`${link}\` says it opens, but the app refuses it.`);
      else if (back !== want) problems.push(`\`${link}\` should come back as \`${want}\`, but the app writes it back as \`${back}\`.`);
    } else {
      problems.push(`\`${link}\` — "${claim}" is not one of: opens, opens as \`…\`, refuses.`);
    }
  }

  for (const key of keys) {
    if (!examples.some(([link]) => new RegExp(`[?&]${key}=`).test(link))) {
      problems.push(`\`${key}\` has no example. Add a link that uses it to the Examples table.`);
    }
  }
  return problems;
}

/**
 * What is wrong with the Settings table ("| Setting | … |"), given the app's
 * source files as { path: text }. A setting is read with
 * `new URLSearchParams(…).get("name")`.
 */
export function searchSettingProblems(md, sources) {
  const problems = [];
  const listed = new Set(keyedRows(md, "Setting").map((r) => unbacktick(r[0])));
  const read = new Set();
  for (const [path, text] of Object.entries(sources)) {
    for (const m of text.matchAll(/URLSearchParams\([^)]*\)\.get\("([^"]+)"\)/g)) {
      read.add(m[1]);
      if (!listed.has(m[1])) {
        problems.push(`${path} reads \`?${m[1]}=\` before the #, and the Settings table does not list it.`);
      }
    }
  }
  for (const name of listed) {
    if (!read.has(name)) problems.push(`\`${name}\` is in the Settings table, but nothing reads it.`);
  }
  return problems;
}
