import { test } from "node:test";
import assert from "node:assert/strict";
import { Refused, logLine, run, steps, uncommitted } from "./release.mjs";

// A pretend laptop: make answers from a table, and nothing real runs.
function fakeIo({ fails = {}, status = "", allowed = false } = {}) {
  const ran = [];
  const said = [];
  const logged = [];
  return {
    ran,
    said,
    logged,
    gitStatus: () => status,
    make: (target, vars) => {
      ran.push([target, ...vars].join(" "));
      return fails[target] ?? 0;
    },
    uploadAllowed: () => allowed,
    say: (text) => said.push(text),
    log: (ev, fields) => logged.push({ ev, ...fields }),
  };
}

test("the steps run in the order a release needs, the version before the build", () => {
  assert.deepEqual(
    steps({ version: "1.0.1" }).map((s) => s.target),
    ["app-release-setup", "app-version", "app-web", "app-archive", "app-export", "app-store-check"],
  );
});

test("the public build is the one put in the app", () => {
  const web = steps({ nextBuild: true }).find((s) => s.id === "web");
  assert.deepEqual(web.vars, ["FLAVOUR=public"]);
});

test("a release must say which version it is, and only one way", () => {
  assert.throws(() => steps({}), Refused);
  assert.throws(() => steps({ version: "1.0.1", nextBuild: true }), Refused);
  assert.deepEqual(steps({ nextBuild: true }).find((s) => s.id === "version").vars, ["NEXT_BUILD=1"]);
  assert.equal(steps({ keepVersion: true }).some((s) => s.id === "version"), false);
});

test("the Mac steps join only when asked, and Apple's Mac check only on its own flag", () => {
  assert.equal(steps({ nextBuild: true }).some((s) => s.target.endsWith("-mac")), false);
  const mac = steps({ nextBuild: true, mac: true }).map((s) => s.target);
  assert.ok(mac.includes("app-archive-mac") && mac.includes("app-export-mac"));
  assert.equal(mac.includes("app-store-check-mac"), false);
  const check = steps({ nextBuild: true, macCheck: true }).map((s) => s.target);
  assert.deepEqual(check.slice(-3), ["app-archive-mac", "app-export-mac", "app-store-check-mac"]);
});

test("uncommitted work stops the release before anything runs, except the page comment threads", () => {
  const io = fakeIo({ status: " M .page-comments/threads/t_1.jsonl\n M apps/web/src/App.tsx\n?? notes.txt\n" });
  assert.throws(() => run({ nextBuild: true }, io), /App\.tsx, notes\.txt/);
  assert.deepEqual(io.ran, []);
  assert.deepEqual(uncommitted(" M .page-comments/threads/t_1.jsonl\n"), []);
});

test("a dry run with uncommitted work still lists the steps, and says a real run would not start", () => {
  const io = fakeIo({ status: " M apps/web/src/App.tsx\n" });
  assert.equal(run({ nextBuild: true, dryRun: true }, io).ok, true);
  assert.ok(io.said.some((s) => s.includes("would not start yet")));
  assert.deepEqual(io.ran, []);
});

test("a failed step stops the run there, and nothing after it runs", () => {
  const io = fakeIo({ fails: { "app-archive": 2 } });
  const result = run({ version: "1.0.1" }, io);
  assert.equal(result.ok, false);
  assert.equal(result.stoppedAt, "archive");
  assert.deepEqual(io.ran, ["app-release-setup", "app-version VERSION=1.0.1", "app-web FLAVOUR=public", "app-archive"]);
  assert.ok(io.said.some((s) => s.includes("KEEP_VERSION=1")), "says how to carry on with the number already set");
});

test("a failure at the version step itself does not claim the version was set", () => {
  const io = fakeIo({ fails: { "app-version": 1 } });
  run({ version: "0.0.1" }, io);
  assert.equal(io.said.some((s) => s.includes("KEEP_VERSION=1")), false);
});

test("a clean run stops at the upload while the licence keeps it locked", () => {
  const io = fakeIo({ allowed: false });
  const result = run({ nextBuild: true }, io);
  assert.deepEqual(result, { ok: true, stoppedAt: null, upload: "locked" });
  assert.equal(io.ran.some((t) => t.startsWith("app-testflight")), false, "never tries the upload");
  assert.ok(io.said.some((s) => s.includes("locked")));
  assert.ok(io.said.some((s) => s.includes("Commit native/project.yml")));
});

test("a dry run lists every step and runs none", () => {
  const io = fakeIo();
  const result = run({ nextBuild: true, mac: true, dryRun: true }, io);
  assert.equal(result.ok, true);
  assert.deepEqual(io.ran, []);
  assert.equal(io.said.filter((s) => s.includes("(make ")).length, steps({ nextBuild: true, mac: true }).length);
});

test("each step logs a line before and after, so a stall shows where it was", () => {
  const io = fakeIo();
  run({ nextBuild: true }, io);
  const evs = io.logged.map((l) => `${l.ev}:${l.step ?? ""}`);
  assert.deepEqual(evs.slice(0, 3), ["start:", "step_start:setup", "step_end:setup"]);
  assert.equal(evs.at(-1), "done:");
  assert.match(logLine("step_start", { step: "web" }), /^\d{4}-\d\d-\d\dT\S+ pid=\d+ ev=step_start step=web$/);
});
