/**
 * The message compiler: ICU MessageFormat in, TypeScript out.
 *
 * The library in this repo's i18n stack is ICU MessageFormat, and this file is
 * where it lives. `@messageformat/parser` — the reference ICU parser — is a
 * **devDependency**: it runs here, at build time, and ships zero bytes. What the
 * bundle receives is plain string concatenation plus one 12-line helper over the
 * browser's own `Intl.PluralRules` — +180 bytes gzipped for the machinery, and
 * +1.8 KB for the whole migration. The runtime alternatives were 9.3–25.2 KB on
 * top of the same catalogs. docs/design/i18n.md §③ has both tables.
 *
 * Two things the emitter refuses, and both refusals are the point:
 *
 *   - **`#` and `{n, number}`.** Both route a number through `Intl.NumberFormat`,
 *     which is a *second* numeral authority with different answers than
 *     `format.ts`'s `digits()` — `Intl.NumberFormat("ar").format(1000)` is
 *     «١٬٠٠٠» with a U+066C separator, `digits(1000, "ar")` is «١٠٠٠». Two
 *     authorities for numerals is how «٣» to the eye and "three" to a screen
 *     reader happened the first time. So a plural message takes the number to
 *     select on AND the already-formatted digits to print: `{n}` and `{nText}`
 *     (`{count}`/`{countText}`, `{ayahs}`/`{ayahsText}` — same convention,
 *     named after the thing being counted).
 *   - **`offset:`.** It only earns its keep with `#`, which is rejected above.
 *
 * Exported as a module rather than a script so `gate-i18n.mjs` can compile into
 * memory and compare against what is committed — the check that stops a catalog
 * being edited without `pnpm i18n:build`.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "@messageformat/parser";

export const ROOT = new URL("..", import.meta.url).pathname;
export const MESSAGES_DIR = join(ROOT, "apps", "web", "src", "messages");

/**
 * The locale every other locale is measured against.
 *
 * Arabic, because it is the app's native tongue, the wording every aria snapshot
 * in e2e/__aria__ was recorded against, and the richest plural system in the set
 * — a message expressible in `ar` is expressible anywhere. See design §⑨ for the
 * cost of that choice.
 */
export const REFERENCE = "ar";

/** The locales that exist, discovered from the catalogs themselves. */
export function localeIds() {
  const ids = readdirSync(MESSAGES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length))
    .sort();
  if (!ids.includes(REFERENCE)) {
    throw new Error(`messages/: the reference locale ${REFERENCE}.json is missing`);
  }
  return ids;
}

/** One locale's catalog: flat key → ICU MessageFormat source. */
export function readCatalog(id) {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, `${id}.json`), "utf8"));
}

/* -------------------------------------------------------------------------- */
/* Parsing: the AST, the arguments it needs, and the two rejections            */
/* -------------------------------------------------------------------------- */

const IDENT = /^[A-Za-z][A-Za-z0-9]*$/;

/**
 * Walk one message's tokens, recording every argument and its kind.
 *
 * `kinds` is keyed by argument name: "number" for a plural selector, "select"
 * for a select selector (carrying its case keys), "text" for a plain
 * interpolation. An argument used two ways in one message is a mistake worth
 * failing on — it means the message is asking for two different things from one
 * name.
 */
