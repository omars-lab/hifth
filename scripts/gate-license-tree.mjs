#!/usr/bin/env node
/**
 * CI gate: every third-party package that ships carries a permissive licence.
 *
 * WHY THIS EXISTS. Every other licence gate here is about vendored *data* —
 * `gate:license` on the page editions, `gate:license-copy` on the quotation the
 * colophon shows, `gate:notices` on the asset trees the ETL builds. The
 * installed package tree, the code that actually runs in the browser, was
 * checked by nobody but a hand audit. On 2026-08-16 that audit read all 565
 * installed packages across their twelve licence buckets and found them clean —
 * zero copyleft, zero source-available, zero unstated. A clean tree is the good
 * time to add the check, not the bad one: the gate that lands while the answer
 * is already "yes" is the gate that catches the day the answer changes, instead
 * of being written in a hurry the day it already has.
 *
 * WHAT "SHIPS" MEANS, AND WHY IT IS NOT "PRODUCTION DEPENDENCIES". The obvious
 * gate — walk `dependencies`, skip `devDependencies` — is wrong here, and wrong
 * in the direction that matters. `workbox-window` is declared for development
 * and ships anyway: `apps/web/src/pwa.ts` pulls it through the plugin's virtual
 * register module, so it is in the browser bundle while the manifest calls it a
 * build-time tool. And `idb` is declared by nothing in this repo at all, yet it
 * rides into the generated service worker because `workbox-expiration` reads it
 * and the page cache is expiry-bounded. A gate keyed on the prod/dev flag would
 * clear both. So this gate computes the ship set from the two channels the app
 * actually emits:
 *
 *   CHANNEL 1 — the browser bundle. Seeded from the workspace app's own runtime
 *   `dependencies` (minus the workspace-internal ones, which are ours and whose
 *   own upstreams are traced through the code that builds them), PLUS
 *   `workbox-window`, named here because it ships through the register shim
 *   though it is dev-declared. This is the record's first example, made a seed.
 *
 *   CHANNEL 2 — the service worker. `vite-plugin-pwa` runs `generateSW`, which
 *   inlines a subset of the workbox runtime family plus whatever those modules
 *   read. The seed is every `workbox-*` package that `workbox-build` itself
 *   lists as a dependency — the family the generator *can* bundle — and the
 *   closure below reaches the `idb` under `workbox-expiration`. The seed is
 *   named from `workbox-build`'s manifest, not discovered from the built bytes,
 *   because the service worker is assembled by the plugin's own build and so
 *   follows the plugin's version rather than this repo's. That makes it a
 *   deliberate superset: it vets a few runtime modules this config does not
 *   currently enable (background sync, broadcast update), which for a licence
 *   check can only over-report, never miss. A workbox major bump is the event
 *   that should re-open this seed, and this comment is where it says so.
 *
 * From each seed the ship set is the transitive closure over runtime
 * `dependencies` only — a package's own `devDependencies` are its build and test
 * tooling and do not ship.
 *
 * THE POLICY. A small allow-set of SPDX identifiers that are permissive or
 * public-domain-equivalent: they impose at most attribution, never a term that
 * reaches back into how this app is built or served. Everything else FAILS —
 * a copyleft or network-copyleft licence (GPL, AGPL, LGPL, MPL), a
 * source-available one (BSL, SSPL, Elastic), an unstated one, or one this file
 * has never seen. That is deliberate and is the gate-notices philosophy applied
 * to code: the next person who adds a dependency whose terms are not already
 * blessed is the one who has to say what they mean, by classifying it here on
 * purpose rather than having it slip in unread. An allow-set that grows only by
 * a considered edit cannot go quiet. (This app is itself GPL-3.0-or-later, so a
 * copyleft dependency is a licence-*compatibility* non-event — but compatibility
 * is not the question. The question is whether a term shipped that nobody chose,
 * and a licence nobody classified is exactly that whether it is compatible or
 * not.)
 *
 * WHAT IT DOES NOT SEE, said out loud. It reads each package's declared `license`
 * field and trusts it — it does not read the LICENSE file to catch a manifest
 * that lies. It resolves a dependency by name against the first version the
 * store yields, so a package installed at two versions with two different
 * licences is judged once; pnpm's own dedup makes that rare and the failure mode
 * is a miss, not a false alarm. It does not follow dynamic `require()` of a
 * computed path, and it treats the workspace's own packages as ours rather than
 * as inputs. The channel-2 seed's superset is stated above.
 *
 * PROVEN TO FAIL, 2026-09-03. A gate that has only ever passed is a comment, and
 * no gate here carries a unit test, so the tie was broken on purpose and
 * restored. Dropping "ISC" from ALLOW: "idb@7.1.1 ships in the service worker
 * and carries ISC, which is not on the allow-set" — the exact shape of the
 * thing this exists to catch, an undeclared package riding the worker with a
 * licence nobody classified. Restored. Also checked the empty-channel case: with
 * `workbox-build` absent the service-worker seed is empty and `idb` correctly
 * leaves the ship set, so the gate reports only the bundle — the PWA being
 * removed must not leave a phantom worker under review.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const STORE = join(ROOT, "node_modules", ".pnpm");

/**
 * SPDX identifiers that ship without a term reaching back into the build. The
 * only obligation any of these carries is attribution, which the colophon and
 * the shipped notices already discharge. Anything not here is a decision, not a
 * default — see the header.
 */
const ALLOW = new Set([
  "MIT",
  "MIT-0",
  "ISC",
  "0BSD",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "Apache-2.0",
  "BlueOak-1.0.0",
  "Unlicense",
  "Zlib",
  "CC0-1.0",
]);

