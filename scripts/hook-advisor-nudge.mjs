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
 * It asks within the session's own focus. On 2026-11-11 it kept turning a session the owner had
 * set on the hifth.app front page back to the pitch walk (Omar: "why do we keep on going back to
 * the walk? our session focus is the hifth app landing page").
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
import { spawnSync } from "node:child_process";
import { join } from "node:path";

/** How long after one nudge the same session is left alone. */
export const WINDOW_MS = 3 * 60 * 60 * 1000;

/**
 * The question, built from what this session is for. In order: the name the session was given
 * (/rename, kept in its log as a custom-title line), the backlog task its branch was started for
 * (intent start, kept in git config as branch.<name>.intent-task), and only when neither is set,
 * the goal marked current in .claude/goals/README.md. Nothing about a goal is written here.
 * Before all of them comes the goal recorded for the session itself (intent focus, kept by the
 * intent plugin in .claude/data/intent/sessions.jsonl).
 */
export function question({ focus = null, session = null, task = null, goal = null } = {}) {
  const at = [];
  if (focus) at.push(`this session is for the ${focus.kind} ${focus.id}`);
  if (session) at.push(`this session is named "${session}"`);
  if (task) at.push(`its branch is for the backlog task ${task.id}${task.summary ? ` (${task.summary})` : ""}`);
  const ask = at.length
    ? `The work at hand: ${at.join("; ")}. Ask what the next most important thing is for that work and the people it serves.`
    : goal
      ? `No focus is set for this session, so use the project's current goal: ${goal}. Ask what the next most important thing is for it.`
      : "No focus is set for this session. Ask what the next most important thing is for the people Hifth is for.";
  return (
    `Before you stop: ${ask} If the owner named a different focus in the conversation, that wins. ` +
    "Call the advisor if you have it; if you do not, answer it yourself from docs/backlog.md and " +
    "what this session found. Put the answer in docs/backlog.md (a new item, or move an existing " +
    "one up), and tell the owner in one plain sentence. If it is now the top item, start on it; " +
    "do not open a large new piece of work only because this reminder asked. Do not steer the " +
    "session to a different goal, and do not write that its work should wait."
  );
}

/** The reminder to send, or null to let the stop through. */
export function verdict({ stopHookActive, now, lastNudgeAt, objective = {} }) {
  if (stopHookActive) return null;
  if (typeof lastNudgeAt === "number" && now - lastNudgeAt < WINDOW_MS) return null;
  return question(objective);
}

/** The goal recorded for this session in the repo's own record; null when none. */
export function sessionFocus(repo, sessionId) {
  let text;
  try {
    text = readFileSync(join(repo, ".claude", "data", "intent", "sessions.jsonl"), "utf8");
  } catch {
    return null;
  }
  let focus = null;
  for (const line of text.split("\n")) {
    try {
      const entry = JSON.parse(line);
      if (entry.session === sessionId && entry.focus?.kind && entry.focus?.id) {
        focus = { kind: String(entry.focus.kind), id: String(entry.focus.id) };
      }
    } catch {
      // A line that is not whole JSON is skipped.
    }
  }
  return focus;
}

/** The last name the session was given, from its log; null when it has none. */
export function sessionTitle(transcriptPath) {
  let text;
  try {
    text = readFileSync(transcriptPath, "utf8");
  } catch {
    return null;
  }
  let title = null;
  for (const line of text.split("\n")) {
    if (!line.includes('"custom-title"')) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.type === "custom-title" && entry.customTitle) title = String(entry.customTitle);
    } catch {
      // A line that is not whole JSON is skipped.
    }
  }
  return title;
}

/** The goal marked **current** in the goals list; null when there is none. */
export function currentGoal(repo) {
  try {
    const row = readFileSync(join(repo, ".claude", "goals", "README.md"), "utf8")
      .split("\n")
      .find((line) => line.startsWith("|") && line.includes("**current**"));
    return /\[([^\]]+)\]/.exec(row ?? "")?.[1] ?? null;
  } catch {
    return null;
  }
}

/** The backlog row a branch was started for, with its note's first sentence. */
export function taskFor(repo, id) {
  try {
    const { issues = [] } = JSON.parse(readFileSync(join(repo, "docs", "issues.json"), "utf8"));
    const note = issues.find((row) => row.id === id)?.note;
    return { id, summary: note ? /^.*?[.!?](?=\s|$)/.exec(note)?.[0] ?? null : null };
  } catch {
    return { id, summary: null };
  }
}

/** The repository and the branch's task, read with git from the session's folder. */
function branchTask(cwd) {
  const git = (...args) => {
    const r = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", timeout: 3000 });
    return r.status === 0 ? r.stdout.trim() : "";
  };
  const repo = git("rev-parse", "--show-toplevel");
  const branch = git("branch", "--show-current");
  const id = branch ? git("config", "--get", `branch.${branch}.intent-task`) : "";
  return { repo: repo || cwd, task: id ? taskFor(repo || cwd, id) : null };
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
    const stopHookActive = input.stop_hook_active === true;
    let objective = {};
    if (verdict({ stopHookActive, now, lastNudgeAt })) {
      const { repo, task } = branchTask(input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd());
      objective = {
        focus: input.session_id ? sessionFocus(repo, String(input.session_id)) : null,
        session: input.transcript_path ? sessionTitle(input.transcript_path) : null,
        task,
        goal: currentGoal(repo),
      };
    }
    const reason = verdict({ stopHookActive, now, lastNudgeAt, objective });
    if (reason) {
      writeFileSync(stateFile, JSON.stringify({ at: now }));
      log("nudge", { session, focus: objective.focus ? "recorded" : objective.session ? "session" : objective.task ? "task" : objective.goal ? "goal" : "none" });
      process.stdout.write(JSON.stringify({ decision: "block", reason }));
    } else {
      log("let_through", { session, why: input.stop_hook_active === true ? "stop_hook_active" : "within_window" });
    }
  } catch {
    log("let_through", { why: "unreadable_input" });
  }
  process.exit(0);
}
