#!/usr/bin/env node
/**
 * Renderer: the registers, the recommendation in each decision record, and the
 * pictures from `make waiting-shots` → docs/waiting-on-you.md, the note to open
 * in Obsidian when the question is "what is waiting on me?".
 *
 * The note itself is drawn by waiting.mjs's renderWaiting, which takes every
 * input as an argument so a test can feed it a made-up backlog; this file only
 * gathers the inputs and writes the result. gate-tasks.mjs refuses a note whose
 * stamp no longer matches what it was built from.
 *
 * Usage:  node scripts/build-waiting-doc.mjs      (runs with `make tasks-doc`)
 */
import { writeFileSync } from "node:fs";
import { readIssues, linker } from "./issues.mjs";
import { readLedger } from "./validation-ledger.mjs";
import { payload } from "./tasks.mjs";
import { WAITING_PATH, readRecommendations, readShots, renderWaiting, waitingHash } from "./waiting.mjs";

const p = payload();
const shots = readShots();
const recs = readRecommendations(p.decisions);
const link = linker(new Map((readLedger().checks ?? []).map((c) => [c.id, c])));
const byId = new Map(readIssues().map((i) => [i.id, i]));

writeFileSync(
  WAITING_PATH,
  renderWaiting({ p, shots, recs, link: (i) => link(byId.get(i.id) ?? i), hash: waitingHash(p, shots, recs) }),
);
const pictures = Object.values(shots).reduce((n, s) => n + s.shots.length, 0);
console.log(
  `docs/waiting-on-you.md — ${p.decisions.length} decisions (${Object.keys(recs).length} with a recommendation, ` +
    `${pictures} pictures), ${p.checks.length} checks, ${p.issues.filter((i) => i.owner === "user").length} yours`,
);
