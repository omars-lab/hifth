#!/usr/bin/env node
/**
 * CI gate: the message catalogs.
 *
 * `tsc` is the first and strongest lock — every locale's compiled module is
 * declared `const messages: Catalog`, so a missing key, an extra key or a
 * mistyped argument is a build error, and there is no runtime lookup that could
 * fall back to another language's words. This gate covers the four things the
 * compiler cannot see, each of which would otherwise be a silently slightly-off
 * sentence rather than a failure:
 *
 *   1. **Stale generated code.** `tsc` only ever reads the committed `.gen.ts`
 *      files. A catalog edited without running `pnpm i18n:build` typechecks
 *      perfectly and ships the old words. Same discipline as the ETL-output
 *      check: regenerate into memory, compare byte-for-byte.
 *   2. **A key the reference has and a locale does not.** `Catalog` is derived
 *      *from* the catalogs, so deleting a key everywhere is self-consistent and
 *      compiles. The reference locale is what says which keys must exist.
 *   3. **An incomplete plural.** Arabic has six CLDR categories. A message that
 *      writes four of them compiles, and then renders `other` where the language
 *      wanted `few` — the exact failure the hand-written ternary had. Checked
 *      against `Intl.PluralRules(locale)`, i.e. against the same CLDR the
 *      runtime will use, not against a table in this repo.
 *   4. **A dropped placeholder.** A translation that omits `{label}` is a
 *      sentence missing the thing it is about, and it is still a valid ICU
 *      message. So a locale must use every argument the reference uses.
 *
 * docs/design/i18n.md §④.
 */
import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { REFERENCE, ROOT, compileAll } from "./messages-compile.mjs";

const problems = [];
const rel = (p) => relative(ROOT, p);

const { ids, files, packs, problems: parseProblems } = compileAll();
problems.push(...parseProblems);

/* 1 — the committed generated code is what the catalogs compile to. */
for (const [path, contents] of files) {
  if (!existsSync(path)) {
    problems.push(`${rel(path)} is missing — run \`pnpm i18n:build\``);
  } else if (readFileSync(path, "utf8") !== contents) {
    problems.push(`${rel(path)} is stale — run \`pnpm i18n:build\` and commit the result`);
  }
}

/* 2 to 4 run over every set of catalogs: the start-up words and each pack
 * (messages-compile.mjs, `packNames`). `label` names the file, pack and all. */
for (const { ids, analyses, label } of packs) {

/* 2 — every locale carries exactly the reference's keys. */
const reference = analyses.get(REFERENCE);
if (reference) {
  const want = new Set(reference.asts.keys());
  for (const id of ids) {
    if (id === REFERENCE) continue;
    const have = new Set(analyses.get(id).asts.keys());
    for (const key of want) {
      if (!have.has(key)) problems.push(`${label(id)} — missing key '${key}' (it is in ${label(REFERENCE)})`);
    }
    for (const key of have) {
      if (!want.has(key)) {
        problems.push(
          `${label(id)} — key '${key}' is not in ${label(REFERENCE)}. A key no other locale ` +
            `has is a key no component reads; add it to ${label(REFERENCE)} first.`,
        );
      }
    }
  }
}

/* 3 — every plural covers every category its own language actually has. */
for (const id of ids) {
  const categories = new Set(new Intl.PluralRules(id).resolvedOptions().pluralCategories);
  for (const [at, cases] of analyses.get(id).plurals) {
    // ICU `=0` is an exact match, not a category: extra, never a substitute.
    const named = new Set(cases.filter((c) => !c.startsWith("=")));
    const missing = [...categories].filter((c) => !named.has(c));
    if (missing.length > 0) {
      problems.push(
        `${label(id)} — ${at} handles [${[...named].join(", ")}] but ${id} has ` +
          `[${[...categories].join(", ")}]; missing ${missing.join(", ")}. An unhandled ` +
          `category falls to 'other', which is how «١٠٣ صفحة» happened.`,
      );
    }
    const dead = [...named].filter((c) => c !== "other" && !categories.has(c));
    if (dead.length > 0) {
      problems.push(`${label(id)} — ${at} has case(s) ${dead.join(", ")}, which ${id} never selects`);
    }
  }
}

/* 4 — a select branches the same ways everywhere, and nobody drops an argument. */
if (reference) {
  for (const id of ids) {
    if (id === REFERENCE) continue;
    const here = analyses.get(id);

    for (const [at, cases] of reference.selects) {
      const mine = here.selects.get(at);
      if (!mine) {
        problems.push(`${label(id)} — ${at} is a select in ${label(REFERENCE)} and not here`);
      } else if ([...cases].sort().join("|") !== [...mine].sort().join("|")) {
        problems.push(
          `${label(id)} — ${at} offers [${mine.join(", ")}], ${label(REFERENCE)} offers ` +
            `[${cases.join(", ")}]. The caller passes one value; both must accept it.`,
        );
      }
    }

    for (const [key, args] of reference.args) {
      const mine = here.args.get(key);
      if (!mine) continue; // already reported as a missing key
      for (const name of args.keys()) {
        if (!mine.has(name)) {
          problems.push(
            `${label(id)} — '${key}' never uses {${name}}, which ${label(REFERENCE)} does. ` +
              `A dropped placeholder is a sentence missing the thing it is about.`,
          );
        }
      }
    }
  }
}

} // every pack

/* A locale with a catalog but no row in LOCALES is a compile error, not this
 * gate's job — but a catalog `Intl` has never heard of is worth saying plainly,
 * because its plural rules would silently be the root locale's. */
for (const id of ids) {
  if (!Intl.PluralRules.supportedLocalesOf([id]).includes(id)) {
    problems.push(
      `${id}.json — the platform has no CLDR plural data for '${id}', so its plurals ` +
        `would resolve against the default locale. Use a tag Intl recognises.`,
    );
  }
}

if (problems.length > 0) {
  for (const p of problems) console.error(`  ${p}`);
  console.error(`gate:i18n — FAIL: ${problems.length} problem(s)`);
  process.exit(1);
}

// "3 messages at start-up + 41 in account": the start-up words first, then each pack.
const sizes = packs.map((p) => `${p.analyses.get(REFERENCE)?.asts.size ?? 0} ${p.pack ? `in ${p.pack}` : "messages at start-up"}`);
console.log(`gate:i18n — OK (${ids.length} locales × ${sizes.join(" + ")}, generated code in step)`);
