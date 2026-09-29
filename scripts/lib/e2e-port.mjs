/**
 * Which ports the browser tests serve the app on, per checkout.
 *
 * Every checkout used 4173 (and 4273 for the pitch build), so two worktrees
 * running their tests at once collided: the second failed to start, and a push
 * could fail for a reason unrelated to the change. The main checkout keeps its
 * ports; a worktree (whose `.git` is a file, not a folder) gets its own, steady
 * across runs, picked from its path, in a range nothing else here uses
 * (5173 is the dev server, 4174 the guide). `HIFTH_E2E_PORT` overrides both.
 */
import { statSync } from "node:fs";
import { join } from "node:path";

export function e2ePorts({ root, env = process.env }) {
  const asked = Number(env.HIFTH_E2E_PORT);
  if (asked > 0) return { app: asked, pitch: asked + 1000 };
  let primary = true;
  try {
    primary = statSync(join(root, ".git")).isDirectory();
  } catch {
    // No .git at all (an exported tree): nothing to collide with.
  }
  if (primary) return { app: 4173, pitch: 4273 };
  let h = 0;
  for (const c of root) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const app = 5200 + (h % 700);
  return { app, pitch: app + 1000 };
}
