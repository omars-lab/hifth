#!/usr/bin/env node
// Runs the list's daily tidy (apps/landing/tidy/) once on this laptop, against the local copy of
// the list, and says whether it worked. It proves what the stand-in tests cannot: that the
// Worker builds, and that the real database answers its call with a count.
//
// Cloudflare's own local runner starts the Worker with its timer test door open, the script
// knocks once, reads the Worker's log line, and stops it. Nothing reaches Cloudflare or the real
// list: the list's address is refused unless it is on this laptop (localListFrom).
//
//   make hifth-app-tidy-try            (supabase start first)

import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCAL_LIST_KEY, localListFrom } from "./release-hifth-app.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..", "..");
const TIDY = join(REPO, "apps", "landing", "tidy");

/** What `wrangler dev` is run with: local only, the timer's test door open, the local list's settings. */
export function tidyDevArgs(port, list, persistTo) {
  return [
    "dev", "--local", "--test-scheduled", "--ip", "127.0.0.1", "--port", String(port),
    "--persist-to", persistTo, "--show-interactive-dev-session=false",
    "--var", `SUPABASE_URL:${list.url}`,
    "--var", `SUPABASE_PUBLISHABLE_KEY:${list.key}`,
    "--var", `LIST_KEY:${LOCAL_LIST_KEY}`,
  ];
}

/** The tidy's own line in the runner's log: ok with its count, failed with its status, or null. */
export function tidyOutcome(log) {
  const ok = log.match(/ev=tidy_ok removed=(\d+)/);
  if (ok) return { ok: true, removed: Number(ok[1]) };
  const failed = log.match(/ev=tidy_(failed|skipped)[^\n]*/);
  return failed ? { ok: false, line: failed[0] } : null;
}

async function knock(port, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/__scheduled?cron=17+4+*+*+*`);
      return res.status;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return null;
}

async function main(argv) {
  const i = argv.indexOf("--port");
  const port = i >= 0 ? argv[i + 1] : "8799";
  const workdir = process.env.SUPABASE_WORKDIR || REPO;
  const status = spawnSync("supabase", ["--workdir", workdir, "status", "-o", "json"], { encoding: "utf8" });
  const list = status.status === 0 ? localListFrom(status.stdout) : null;
  if (!list) {
    console.log("✗ no local copy of the list is running: supabase start, then try again");
    return false;
  }
  const persist = mkdtempSync(join(tmpdir(), "hifth-tidy-"));
  const runner = spawn("wrangler", tidyDevArgs(port, list, persist), { cwd: TIDY, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  runner.stdout.on("data", (d) => (log += d));
  runner.stderr.on("data", (d) => (log += d));
  try {
    const answered = await knock(port);
    if (answered === null) {
      console.log("✗ the Worker never started on this laptop; its runner said:");
      console.log(log.split("\n").filter((l) => /error|✘/i.test(l)).slice(0, 10).join("\n"));
      return false;
    }
    for (let t = 0; t < 20 && !tidyOutcome(log); t++) await new Promise((r) => setTimeout(r, 250));
    const outcome = tidyOutcome(log);
    if (outcome?.ok) {
      console.log(`✓ the tidy ran against the local list and removed ${outcome.removed} unconfirmed address(es)`);
      return true;
    }
    console.log(outcome ? `✗ the tidy ran and failed: ${outcome.line}` : "✗ the timer was knocked but the tidy wrote no line");
    return false;
  } finally {
    runner.kill("SIGTERM");
    rmSync(persist, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit((await main(process.argv.slice(2))) ? 0 : 1);
}
