#!/usr/bin/env node
/**
 * Claude Code hook (PostToolUse, Bash): after a build, a push or a size or
 * start-up check, say when it is time to run the optimizing-performance skill.
 *
 * It only reads — the command's own output, the accepted size in
 * scripts/budget-baseline.json and the cap in scripts/gate-budget.mjs. It says
 * each finding once per session (a near-cap finding again only when the size
 * moves), logs one line per decision to ~/.claude/metrics/perf-nudges.log, and
 * always exits 0: a reminder must never block the work.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findings, isWatched, measuredGz } from "./lib/perf-nudge.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOG = join(homedir(), ".claude", "metrics", "perf-nudges.log");

function log(ev, fields = "") {
  try {
    mkdirSync(dirname(LOG), { recursive: true });
    appendFileSync(LOG, `${new Date().toISOString()} pid=${process.pid} ev=${ev} ${fields}\n`);
  } catch {
    // a reminder must never break the work
  }
}

function main() {
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    // a reminder must never break the work
  }
  const command = input.tool_input?.command ?? "";
  if (!isWatched(command)) return;

  const r = input.tool_response ?? {};
  const output = typeof r === "string" ? r : [r.stdout, r.stderr, r.output].filter(Boolean).join("\n");

  let capGz = 175 * 1024;
  let totalGz = null;
  try {
    const m = readFileSync(join(ROOT, "scripts", "gate-budget.mjs"), "utf8").match(/BUDGET_GZ = (\d+) \* 1024/);
    if (m) capGz = Number(m[1]) * 1024;
    totalGz = JSON.parse(readFileSync(join(ROOT, "scripts", "budget-baseline.json"), "utf8")).totalGz ?? null;
  } catch {
    // a reminder must never break the work
  }
  totalGz = measuredGz(output) ?? totalGz;

  const session = String(input.session_id ?? "none").replace(/[^\w-]/g, "");
  const marker = join(tmpdir(), `hifth-perf-nudge-${session}.json`);
  let said = [];
  try {
    if (existsSync(marker)) said = JSON.parse(readFileSync(marker, "utf8"));
  } catch {
    // a reminder must never break the work
  }

  const fresh = findings({ totalGz, capGz, output }).filter((f) => !said.includes(`${f.key}:${f.seen ?? ""}`));
  if (fresh.length === 0) {
    log("quiet", `total_gz=${totalGz}`);
    return;
  }
  try {
    writeFileSync(marker, JSON.stringify([...said, ...fresh.map((f) => `${f.key}:${f.seen ?? ""}`)]));
  } catch {
    // a reminder must never break the work
  }
  log("nudge", `keys=${fresh.map((f) => f.key).join(",")} total_gz=${totalGz}`);

  const text =
    fresh.map((f) => f.say).join(" ") +
    " Time to run the optimizing-performance skill: read .claude/skills/optimizing-performance/trims.md" +
    " and take the next trim, or tell the owner why not.";
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: text } }),
  );
}

try {
  main();
} catch (e) {
  log("error", `msg="${String(e?.message ?? e).replace(/"/g, "'")}"`);
}
process.exit(0);
