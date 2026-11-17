/**
 * The file on hifth.app that tells Apple which links open the iPad and iPhone app (launch item 9;
 * the owner said yes on 2026-11-17).
 *
 * Apple reads it from /.well-known/apple-app-site-association. It names the app by the team's id
 * and the app's own id, and lists the addresses the app takes: the reader under /read/, and only
 * a link that names a place in a mus'haf the app ships. The support and privacy pages stay in the
 * browser. The team's id is filled in at release time from this laptop's signing setup, so it is
 * never written into the repo; these tests use a made-up one. Written before app-links.mjs and
 * seen failing.
 *
 * Run with: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_LINKS_FILE, READER_PATHS, SHIPPED_EDITIONS, appLinksProblems, appSiteAssociation, signingTeam } from "./app-links.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const TEAM = "Q9Z8Y7X6W5";

test("the file names the app under the team and claims only the reader, with a place named", () => {
  const file = JSON.parse(appSiteAssociation(TEAM));
  assert.deepEqual(Object.keys(file), ["applinks"]);
  assert.equal(file.applinks.details.length, 1);
  const [detail] = file.applinks.details;
  assert.deepEqual(detail.appIDs, [`${TEAM}.com.bytesofpurpose.hifth`]);
  assert.deepEqual(
    detail.components.map((c) => [c["/"], c["#"]]),
    READER_PATHS.flatMap((path) => SHIPPED_EDITIONS.map((edition) => [path, `/${edition}/?*`])),
  );
  assert.equal(APP_LINKS_FILE, ".well-known/apple-app-site-association");
  assert.deepEqual(appLinksProblems(appSiteAssociation(TEAM)), []);
});

test("a team id that is not ten capital letters and digits is refused, and never repeated", () => {
  for (const team of ["", "q9z8y7x6w5", "Q9Z8Y7X6W", "Q9Z8Y7X6W5X", "Q9Z8Y7X6W5\n", null]) {
    assert.throws(() => appSiteAssociation(team), (error) => {
      assert.match(error.message, /team/);
      if (team) assert.ok(!error.message.includes(team.trim()), "the message repeats the id");
      return true;
    });
  }
});

// The app takes exactly these addresses (Route.swift, readerPaths and the shipped mus'hafs).
// If the two lists drift apart, Apple opens the app for a link it then drops, or the browser
// keeps a link the app would have opened.
test("the addresses agree with the ones the app itself takes", () => {
  const route = readFileSync(join(REPO, "native", "Hifth", "Route", "Route.swift"), "utf8");
  const paths = /readerPaths: Set<String> = \[([^\]]*)\]/.exec(route)?.[1];
  assert.ok(paths, "Route.swift names no reader paths");
  assert.deepEqual([...paths.matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort(), [...READER_PATHS].sort());
  const shipped = [...route.matchAll(/Edition\(id: "([\w-]+)", shipped: true/g)].map((m) => m[1]);
  assert.deepEqual(shipped, SHIPPED_EDITIONS);
});

test("a file that is missing, broken or names anything else is refused, without repeating the id", () => {
  const good = JSON.parse(appSiteAssociation(TEAM));
  const variant = (change) => {
    const copy = structuredClone(good);
    change(copy);
    return JSON.stringify(copy);
  };
  const cases = {
    missing: null,
    "not JSON": "{applinks",
    "another app": variant((f) => { f.applinks.details[0].appIDs = [`${TEAM}.com.example.other`]; }),
    "two apps": variant((f) => { f.applinks.details[0].appIDs.push(`${TEAM}.com.bytesofpurpose.hifth`); }),
    "a team id that is not one": variant((f) => { f.applinks.details[0].appIDs = ["TEAM.com.bytesofpurpose.hifth"]; }),
    "two entries": variant((f) => { f.applinks.details.push(f.applinks.details[0]); }),
    "the support page": variant((f) => { f.applinks.details[0].components.push({ "/": "/support", "#": "/*" }); }),
    "every address": variant((f) => { f.applinks.details[0].components = [{ "/": "*" }]; }),
    "a link with no place": variant((f) => { f.applinks.details[0].components[0]["#"] = "*"; }),
    "the older address list": variant((f) => { f.applinks.details[0].paths = ["*"]; }),
    "a second permission": variant((f) => { f.webcredentials = { apps: [] }; }),
  };
  for (const [name, text] of Object.entries(cases)) {
    const problems = appLinksProblems(text);
    assert.ok(problems.length > 0, `${name} passed`);
    for (const why of problems) assert.ok(!why.includes(TEAM), `${name}: the message repeats the id`);
  }
});

function standIn(body) {
  const script = join(mkdtempSync(join(tmpdir(), "hifth-team-")), "signing-team.sh");
  writeFileSync(script, `#!/bin/sh\n${body}\n`);
  chmodSync(script, 0o755);
  return script;
}

test("the team comes from the laptop's signing setup, or not at all", () => {
  assert.equal(signingTeam({ script: standIn(`echo ${TEAM}`) }), TEAM);
  assert.equal(signingTeam({ script: standIn("exit 0") }), null);
  assert.equal(signingTeam({ script: standIn("echo not-a-team") }), null);
  assert.equal(signingTeam({ script: standIn(`echo ${TEAM}; exit 3`) }), null);
  assert.equal(signingTeam({ script: join(tmpdir(), "no-such-signing-team.sh") }), null);
});
