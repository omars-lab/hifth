#!/usr/bin/env node
/*
 * A Stop hook: when a session is about to end its turn on "Shall I merge #N?", send it back to
 * merge and carry on instead.
 *
 * Why: merging my own PR once its checks pass is a standing yes in this repo (Omar, 2026-09-27:
 * "setup a hook that nudges the session to continue if its stopping to merge"). Ending a turn to
 * ask costs a round-trip for an answer that is always "merge and continue".
 *
 * It lets the stop through anyway when:
 *   - the last message does not ask to merge;
 *   - it asks again about the SAME PR it was already sent back on — the session looked and still
 *     stopped, so it has a reason (failing tests, a call only the owner can make);
 *   - it has already sent the session back MAX_NUDGES times.
 *
 * Prints {"decision":"block","reason":…} to continue, nothing to let the stop happen. Always exits
 * 0, so a broken hook can never wedge a session. One log line per decision in
 * ~/.claude/metrics/merge-nudges.log.
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";

const MAX_NUDGES = 12;

// "Shall I merge #115?", "Want me to merge it?", "Ready to merge?", "Merge #115?"
const ASKS_TO_MERGE =
  /(?:shall|should|may|can)\s+i\s+merge|(?:want|like)\s+me\s+to\s+merge|(?:ok|okay|ready|good|fine)\s+to\s+merge|\bmerge\s+(?:#\d+|it|this|them|the\s+pr)\s*\?/i;

function log(ev, fields = {}) {
  try {
    const dir = join(homedir(), ".claude", "metrics");
    mkdirSync(dir, { recursive: true });
    const kv = Object.entries(fields)
      .map(([k, v]) => `${k}=${String(v).replace(/\s+/g, "_")}`)
      .join(" ");
    appendFileSync(join(dir, "merge-nudges.log"), `${new Date().toISOString()} pid=${process.pid} ev=${ev} ${kv}\n`);
  } catch {
    // A log that cannot be written must not stop the hook.
  }
}

/** The last thing the assistant said: from the payload, or else from the transcript. */
function lastAssistantText(input) {
  if (typeof input.last_assistant_message === "string") return input.last_assistant_message;
  if (!input.transcript_path) return "";
  const lines = readFileSync(input.transcript_path, "utf8").trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    let entry;
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (entry.type !== "assistant") continue;
    const content = entry.message?.content;
    const text = Array.isArray(content)
      ? content.filter((c) => c.type === "text").map((c) => c.text).join("\n")
      : typeof content === "string" ? content : "";
    if (text.trim()) return text;
  }
  return "";
}

try {
  const input = JSON.parse(readFileSync(0, "utf8") || "{}");
  const repo = basename(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
  // Only the closing lines: an earlier "merged #114" in the same message is not a question.
  const tail = lastAssistantText(input).slice(-700);
  if (ASKS_TO_MERGE.test(tail)) {
    const pr = tail.match(/#\d+/g)?.pop() ?? "the PR";
    const stateFile = join(tmpdir(), `merge-nudge-${input.session_id ?? "unknown"}.json`);
    let state = { count: 0, lastPr: null };
    try {
      state = JSON.parse(readFileSync(stateFile, "utf8"));
    } catch {
      // First nudge of this session: no state yet.
    }
    if (state.lastPr === pr) {
      log("let_through", { repo, pr, why: "asked_again_after_nudge" });
    } else if (state.count >= MAX_NUDGES) {
      log("let_through", { repo, pr, why: "max_nudges" });
    } else {
      writeFileSync(stateFile, JSON.stringify({ count: state.count + 1, lastPr: pr }));
      log("nudge", { repo, pr, n: state.count + 1 });
      process.stdout.write(
        JSON.stringify({
          decision: "block",
          reason:
            `Standing approval in ${repo}: don't stop to ask about merging. If ${pr} is your own PR and ` +
            "its checks pass, merge it (gh pr merge --merge), start the next branch off fresh main in " +
            "the same worktree, and continue with the next item in feature-ROI order. Only stop if " +
            "tests fail or it needs a call only the owner can make, and then say that plainly.",
        }),
      );
    }
  }
} catch (err) {
  log("error", { msg: String(err?.message ?? err).slice(0, 120) });
}
process.exit(0);