/** Read a package's declared licence, normalising the shapes npm allows. */
function licenceOf(pkg) {
  let lic = pkg.license;
  if (!lic && pkg.licenses) {
    lic = Array.isArray(pkg.licenses)
      ? pkg.licenses.map((x) => x.type || x).join(" OR ")
      : pkg.licenses.type || pkg.licenses;
  }
  if (lic && typeof lic === "object") lic = lic.type || JSON.stringify(lic);
  return (lic || "UNSTATED").trim();
}

/**
 * Is this SPDX expression allowed? A disjunction passes if any branch does —
 * "(MIT OR GPL-3.0)" lets the taker choose MIT. A bare conjunction ("A AND B")
 * passes only if every branch does. Anything with a token off the allow-set,
 * and any expression this simple reader cannot split cleanly, fails closed.
 */
function allowed(expr) {
  const clean = expr.replace(/[()]/g, " ").trim();
  if (ALLOW.has(clean)) return true;
  if (/\bOR\b/i.test(clean)) {
    return clean.split(/\bOR\b/i).some((t) => allowed(t.trim()));
  }
  if (/\bAND\b/i.test(clean)) {
    return clean.split(/\bAND\b/i).every((t) => allowed(t.trim()));
  }
  return ALLOW.has(clean);
}

/**
 * Index the pnpm store by package name. The store lays each package out at
 * `.pnpm/<name>@<version>/node_modules/<name>` (scoped names keep the slash),
 * so one walk reads every installed package's manifest. First version seen wins
 * — the stated limit in the header.
 */
function indexStore() {
  const idx = new Map();
  if (!existsSync(STORE)) return idx;
  for (const entry of readdirSync(STORE)) {
    if (entry.startsWith(".")) continue;
    const inner = join(STORE, entry, "node_modules");
    if (!existsSync(inner)) continue;
    for (const top of readdirSync(inner)) {
      const dirs = top.startsWith("@")
        ? readdirSync(join(inner, top)).map((n) => join(inner, top, n))
        : [join(inner, top)];
      for (const dir of dirs) {
        const pj = join(dir, "package.json");
        if (!existsSync(pj)) continue;
        try {
          const j = JSON.parse(readFileSync(pj, "utf8"));
          if (!j.name || idx.has(j.name)) continue;
          idx.set(j.name, {
            version: j.version || "?",
            licence: licenceOf(j),
            deps: Object.keys(j.dependencies || {}),
          });
        } catch {
          /* a manifest we cannot parse is not a package we can vet; skip */
        }
      }
    }
  }
  return idx;
}

/** The workspace's own runtime dependencies, minus the workspace-internal ones. */
function workspaceRuntimeDeps() {
  const seeds = [];
  for (const rel of [["apps", "web"], ["packages", "core"]]) {
    const pj = join(ROOT, ...rel, "package.json");
    if (!existsSync(pj)) continue;
    const j = JSON.parse(readFileSync(pj, "utf8"));
    for (const [name, spec] of Object.entries(j.dependencies || {})) {
      if (String(spec).startsWith("workspace:")) continue;
      seeds.push(name);
    }
  }
  return seeds;
}

const idx = indexStore();
if (idx.size === 0) {
  console.error(
    "gate:license-tree — FAIL: no installed packages found under node_modules/.pnpm (run: pnpm install)",
  );
  process.exit(1);
}

// CHANNEL 1 — the browser bundle.
const seeds = new Set(workspaceRuntimeDeps());
seeds.add("workbox-window"); // dev-declared, ships through the register shim

// CHANNEL 2 — the service worker: the workbox runtime family generateSW can bundle.
const workboxBuild = idx.get("workbox-build");
for (const dep of workboxBuild?.deps || []) {
  if (dep.startsWith("workbox-")) seeds.add(dep);
}

// Transitive closure over runtime dependencies. Workspace-internal packages are
// ours and are not vetted here; they have no store entry to seed from anyway.
const ship = new Map(); // name -> { version, licence }
const unresolved = [];
const queue = [...seeds];
while (queue.length) {
  const name = queue.shift();
  if (ship.has(name) || name.startsWith("@hifth/")) continue;
  const pkg = idx.get(name);
  if (!pkg) {
    unresolved.push(name);
    ship.set(name, { version: "?", licence: "UNRESOLVED" });
    continue;
  }
  ship.set(name, { version: pkg.version, licence: pkg.licence });
  for (const dep of pkg.deps) if (!ship.has(dep)) queue.push(dep);
}

const flagged = [];
for (const [name, { version, licence }] of ship) {
  if (!allowed(licence)) flagged.push({ name, version, licence });
}
flagged.sort((a, b) => a.name.localeCompare(b.name));

if (flagged.length) {
  console.error("gate:license-tree — FAIL: a shipped package carries a licence nobody classified:");
  for (const { name, version, licence } of flagged) {
    console.error(`  - ${name}@${version}: ${licence}`);
  }
  console.error(
    "\n  Either it should not ship, or its terms are acceptable and belong in ALLOW",
  );
  console.error("  in scripts/gate-license-tree.mjs — classified on purpose, with a reason.");
  process.exit(1);
}

const buckets = new Map();
for (const { licence } of ship.values()) buckets.set(licence, (buckets.get(licence) || 0) + 1);
const breakdown = [...buckets]
  .sort((a, b) => b[1] - a[1])
  .map(([l, n]) => `${n} ${l}`)
  .join(", ");
console.log(`gate:license-tree — OK (${ship.size} shipped package(s): ${breakdown})`);
