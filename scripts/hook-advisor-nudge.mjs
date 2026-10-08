#!/usr/bin/env node
/*
 * A Stop hook: before a session stops, send it back once to ask the advisor what the next most
 * important thing is for the people Hifth is for, and to put the answer in the backlog.
 *
 * Why: Omar, 2026-10-08: "we should ask the advisor what the next most important thing to do is
 * for our customers/users at the end of session via a reminder hook". A long run of fixes can
 * drift into what is easiest to close; one question to a stronger reviewer, asked about the
 * users rather than the code, keeps the next pick honest.
 *
 * There is no hook that can still talk to the session once it has ended, so this runs on Stop,
 * which fires at the end of every turn. To keep it to "the end of a session" in practice it asks
 * at most once per WINDOW_MS for a session: the first stop, then again only if the same session
 * is still running hours later (a session id survives a context summary, so a long run would
 * otherwise be asked once and never again).
 *
 * Lets the stop through when: this hook already sent the session back (stop_hook_active), so it
 * can never loop; it asked this session within the window; or the input cannot be read. Prints
 * {"decision":"block","reason":…} to continue, nothing to let the stop happen. Always exits 0.
 * One log line per decision in ~/.claude/metrics/advisor-nudges.log.
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

/** How long after one nudge the same session is left alone. */
export const WINDOW_MS = 3 * 60 * 60 * 1000;

const REASON =
  "Before you stop: ask what the next most important thing is for the people Hifth is for — " +
  "huffaz revising from the mus'haf, and, for the pitch right now, the Study Quran team we want " +
  "to collaborate with (the goal at the top of CLAUDE.md). Call the advisor if you have it; " +
  "if you do not, answer it yourself from docs/backlog.md and what this session found. " +
  "Put the answer in docs/backlog.md (a new item, or move an existing one up), and tell the " +
  "owner in one plain sentence. If it is now the top item, start on it; do not open a large new " +
  "piece of work only because this reminder asked.";

/** The reminder to send, or null to let the stop through. */
export function verdict({ stopHookActive, now, lastNudgeAt }) {
  if (stopHookActive) return null;
  if (typeof lastNudgeAt === "number" && now - lastNudgeAt < WINDOW_MS) return null;
  return REASON;
}

function log(ev, fields = {}) {
  try {
    const dir = join(homedir(), ".claude", "metrics");
    mkdirSync(dir, { recursive: true });
    const kv = Object.entries(fields)
      .map(([k, v]) => `${k}=${String(v).replace(/\s+/g, "_")}`)
      .join(" ");
    appendFileSync(join(dir, "advisor-nudges.log"), `${new Date().toISOString()} pid=${process.pid} ev=${ev} ${kv}\n`);
  } catch {
    // A log that cannot be written must not stop the hook.
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const input = JSON.parse(readFileSync(0, "utf8") || "{}");
    const session = String(input.session_id ?? "unknown").replace(/[^\w-]/g, "_");
    const stateFile = join(tmpdir(), `advisor-nudge-${session}.json`);
    let lastNudgeAt = null;
    try {
      lastNudgeAt = JSON.parse(readFileSync(stateFile, "utf8")).at ?? null;
    } catch {
      // First stop of this session: nothing recorded yet.
    }
    const now = Date.now();
    const reason = verdict({ stopHookActive: input.stop_hook_active === true, now, lastNudgeAt });
    if (reason) {
      writeFileSync(stateFile, JSON.stringify({ at: now }));
      log("nudge", { session });
      process.stdout.write(JSON.stringify({ decision: "block", reason }));
    } else {
      log("let_through", { session, why: input.stop_hook_active === true ? "stop_hook_active" : "within_window" });
    }
  } catch {
    log("let_through", { why: "unreadable_input" });
  }
  process.exit(0);
}
