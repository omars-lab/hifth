/**
 * Which port the browser tests serve the app on. Every checkout used 4173, so
 * two worktrees running their tests at once collided — the second failed to
 * start with "4173 is already used", and a push could fail for a reason that
 * had nothing to do with the change (2026-09-29, three times in one session).
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { e2ePorts } from "../../../scripts/lib/e2e-port.mjs";

const main = () => {
  const d = mkdtempSync(join(tmpdir(), "hifth-port-main-"));
  mkdirSync(join(d, ".git"));
  return d;
};
const worktree = (name = "wt-") => {
  const d = mkdtempSync(join(tmpdir(), `hifth-port-${name}`));
  writeFileSync(join(d, ".git"), "gitdir: /somewhere/.git/worktrees/x\n");
  return d;
};

describe("the browser tests' port", () => {
  it("keeps 4173 (and 4273 for the pitch build) in the main checkout", () => {
    expect(e2ePorts({ root: main(), env: {} })).toEqual({ app: 4173, pitch: 4273 });
  });

  it("gives a worktree its own port, away from the main checkout's and the dev server's", () => {
    const { app, pitch } = e2ePorts({ root: worktree(), env: {} });
    expect(app).toBeGreaterThanOrEqual(5200);
    expect(app).toBeLessThan(5900);
    expect(pitch).toBe(app + 1000);
  });

  it("gives the same worktree the same port every time", () => {
    const wt = worktree();
    expect(e2ePorts({ root: wt, env: {} })).toEqual(e2ePorts({ root: wt, env: {} }));
  });

  it("gives two worktrees different ports", () => {
    const ports = new Set(["a-", "b-", "c-", "d-"].map((n) => e2ePorts({ root: worktree(n), env: {} }).app));
    expect(ports.size).toBeGreaterThan(1);
  });

  it("lets HIFTH_E2E_PORT choose, when someone asks by name", () => {
    expect(e2ePorts({ root: worktree(), env: { HIFTH_E2E_PORT: "4999" } })).toEqual({ app: 4999, pitch: 5999 });
  });
});
