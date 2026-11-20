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
import { join, relative } from "node:path";
import { parse } from "@messageformat/parser";

// HIFTH_GATE_ROOT points gate:i18n (and the build it compares against) at a
// made-up tree, so a test can feed it catalogs it must refuse and ones it must
// pass (scripts/gate-fixture.mjs). Unset, it is the repository, as always.
export const ROOT = process.env.HIFTH_GATE_ROOT
  ? process.env.HIFTH_GATE_ROOT.replace(/\/?$/, "/")
  : new URL("..", import.meta.url).pathname;
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
export function localeIds(dir = MESSAGES_DIR) {
  const ids = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length))
    .sort();
  if (!ids.includes(REFERENCE)) {
    throw new Error(`${relative(ROOT, dir)}/: the reference locale ${REFERENCE}.json is missing`);
  }
  return ids;
}

/** One locale's catalog: flat key → ICU MessageFormat source. */
export function readCatalog(id, dir = MESSAGES_DIR) {
  return JSON.parse(readFileSync(join(dir, `${id}.json`), "utf8"));
}

/**
 * The word packs: each folder in messages/ holding catalogs of its own.
 *
 * The catalogs in messages/ itself are the words every reader downloads when
 * the app opens. A pack is words only one late-loading part of the app reads,
 * such as the account section (sign-in ⑳, docs/design/sign-in.md): it compiles
 * to files of its own in its folder, fetched when that part asks for them, so
 * they cost the start-up download nothing. Every pack must carry the same
 * languages as the start-up words, and no key may live in two places.
 */
