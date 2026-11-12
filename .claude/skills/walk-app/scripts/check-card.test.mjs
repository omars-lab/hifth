// The check-card command builds a `check` link from a steps file or a ledger
// row, sends it to the app (simulator or plugged-in iPad), and copies the
// answers back. Apple's two tools are swapped for stand-ins (HIFTH_SIMCTL,
// HIFTH_DEVICECTL) that write down what they were asked, so no device is
// needed. Every step text here is made up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const here = new URL(".", import.meta.url).pathname;
const root = join(here, "../../../..");
const script = join(here, "check-card.mjs");
const DEVICE = "00000000-FAKE-4000-8000-000000000000";
const BUNDLE = "com.bytesofpurpose.hifth";

const temp = (name) => mkdtempSync(join(tmpdir(), `hifth-check-${name}-`));

/** A stand-in tool: appends its arguments to calls.jsonl, and runs `body`. */
function standIn(dir, name, body = "") {
  const bin = join(dir, name);
  writeFileSync(
    bin,
    `#!/usr/bin/env node
const a = process.argv.slice(2), fs = require("fs"), path = require("path");
fs.appendFileSync(${JSON.stringify(join(dir, "calls.jsonl"))}, JSON.stringify(a) + "\\n");
${body}
`,
  );
  chmodSync(bin, 0o755);
  return bin;
}
const calls = (dir) =>
  readFileSync(join(dir, "calls.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));

function run(args, env = {}) {
  return spawnSync(process.execPath, [script, ...args], { encoding: "utf8", cwd: root, env: { ...process.env, ...env } });
}

function stepsFile(steps, extra = {}) {
  const file = join(temp("file"), "steps.json");
  writeFileSync(file, JSON.stringify({ id: "Made Up 1", title: "A made-up check", steps, ...extra }));
  return file;
}

const linkOf = (stdout) => stdout.split("\n").find((l) => l.startsWith("hifth://"));

test("a steps file becomes one check link, steps in order, each see after its step", () => {
  const file = stepsFile([{ do: "Turn the page", see: "It slides over" }, { do: "Tap & hold a verse" }]);
  const r = run(["link", "--file", file]);
  assert.equal(r.status, 0, r.stderr);
  const url = new URL(linkOf(r.stdout));
  assert.equal(url.protocol, "hifth:");
  assert.equal(url.host, "x-callback-url");
  assert.equal(url.pathname, "/check");
  const pairs = [...url.searchParams];
  assert.deepEqual(pairs, [
    ["id", "Made Up 1"],
    ["title", "A made-up check"],
    ["step", "Turn the page"],
    ["see", "It slides over"],
    ["step", "Tap & hold a verse"],
  ]);
  assert.ok(!linkOf(r.stdout).includes(" "), "spaces are encoded");
  assert.ok(!linkOf(r.stdout).includes("+"), "no + for a space: the app reads + as a plus");
});

test("a ledger row gives its short line as the step and the first sentence it expects as what to see", () => {
  const ledger = join(temp("ledger"), "ledger.json");
  const steps = Array.from({ length: 14 }, (_, i) => ({
    do: `Long made-up instruction ${i + 1}, with detail.`,
    ...(i === 0 ? { short: "Open the made-up page." } : {}),
    expect: `Made-up result ${i + 1}. More words that stay off the card.`,
  }));
  writeFileSync(ledger, JSON.stringify({ checks: [{ id: "made-up-row", title: "Made-up row", runbook: { steps } }] }));

  const first = run(["link", "--ledger", "made-up-row", "--ledger-file", ledger]);
  assert.equal(first.status, 0, first.stderr);
  const one = new URL(linkOf(first.stdout)).searchParams;
  assert.equal(one.get("id"), "made-up-row");
  assert.equal(one.getAll("step").length, 12, "one card holds 12 steps");
  assert.equal(one.getAll("step")[0], "Open the made-up page.");
  assert.equal(one.getAll("step")[1], "Long made-up instruction 2, with detail.");
  assert.equal(one.getAll("see")[0], "Made-up result 1.");
  assert.match(first.stdout, /ev=more_steps .*next_from=13/);

  const rest = run(["link", "--ledger", "made-up-row", "--ledger-file", ledger, "--from", "13"]);
  assert.equal(rest.status, 0, rest.stderr);
  const two = new URL(linkOf(rest.stdout)).searchParams;
  assert.equal(two.get("id"), "made-up-row-from-13");
  assert.deepEqual(two.getAll("step"), ["Long made-up instruction 13, with detail.", "Long made-up instruction 14, with detail."]);
});

// iOS cuts a link that opens the app at 2,048 characters and the step it cuts
// through never reaches the card (seen in the iPad simulator, 2026-11-12: 12
// steps sent, 9 arrived). So a card stops short of that and the rest goes on the next.
test("a long list is split so no card's link passes 2,000 characters", () => {
  const steps = Array.from({ length: 12 }, (_, i) => ({
    do: `Step ${i + 1} made up words to pad the line out a little further`,
    see: `Result ${i + 1} with more made up words padding the link out so it grows long enough`,
  }));
  const file = stepsFile(steps);
  const first = run(["link", "--file", file]);
  assert.equal(first.status, 0, first.stderr);
  const link = linkOf(first.stdout);
  assert.ok(link.length <= 2000, `the link is ${link.length} characters`);
  const sent = new URL(link).searchParams.getAll("step").length;
  assert.ok(sent < 12 && sent > 0, `${sent} steps on the first card`);
  assert.match(first.stdout, new RegExp(`ev=more_steps .*next_from=${sent + 1}`));

  const rest = run(["link", "--file", file, "--from", String(sent + 1)]);
  assert.equal(rest.status, 0, rest.stderr);
  assert.equal(new URL(linkOf(rest.stdout)).searchParams.getAll("step")[0], `Step ${sent + 1} made up words to pad the line out a little further`);

  const huge = run(["link", "--file", stepsFile([{ do: "x".repeat(2100) }])]);
  assert.equal(huge.status, 2, "one step too long for any card is refused");
  assert.match(huge.stderr, /too long/);
});

test("a file with no steps, or an empty one, is refused before anything is sent", () => {
  assert.equal(run(["link", "--file", stepsFile([])]).status, 2);
  assert.equal(run(["link", "--file", stepsFile([{ do: "  " }])]).status, 2);
  assert.equal(run(["link", "--ledger", "no-such-row"]).status, 2);
});

test("send --sim hands the link to the booted simulator", () => {
  const dir = temp("sim");
  const simctl = standIn(dir, "simctl");
  const r = run(["send", "--file", stepsFile([{ do: "Turn the page" }]), "--sim"], { HIFTH_SIMCTL: simctl });
  assert.equal(r.status, 0, r.stderr);
  const [call] = calls(dir);
  assert.deepEqual(call.slice(0, 2), ["openurl", "booted"]);
  assert.match(call[2], /^hifth:\/\/x-callback-url\/check\?/);
  assert.match(r.stdout, /ev=sent .*to=simulator/);
});

test("send --device opens the app on the iPad with the link", () => {
  const dir = temp("dev");
  const devicectl = standIn(dir, "devicectl");
  const r = run(["send", "--file", stepsFile([{ do: "Turn the page" }]), "--device", DEVICE], { HIFTH_DEVICECTL: devicectl });
  assert.equal(r.status, 0, r.stderr);
  const [call] = calls(dir);
  assert.deepEqual(call.slice(0, 5), ["device", "process", "launch", "--device", DEVICE]);
  assert.equal(call[call.indexOf("--payload-url") + 1].startsWith("hifth://x-callback-url/check?"), true);
  assert.equal(call.at(-1), BUNDLE);
  assert.ok(!r.stdout.includes(DEVICE), "the device id stays out of the log");
});

/** An answers file as the app writes it; the steps are made up. */
const answer = (id, answers, note = "") => ({
  at: "2027-01-15T08:00:00Z",
  id,
  note,
  result: answers.every((a) => a === "pass") ? "pass" : "fail",
  route: "/hafs-kfqc/p7",
  steps: answers.map((a, i) => ({ action: `Made-up step ${i + 1}`, answer: a })),
  title: "A made-up check",
});

test("answers --sim copies the app's answers off the simulator and sums each one up", () => {
  const dir = temp("simdata");
  const container = join(dir, "container");
  mkdirSync(join(container, "Documents/checks"), { recursive: true });
  writeFileSync(join(container, "Documents/checks/made-up-20270115-080000.json"), JSON.stringify(answer("made-up", ["pass", "fail", "not answered"], "the second one lagged")));
  const simctl = standIn(dir, "simctl", `if (a[0] === "get_app_container") console.log(${JSON.stringify(container)});`);
  const out = temp("out");
  const r = run(["answers", "--sim", "--out", out], { HIFTH_SIMCTL: simctl });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(calls(dir)[0], ["get_app_container", "booted", BUNDLE, "data"]);
  assert.deepEqual(readdirSync(out), ["made-up-20270115-080000.json"]);
  const line = r.stdout.split("\n").find((l) => l.includes("ev=answer"));
  assert.match(line, /id=made-up /);
  assert.match(line, /result=fail /);
  assert.match(line, /passed=1 failed=1 unanswered=1/);
  assert.match(line, /note="the second one lagged"/);
  assert.match(r.stdout, /ev=done .*new=1/);
});

test("answers --device copies the app's checks folder off the iPad, wherever devicectl nests it", () => {
  const dir = temp("devdata");
  const devicectl = standIn(
    dir,
    "devicectl",
    `const dest = a[a.indexOf("--destination") + 1];
fs.mkdirSync(path.join(dest, "checks"), { recursive: true });
fs.writeFileSync(path.join(dest, "checks", "made-up-20270115-080000.json"), ${JSON.stringify(JSON.stringify(answer("made-up", ["pass"])))});`,
  );
  const out = temp("out");
  const r = run(["answers", "--device", DEVICE, "--out", out], { HIFTH_DEVICECTL: devicectl });
  assert.equal(r.status, 0, r.stderr);
  const call = calls(dir)[0];
  assert.deepEqual(call.slice(0, 3), ["device", "copy", "from"]);
  assert.equal(call[call.indexOf("--domain-type") + 1], "appDataContainer");
  assert.equal(call[call.indexOf("--domain-identifier") + 1], BUNDLE);
  assert.equal(call[call.indexOf("--source") + 1], "Documents/checks");
  assert.deepEqual(readdirSync(out), ["made-up-20270115-080000.json"]);
  assert.match(r.stdout, /ev=answer .*result=pass .*passed=1 failed=0 unanswered=0/);

  const again = run(["answers", "--device", DEVICE, "--out", out], { HIFTH_DEVICECTL: devicectl });
  assert.match(again.stdout, /ev=done .*new=0/, "a file already copied is not counted again");
});

test("the answers folder is kept out of git: answers can name what the pitch build showed", () => {
  const env = { ...process.env };
  for (const k of ["GIT_DIR", "GIT_INDEX_FILE", "GIT_WORK_TREE"]) delete env[k];
  const r = spawnSync("git", ["check-ignore", "-q", "native/shots/checks/made-up-20270115-080000.json"], { cwd: root, env });
  assert.equal(r.status, 0, "native/shots/checks/ must be ignored by git");
  const usage = run(["answers", "--sim", "--print-out"]);
  assert.equal(usage.stdout.trim(), "native/shots/checks", "the default folder is the ignored one");
});
