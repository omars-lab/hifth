/**
 * A tiny made-up repository for testing one of our own checks.
 *
 * Every check under scripts/gate-*.mjs reads the real tree and exits 1 when it
 * refuses something. To prove a check still refuses what it was written to
 * refuse — and still passes what it should pass — a test builds a small tree
 * here, points the check at it with HIFTH_GATE_ROOT, and reads the exit code.
 * The check runs as a separate process, exactly as the hooks run it, so the
 * test sees what a push would see.
 *
 * A check that honours HIFTH_GATE_ROOT resolves every path from that folder
 * instead of the repository. One that does not can be given a test only after
 * it learns to.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const SCRIPTS = new URL(".", import.meta.url).pathname;

/**
 * Write `files` ({ "relative/path": "contents" }) into a fresh temporary
 * folder and return its path. Callers remove it with `dropFixture`.
 */
export function makeFixture(files, prefix = "hifth-gate-") {
  const root = mkdtempSync(join(tmpdir(), prefix));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return root;
}

export function dropFixture(root) {
  rmSync(root, { recursive: true, force: true });
}

/**
 * Run `scripts/gate-<name>.mjs` against `root`. Returns the exit status and
 * everything the check printed, on either stream, so a failing assertion can
 * show what the check actually said.
 */
export function runGate(name, root, extraEnv = {}) {
  const r = spawnSync(process.execPath, [join(SCRIPTS, `gate-${name}.mjs`)], {
    encoding: "utf8",
    env: { ...process.env, HIFTH_GATE_ROOT: root, ...extraEnv },
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}
