#!/usr/bin/env node
/**
 * What has been published to the web, and does this repo know about it?
 *
 * NOT A GATE, and it cannot become one. A published page's address is minted by
 * the publish; nothing writes it back into the tree. The only record that a
 * publish happened at all is the session log it happened in, and those logs live
 * outside this repository, on whichever laptop did the publishing. CI has no
 * access to them and never will, so this check runs where the evidence is or it
 * does not run. That is why docs/artifacts.json is hand-kept and why this file
 * is named for what it does rather than `gate-`: `pnpm gates` must not grow a
 * check that passes in CI by being unable to look.
 *
 * It exists because the looking was never done. Nine pages had gone out; five
 * were named somewhere in the tree and four were not, and all four of those had
 * been built in a scratch directory that was later cleared. So for four pages —
 * a diagnosis, a comparison with a recommendation, a plan, and a finding that
 * settles a question — the address on a host we do not own is the only copy in
 * existence. Nobody decided that. It is what happens when the last step of
 * publishing is remembering.
 *
 * Two ways to run it:
 *
 *   node scripts/artifact-sweep.mjs        every publish this machine has ever
 *                                          made from this repo, against the
 *                                          register. Exits non-zero if the
 *                                          register is missing one.
 *
 *   node scripts/artifact-sweep.mjs --hook  reads a PostToolUse payload on
 *                                          stdin and looks at the one page that
 *                                          was just published. Silent when the
 *                                          register already knows it; otherwise
 *                                          exits 2, which is the channel that
 *                                          puts the sentence back in front of
 *                                          the agent that did the publishing —
 *                                          while the page, its subject and the
 *                                          reason for it are all still in hand.
 *                                          Reminding an hour later is reminding
 *                                          somebody to reconstruct.
 *
 * Wired in .claude/settings.json. A hook is a reminder and nothing more: it
 * cannot stop a publish (the page is already up by the time it runs) and it does
 * not edit the register, because a register this repo generates is one nobody
 * reads. It says what is missing and leaves the writing to a person.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { ROOT } from "./code-pointers.mjs";

const REGISTER = join(ROOT, "docs/artifacts.json");
const DECISIONS = join(ROOT, "docs/decisions.json");

/* The publish confirmation, as the tool writes it back. The path matters as
 * much as the address: it is the difference between a page checked in here and
 * one built in a scratch directory, and it is the only moment anything records
 * which of the two it was. */
const PUBLISHED = /Published (\S+) at (https:\/\/claude\.ai\/code\/artifact\/[0-9a-f-]+)/g;

/* Claude keeps a project's logs in a directory named for the project's path,
 * with every separator flattened to a dash. Derived rather than configured, so
 * a clone somewhere else finds its own logs and not this one's. */
function logDir(cwd) {
  return join(homedir(), ".claude", "projects", cwd.replace(/[/.]/g, "-"));
}

function registered() {
  const known = new Map();
  const reg = JSON.parse(readFileSync(REGISTER, "utf8"));
  for (const a of reg.artifacts) known.set(a.url, { where: "docs/artifacts.json", row: a });
  return { known, reg };
}

/* A decision row carries its own artifact link, and the register repeats it.
 * Checking both directions is the point: a link in one and not the other is a
 * page that is half-known, which reads as known. */
function decisionLinks() {
  const links = new Map();
  const { decisions } = JSON.parse(readFileSync(DECISIONS, "utf8"));
  for (const d of decisions) if (d.artifact) links.set(d.artifact, d.id);
  return links;
}

/* Every publish this machine has a record of, newest occurrence winning for the
 * source path — a page republished from the tree after being drafted in scratch
 * has stopped being an orphan, and the last publish is the one that says so. */
function publishes(dir) {
  const found = new Map();
  if (!existsSync(dir)) return found;
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".jsonl"))) {
    let text;
    try {
      text = readFileSync(join(dir, f), "utf8");
    } catch {
      continue; // a log being written while we read it is not an error here
    }
    for (const [, path, url] of text.matchAll(PUBLISHED)) {
      const prev = found.get(url) ?? { url, times: 0, paths: [] };
      prev.times += 1;
      if (!prev.paths.includes(path)) prev.paths.push(path);
      found.set(url, prev);
    }
  }
  return found;
}