function collect(tokens, key, args, problems) {
  for (const tok of tokens) {
    switch (tok.type) {
      case "content":
        break;
      case "octothorpe":
        problems.push(
          `${key}: '#' is not supported. It formats through Intl.NumberFormat, which ` +
            `disagrees with format.ts's digits(). Pass the formatted digits as a ` +
            `separate argument (by convention {nText}) and select on {n}.`,
        );
        break;
      case "argument":
        note(args, tok.arg, { kind: "text" }, key, problems);
        break;
      case "function":
        problems.push(
          `${key}: {${tok.arg}, ${tok.key}} — formatting functions are not supported. ` +
            `Numerals come from format.ts (design §⑥); dates and currencies do not ` +
            `exist in this app (design §⑧).`,
        );
        break;
      case "plural":
      case "selectordinal":
        if (tok.pluralOffset) {
          problems.push(`${key}: 'offset:' is not supported — it only earns its keep with '#'.`);
        }
        note(args, tok.arg, { kind: "number" }, key, problems);
        for (const c of tok.cases) collect(c.tokens, key, args, problems);
        break;
      case "select":
        note(
          args,
          tok.arg,
          { kind: "select", cases: tok.cases.map((c) => c.key) },
          key,
          problems,
        );
        for (const c of tok.cases) collect(c.tokens, key, args, problems);
        break;
      default:
        problems.push(`${key}: unsupported token type '${tok.type}'`);
    }
  }
}

function note(args, name, info, key, problems) {
  if (!IDENT.test(name)) {
    problems.push(`${key}: argument '${name}' must be a plain identifier (it becomes a TS field)`);
    return;
  }
  const seen = args.get(name);
  if (seen && seen.kind !== info.kind) {
    problems.push(`${key}: argument '${name}' is used both as ${seen.kind} and as ${info.kind}`);
    return;
  }
  if (!seen) args.set(name, info);
}

/**
 * Parse a whole catalog. Returns `{ asts, args, plurals, selects, problems }`,
 * where `plurals` and `selects` are what `gate:i18n` checks across locales:
 * which categories a plural handles, and which cases a select offers.
 */
export function analyse(catalog, locale) {
  const asts = new Map();
  const args = new Map();
  const plurals = new Map();
  const selects = new Map();
  const problems = [];

  for (const [key, source] of Object.entries(catalog)) {
    if (typeof source !== "string") {
      problems.push(`${key}: catalogs are flat key → ICU string; got ${typeof source}`);
      continue;
    }
    let ast;
    try {
      ast = parse(source);
    } catch (err) {
      problems.push(`${key}: ${err.message}`);
      continue;
    }
    asts.set(key, ast);
    const keyArgs = new Map();
    collect(ast, key, keyArgs, problems);
    args.set(key, keyArgs);
    walkSelectors(ast, key, plurals, selects);
  }
  return { locale, asts, args, plurals, selects, problems };
}

