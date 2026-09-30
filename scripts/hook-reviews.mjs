#!/usr/bin/env node
/*
 * A SessionStart hook (also `make reviews`): print the review-md threads that are waiting on
 * claude, so a session starts by seeing the feedback left on the docs in Obsidian.
 *
 * review-md (github.com/omars-lab/review-md) keeps each doc's comment threads in a git-tracked
 * file beside it, `.<name>.comments.md`. Its `reviews` CLI ships in the Claude Code plugin of
 * the same name; this hook finds the newest installed copy and asks it for the open threads
 * where someone other than claude spoke last. Nothing is printed when there is nothing waiting,
 * so a quiet session stays quiet. Always exits 0: a broken hook must never wedge a session.
 *
 *   HIFTH_REVIEWS_BIN   path to reviews.mjs (default: newest under ~/.claude/plugins/cache)
 *   HIFTH_REVIEWS_DIR   folder to scan, relative to the project (default: docs)
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative } from "node:path";

const project = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const folder = join(project, process.env.HIFTH_REVIEWS_DIR || "docs");

function findCli() {
  if (process.env.HIFTH_REVIEWS_BIN) return process.env.HIFTH_REVIEWS_BIN;
  const cache = join(homedir(), ".claude", "plugins", "cache", "review-md", "review-md");
  if (!existsSync(cache)) return null;
  const versions = readdirSync(cache)
    .filter((v) => existsSync(join(cache, v, "bin", "reviews.mjs")))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return versions.length ? join(cache, versions.at(-1), "bin", "reviews.mjs") : null;
}

function main() {
  const cli = findCli();
  if (!cli || !existsSync(folder)) return;
  let out;
  try {
    out = execFileSync("node", [cli, "list", folder, "--open", "--waiting", "claude", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 10_000,
    });
  } catch {
    return;
  }
  let data;
  try {
    data = JSON.parse(out);
  } catch {
    return;
  }
  const files = (data.files ?? [data]).filter((f) => f?.threads?.length);
  if (!files.length) return;
  const lines = [];
  let count = 0;
  for (const f of files) {
    const doc = relative(project, f.file);
    for (const t of f.threads) {
      count += 1;
      const last = t.messages?.at(-1);
      const quote = t.anchor?.quote ? ` on “${t.anchor.quote}”` : "";
      const stale = t.outdated ? " [OUTDATED: the doc changed since]" : "";
      lines.push(`- ${doc} · ${t.id}${quote}${stale}\n  ${last?.author ?? "?"}: ${(last?.body ?? "").trim()}`);
    }
  }
  console.log(
    `Review comments waiting on claude: ${count} thread${count === 1 ? "" : "s"} (from Obsidian, via review-md).\n` +
      `Act on each (change the doc or answer), then \`reviews reply <doc> <id> "<what you did>" --author claude\`; \`make reviews\` lists them again.\n` +
      lines.join("\n"),
  );
}

try {
  main();
} catch {
  // Never block a session over the review queue.
}
