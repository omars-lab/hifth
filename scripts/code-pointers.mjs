/**
 * Finding a named symbol in a file, and refusing to find it when it is not
 * really there.
 *
 * Two documents in this repo point at code — docs/map.json ("where do I change
 * this?") and docs/use-cases.json ("what can someone do, and what proves it?")
 * — and both are only worth reading while their pointers are true. They are
 * checked the same way, so the checking lives here once. A second copy of this
 * logic is a second set of rules for what counts as a live pointer, and the
 * looser of the two would quietly become the one that matters.
 *
 * Two deliberate choices, inherited from the map gate that came first:
 *
 *   - Substring, not a parser. A gate that has to build the app to check a
 *     one-line invariant is a gate people route around. Coarse is fine: it
 *     catches the whole failure class — renames, deletions, moves — for free.
 *   - No line numbers stored, ever. Line numbers are the fastest-rotting thing
 *     in any doc; every insertion above invalidates them and nothing fails.
 *     Callers compute them at print time, so a printed `file:line` is true when
 *     you read it and is never written down to become false.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const ROOT = new URL("..", import.meta.url).pathname;

/**
 * Prefer a line that looks like a definition. "First line containing it" is not
 * good enough — in a TS file that is usually the import, and in a
 * well-commented one it is the docblock that mentions it. Sending a reader to
 * an import line is a small betrayal of the whole point.
 */
const DEFINITION = (s) =>
  new RegExp(
    `(export\\s+)?(async\\s+)?(function|class|const|let|interface|type|enum)\\s+${s}\\b|^\\s*${s}\\s*[(<:=]`,
  );
const IS_IMPORT = /^\s*(import|export)\s.*\bfrom\s|^\s*import\s*\(/;
const IS_COMMENT = /^\s*(\*|\/\/|#|<!--)/;

/**
 * Where `symbol` currently lives in `file`, or why it does not.
 *
 * A symbol that survives only inside a comment is a stale pointer wearing a
 * disguise, and the first draft of the code map had one: it sent readers to
 * highlighter.ts for `navigateTo`, which lives in PageStage and is merely
 * MENTIONED in a docblock there. A plain substring check passed it. Requiring
 * at least one occurrence in real code closes that.
 *
 * @returns {{ok: true, line: number} | {ok: false, why: string}}
 */
export function locate(file, symbol) {
  const abs = join(ROOT, file);
  if (!existsSync(abs)) return { ok: false, why: `file does not exist` };
  const lines = readFileSync(abs, "utf8").split("\n");

  const hits = [];
  lines.forEach((l, i) => l.includes(symbol) && hits.push({ i, l }));
  if (hits.length === 0) return { ok: false, why: `no line contains "${symbol}"` };

  const code = hits.filter((h) => !IS_COMMENT.test(h.l));
  if (code.length === 0) {
    return {
      ok: false,
      why: `"${symbol}" appears only in comments here — the code moved and the doc did not`,
    };
  }

  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const def = DEFINITION(escaped);
  const best =
    code.find((h) => !IS_IMPORT.test(h.l) && def.test(h.l)) ??
    code.find((h) => !IS_IMPORT.test(h.l)) ??
    code[0];
  return { ok: true, line: best.i + 1 };
}

/**
 * Where a test with this exact title is declared.
 *
 * Deliberately stricter than `locate`: the title must sit on a line that opens
 * a test — `test(`, `it(`, or a template-literal title inside one. A use case
 * whose proof is a string that merely appears somewhere in a spec file is not
 * proven; it is adjacent to a proof. The quoting is checked too, because a
 * title that has drifted by one word is exactly the drift worth catching, and
 * it is invisible to a substring search for the shared prefix.
 *
 * @returns {{ok: true, line: number} | {ok: false, why: string}}
 */
export function locateTest(file, title) {
  const abs = join(ROOT, file);
  if (!existsSync(abs)) return { ok: false, why: `spec file does not exist` };
  const lines = readFileSync(abs, "utf8").split("\n");

  const quoted = [`"${title}"`, `'${title}'`, `\`${title}\``];
  const opensATest = /\b(test|it)(\.\w+)*\s*\(\s*$|\b(test|it)(\.\w+)*\s*\(\s*["'`]/;

  for (let i = 0; i < lines.length; i++) {
    if (!quoted.some((q) => lines[i].includes(q))) continue;
    // The title may be on the `test(` line or wrapped onto the next one by the
    // formatter, which is common here because these titles are sentences.
    if (opensATest.test(lines[i]) || (i > 0 && opensATest.test(lines[i - 1]))) {
      return { ok: true, line: i + 1 };
    }
    return {
      ok: false,
      why: `"${title}" appears in this file but not as a test title — a proof has to be a test`,
    };
  }
  return { ok: false, why: `no test in this file is titled "${title}"` };
}