/** Record every plural/select selector in the message, for the cross-locale checks. */
function walkSelectors(tokens, key, plurals, selects, path = "") {
  for (const tok of tokens) {
    if (tok.type === "plural" || tok.type === "selectordinal") {
      const at = `${key}${path}:${tok.arg}`;
      plurals.set(at, tok.cases.map((c) => c.key));
      for (const c of tok.cases) walkSelectors(c.tokens, key, plurals, selects, `${path}.${c.key}`);
    } else if (tok.type === "select") {
      const at = `${key}${path}:${tok.arg}`;
      selects.set(at, tok.cases.map((c) => c.key));
      for (const c of tok.cases) walkSelectors(c.tokens, key, plurals, selects, `${path}.${c.key}`);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Emitting                                                                    */
/* -------------------------------------------------------------------------- */

const BANNER = (what) =>
  `/* GENERATED — do not edit. ${what}\n` +
  ` * Source: apps/web/src/messages/*.json. Regenerate: \`pnpm i18n:build\`.\n` +
  ` * \`gate:i18n\` fails the build if this file and the catalogs disagree. */\n`;

function expr(tokens, usedArgs) {
  const parts = [];
  for (const tok of tokens) {
    switch (tok.type) {
      case "content":
        parts.push(JSON.stringify(tok.value));
        break;
      case "argument":
        usedArgs.add(tok.arg);
        parts.push(`d.${tok.arg}`);
        break;
      case "plural":
      case "selectordinal":
        usedArgs.add(tok.arg);
        parts.push(
          `plural(LC, d.${tok.arg}, {${tok.cases
            .map((c) => ` ${caseKey(c.key)}: ${expr(c.tokens, usedArgs)}`)
            .join(",")} })`,
        );
        break;
      case "select":
        usedArgs.add(tok.arg);
        parts.push(
          `select(d.${tok.arg}, {${tok.cases
            .map((c) => ` ${caseKey(c.key)}: ${expr(c.tokens, usedArgs)}`)
            .join(",")} })`,
        );
        break;
      default:
        throw new Error(`unreachable token ${tok.type}`);
    }
  }
  if (parts.length === 0) return '""';
  if (parts.length === 1) return parts[0].startsWith("d.") ? `String(${parts[0]})` : parts[0];
  return parts.join(" + ");
}

/** ICU's `=0` exact match becomes the property "0"; category names stay bare. */
function caseKey(key) {
  const k = key.startsWith("=") ? key.slice(1) : key;
  return IDENT.test(k) ? k : JSON.stringify(k);
}

function tsType(info) {
  if (info.kind === "number") return "number";
  if (info.kind === "select") return info.cases.map((c) => JSON.stringify(c)).join(" | ");
  return "string | number";
}

/**
 * The union of every locale's arguments for one key.
 *
 * Union, not "the reference locale's" — because a locale may legitimately need
 * an argument the reference does not. `legendCountOnPage` is the standing case:
 * Arabic writes «{nText} آية» with no agreement, English needs the *number* as
 * well so `{n, plural, …}` can choose between "ayah" and "ayahs". The caller
 * supplies every argument any locale asks for, which is the only rule under
 * which switching language cannot leave a hole in a sentence.
 *
 * The direction that is *not* permissive is checked by `gate:i18n`: a locale
 * that fails to use an argument the reference uses has dropped a placeholder,
 * and a dropped placeholder is a sentence missing the thing it is about.
 */
function unionArgs(analyses, key) {
  const merged = new Map();
  for (const a of analyses) {
    for (const [name, info] of a.args.get(key) ?? []) {
      const seen = merged.get(name);
      if (!seen) merged.set(name, info);
      else if (seen.kind === "select" && info.kind === "select") {
        merged.set(name, { kind: "select", cases: [...new Set([...seen.cases, ...info.cases])] });
      }
    }
  }
  return merged;
}

/**
 * The interface every locale's module is typed against.
 *
 * This is the whole completeness guarantee, and it is stricter than the hand
 * written `Strings` interface it replaces: that one could only see *that* a key
 * existed and how many arguments it took. This one sees the argument *names*, so
 * an `en` message that interpolates something no locale declares is a type error
 * on `d`, not a sentence with a hole in it at runtime. There is no lookup and no
 * fallback chain — a missing key cannot render another locale's words, because a
 * missing key does not compile.
 */
export function emitCatalogType(analyses) {
  const reference = analyses.find((a) => a.locale === REFERENCE);
  const lines = [
    BANNER(`The shape every locale must fill. Keys from ${REFERENCE}.json.`),
    "",
    "export interface Catalog {",
  ];
  for (const key of [...reference.asts.keys()].sort()) {
    const args = unionArgs(analyses, key);
    const member = IDENT.test(key) ? key : JSON.stringify(key);
    // A message with no arguments is a constant in every locale, so it is
    // emitted as one rather than as a thunk. Two thirds of the catalog is
    // constants; wrapping each in `() =>` and calling it back cost ~400 bytes
    // gzipped for nothing, and `gate:budget` is a real number.
    if (args.size === 0) {
      lines.push(`  readonly ${member}: string;`);
      continue;
    }
    const fields = [...args]
      .map(([name, info]) => `readonly ${name}: ${tsType(info)}`)
      .join("; ");
    lines.push(`  readonly ${member}: (d: { ${fields} }) => string;`);
  }
  lines.push("}", "");
  return lines.join("\n");
}

/** One locale's compiled module. Typed `Catalog`, so tsc is the first lock. */
export function emitLocale(analysis) {
  const lines = [
    BANNER(`The ${analysis.locale} chrome, compiled from ICU MessageFormat.`),
    "",
    'import { plural, select } from "./plural";',
    'import type { Catalog } from "./catalog.gen";',
    "",
    "/** The tag Intl.PluralRules resolves its CLDR categories from. */",
    `const LC = ${JSON.stringify(analysis.locale)};`,
    "",
    "const messages: Catalog = {",
  ];
  for (const key of [...analysis.asts.keys()].sort()) {
    const used = new Set();
    const body = expr(analysis.asts.get(key), used);
    const member = IDENT.test(key) ? key : JSON.stringify(key);
    lines.push(used.size > 0 ? `  ${member}: (d) => ${body},` : `  ${member}: ${body},`);
  }
  lines.push("};", "", "export default messages;", "");
  return lines.join("\n");
}

/** The locale ids, as a type. Adding a catalog makes `LOCALES` fail to compile. */
export function emitLocaleIds(ids) {
  return (
    BANNER("The locales that have a catalog.") +
    "\n" +
    "/**\n" +
    " * Discovered from apps/web/src/messages/*.json, so the directory is the single\n" +
    " * source of truth for which locales exist. `lang.ts` derives `Lang` from this\n" +
    " * and keys `LOCALES` by it — which is what makes a catalog dropped in without a\n" +
    " * direction, a self-name and a rule-name order a compile error rather than a\n" +
    " * locale that renders sideways.\n" +
    " */\n" +
    `export const LOCALE_IDS = [${ids.map((i) => JSON.stringify(i)).join(", ")}] as const;\n` +
    "\n" +
    "export type LocaleId = (typeof LOCALE_IDS)[number];\n"
  );
}

/**
 * The id → catalog map, generated so that nothing hand-written imports a locale
 * by name.
 *
 * Without this, `i18n.tsx` would carry `import ar from "./messages/ar.gen"` once
 * per language, and adding Urdu would mean remembering to add a line to a file
 * that has nothing to do with Urdu. Forgetting it would not be a compile error —
 * `Record<Lang, …>` would catch a missing *row*, but only if somebody wrote the
 * row's key, and the whole point is that they might not. Here the list is
 * derived from the catalogs, so it cannot be forgotten.
 */
export function emitRegistry(ids) {
  return (
    BANNER("Every locale's compiled catalog, keyed by id.") +
    "\n" +
    'import type { Catalog } from "./catalog.gen";\n' +
    'import type { LocaleId } from "./locales.gen";\n' +
    ids.map((i) => `import ${i} from "./${i}.gen";`).join("\n") +
    "\n\n" +
    "/** Static imports, not dynamic: the chrome is a few KB and must be on screen\n" +
    " *  at first paint, offline, with no request to wait on. */\n" +
    "export const CATALOGS: Readonly<Record<LocaleId, Catalog>> = {\n" +
    ids.map((i) => `  ${i},`).join("\n") +
    "\n};\n"
  );
}

/** Everything the generator writes, as `path → contents`. */
export function compileAll() {
  const ids = localeIds();
  const analyses = new Map();
  const problems = [];
  for (const id of ids) {
    const a = analyse(readCatalog(id), id);
    problems.push(...a.problems.map((p) => `${id}.json — ${p}`));
    analyses.set(id, a);
  }
  const files = new Map();
  if (problems.length === 0) {
    files.set(join(MESSAGES_DIR, "locales.gen.ts"), emitLocaleIds(ids));
    files.set(join(MESSAGES_DIR, "catalog.gen.ts"), emitCatalogType([...analyses.values()]));
    files.set(join(MESSAGES_DIR, "catalogs.gen.ts"), emitRegistry(ids));
    for (const id of ids) files.set(join(MESSAGES_DIR, `${id}.gen.ts`), emitLocale(analyses.get(id)));
  }
  return { ids, analyses, files, problems };
}