export function packNames() {
  return readdirSync(MESSAGES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^[a-z][a-z0-9-]*$/.test(d.name))
    .map((d) => d.name)
    .filter((name) => readdirSync(join(MESSAGES_DIR, name)).some((f) => f.endsWith(".json")))
    .sort();
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

/** Where a pack's catalogs live, as the banner names them. No pack: the start-up words. */
const sourceOf = (pack) => `apps/web/src/messages/${pack ? `${pack}/` : ""}*.json`;

const BANNER = (what, pack = null) =>
  `/* GENERATED — do not edit. ${what}\n` +
  ` * Source: ${sourceOf(pack)}. Regenerate: \`pnpm i18n:build\`.\n` +
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
export function emitCatalogType(analyses, pack = null) {
  const reference = analyses.find((a) => a.locale === REFERENCE);
  const lines = [
    BANNER(`The shape every locale must fill. Keys from ${REFERENCE}.json.`, pack),
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
export function emitLocale(analysis, pack = null) {
  const entries = [];
  for (const key of [...analysis.asts.keys()].sort()) {
    const used = new Set();
    const body = expr(analysis.asts.get(key), used);
    const member = IDENT.test(key) ? key : JSON.stringify(key);
    entries.push(used.size > 0 ? `  ${member}: (d) => ${body},` : `  ${member}: ${body},`);
  }
  // Import only the helpers the words call. A pack of plain sentences (the
  // account section's, sign-in ⑳) calls neither, and the lint check refuses
  // an unused import.
  const code = entries.join("\n");
  const helpers = ["plural", "select"].filter((name) => new RegExp(`\\b${name}\\(`).test(code));
  const lines = [BANNER(`The ${analysis.locale} chrome, compiled from ICU MessageFormat.`, pack), ""];
  if (helpers.length) lines.push(`import { ${helpers.join(", ")} } from "${pack ? "../" : "./"}plural";`);
  lines.push('import type { Catalog } from "./catalog.gen";', "");
  if (/\bLC\b/.test(code)) {
    lines.push(
      "/** The tag Intl.PluralRules resolves its CLDR categories from. */",
      `const LC = ${JSON.stringify(analysis.locale)};`,
      "",
    );
  }
  lines.push("const messages: Catalog = {", ...entries, "};", "", "export default messages;", "");
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
 * Without this, `i18n.tsx` would carry `import("./messages/ar.gen")` once
 * per language, and adding Urdu would mean remembering to add a line to a file
 * that has nothing to do with Urdu. Forgetting it would not be a compile error —
 * `Record<Lang, …>` would catch a missing *row*, but only if somebody wrote the
 * row's key, and the whole point is that they might not. Here the list is
 * derived from the catalogs, so it cannot be forgotten.
 */
export function emitRegistry(ids, pack = null) {
  const why = pack
    ? "/** Dynamic imports: this pack's words are read only by a part of the app\n" +
      " *  that loads late, so they are fetched when it asks for them and never\n" +
      " *  with the words every reader downloads at start-up. The service worker\n" +
      " *  precaches every one, so they work offline. */\n"
    : "/** Dynamic imports, not static: each language is its own file, so a reader\n" +
      " *  downloads only the one they read in (the two together were ~10 KB gz of\n" +
      " *  start-up code). The one they open in is fetched before the first paint:\n" +
      " *  index.html asks for it up front and main.tsx waits for it. The service\n" +
      " *  worker precaches every one, so switching works offline. */\n";
  return (
    BANNER("Every locale's compiled catalog, keyed by id, each loaded on demand.", pack) +
    "\n" +
    'import type { Catalog } from "./catalog.gen";\n' +
    `import type { LocaleId } from "${pack ? "../" : "./"}locales.gen";\n` +
    "\n" +
    why +
    "export const CATALOG_LOADERS: Readonly<\n" +
    "  Record<LocaleId, () => Promise<{ default: Catalog }>>\n" +
    "> = {\n" +
    ids.map((i) => `  ${i}: () => import("./${localeFile(i, pack)}"),`).join("\n") +
    "\n};\n"
  );
}

/**
 * A locale's compiled module, without its `.ts`. A pack's carries the pack's
 * name (`account.en.gen`), so its built file can never be taken for the
 * start-up words' `en.gen`, which the size check and the up-front fetch in
 * index.html both find by name.
 */
const localeFile = (id, pack) => (pack ? `${pack}.${id}.gen` : `${id}.gen`);

/** One set of catalogs, read and parsed: the start-up words (`pack: null`) or one pack. */
function readPack(pack) {
  const dir = pack ? join(MESSAGES_DIR, pack) : MESSAGES_DIR;
  const label = (id) => `${pack ? `${pack}/` : ""}${id}.json`;
  const ids = localeIds(dir);
  const analyses = new Map();
  const problems = [];
  for (const id of ids) {
    const a = analyse(readCatalog(id, dir), id);
    problems.push(...a.problems.map((p) => `${label(id)} — ${p}`));
    analyses.set(id, a);
  }
  return { pack, dir, label, ids, analyses, problems };
}

/**
 * Everything the generator writes, as `path → contents`.
 *
 * `ids` and `analyses` are the start-up words'; `packs` is every set,
 * start-up words first, which is what `gate:i18n` runs its checks over.
 */
export function compileAll() {
  const packs = [readPack(null), ...packNames().map(readPack)];
  const [main] = packs;
  const { ids, analyses } = main;
  const problems = packs.flatMap((p) => p.problems);

  for (const p of packs.slice(1)) {
    // The loaders are typed by the start-up words' languages, so a pack with
    // another set would not compile; say which file is missing or extra.
    for (const id of ids) if (!p.ids.includes(id)) problems.push(`${p.label(id)} is missing: every pack carries every language`);
    for (const id of p.ids) if (!ids.includes(id)) problems.push(`${p.label(id)} has no ${id}.json beside the start-up words`);
  }
  // A key in two places is read from one and quietly stale in the other.
  const owner = new Map();
  for (const p of packs) {
    for (const key of p.analyses.get(REFERENCE)?.asts.keys() ?? []) {
      const before = owner.get(key);
      if (before) problems.push(`'${key}' is in both ${before} and ${p.label(REFERENCE)}; keep it in one`);
      else owner.set(key, p.label(REFERENCE));
    }
  }

  const files = new Map();
  if (problems.length === 0) {
    files.set(join(MESSAGES_DIR, "locales.gen.ts"), emitLocaleIds(ids));
    for (const p of packs) {
      files.set(join(p.dir, "catalog.gen.ts"), emitCatalogType([...p.analyses.values()], p.pack));
      files.set(join(p.dir, "catalogs.gen.ts"), emitRegistry(p.ids, p.pack));
      for (const id of p.ids) files.set(join(p.dir, `${localeFile(id, p.pack)}.ts`), emitLocale(p.analyses.get(id), p.pack));
    }
  }
  return { ids, analyses, files, problems, packs };
}