const inTree = (p) => p.startsWith(ROOT) && !p.includes("/scratchpad/");

function complaints(url, source) {
  const { known } = registered();
  const links = decisionLinks();
  const out = [];
  if (!known.has(url) && !links.has(url)) {
    out.push(
      `${url} is published and no register names it.\n` +
        `  Add a row to docs/artifacts.json: what a reader sees on opening it, and\n` +
        `  which decision owns it — or, if none does, why there is no checked-in copy.` +
        (source && !inTree(source)
          ? `\n  It was built at ${source}, which is outside the repository. When that\n` +
            `  directory is cleared the link becomes the only copy that exists.`
          : ""),
    );
    return out;
  }
  if (known.has(url)) {
    const { decision } = known.get(url).row;
    if (decision && links.get(url) !== decision) {
      out.push(
        `${url} says decision '${decision}' owns it, and that decision's own row\n` +
          `  does not carry this link back. One of the two is out of date.`,
      );
    }
  }
  if (!known.has(url) && links.has(url)) {
    out.push(
      `${url} is on decision '${links.get(url)}' but missing from docs/artifacts.json,\n` +
        `  which is the only place that counts published pages.`,
    );
  }
  return out;
}

const args = process.argv.slice(2);

if (args.includes("--hook")) {
  /* Read the payload rather than the log: at the moment a PostToolUse hook runs
   * the publish may not have been flushed to disk yet, and the payload is the
   * same sentence anyway. Any failure here is silent — a broken reminder must
   * never look like a broken publish. */
  let payload = "";
  for await (const chunk of process.stdin) payload += chunk;
  let url = null;
  let source = null;
  try {
    const ev = JSON.parse(payload);
    const res = ev.tool_response;
    const text = typeof res === "string" ? res : JSON.stringify(res ?? "");
    const m = [...text.matchAll(PUBLISHED)].pop();
    if (m) {
      source = ev.tool_input?.file_path ?? m[1];
      url = m[2];
    }
  } catch {
    process.exit(0);
  }
  if (!url) process.exit(0);
  let said;
  try {
    said = complaints(url, source);
  } catch {
    process.exit(0);
  }
  if (!said.length) process.exit(0);
  process.stderr.write(
    `Published, and unregistered.\n\n${said.join("\n\n")}\n\n` +
      `docs/artifacts.json is the register; rebuild the board after editing it with\n` +
      `  node scripts/build-decision-board.mjs\n`,
  );
  process.exit(2);
}

const dir = logDir(ROOT.replace(/\/$/, ""));
const seen = publishes(dir);
const { reg } = registered();
const links = decisionLinks();

if (!seen.size) {
  console.log(`No session logs under ${dir} — nothing to sweep on this machine.`);
  console.log(`${reg.artifacts.length} pages are registered in docs/artifacts.json.`);
  process.exit(0);
}

const problems = [];
for (const [url, rec] of seen) {
  const said = complaints(url, rec.paths[rec.paths.length - 1]);
  if (said.length) problems.push(...said);
}
/* The other direction: a row for a page this machine never published is not
 * necessarily wrong — somebody else may have published it — but it is worth
 * saying out loud, because the commonest cause is a mistyped address. */
for (const a of reg.artifacts) {
  if (!seen.has(a.url)) problems.push(`${a.url} is registered, and no log on this machine records publishing it.`);
}

const orphans = reg.artifacts.filter((a) => !a.decision && !a.page);
console.log(
  `${seen.size} published from this repo · ${reg.artifacts.length} registered · ` +
    `${links.size} carried by a decision · ${orphans.length} with no copy anywhere`,
);
for (const a of orphans) console.log(`  no copy   ${a.title}`);

if (problems.length) {
  console.error(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}:\n`);
  for (const p of problems) console.error(`  ${p}\n`);
  process.exit(1);
}
console.log("\nEvery published page is registered.");
