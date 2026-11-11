/**
 * A push says at the start when something already holds the port the browser
 * tests serve the app on (docs/design/build-and-test.md ②). Before this, a
 * server left over from an earlier look let the push run for minutes and then
 * fail in a way that read like a broken test.
 *
 * Each test runs the real script against a port a made-up server holds, or
 * one nothing holds. Written before the script (2026-11-11) and seen failing.
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("e2e-port-free.mjs", import.meta.url));

/** A server on a port the system picks, on the given address. */
const hold = (host) =>
  new Promise((done, fail) => {
    const s = createServer();
    s.once("error", fail);
    s.listen(0, host, () => done(s));
  });

/** A server on one named port, or null when something else already holds it. */
const holdPort = (port) =>
  new Promise((done) => {
    const s = createServer();
    s.once("error", () => done(null));
    s.listen(port, "127.0.0.1", () => done(s));
  });

/**
 * A port nothing holds, whose partner 1000 up nothing holds either: the script
 * looks at both. Open the pair, note the number, close them. On a laptop with
 * many servers running, a stranger's server sat on the partner port and failed
 * the first test below (2026-11-11), so the pair is tried until both open.
 *
 * The port is picked here, between 20000 and 40000, not by the system: the
 * system hands out ports near the top of the range, where 1000 up does not
 * exist (the first version of this did that and found no pair in 50 tries).
 */
async function freePort(open = holdPort) {
  for (let tries = 0; tries < 50; tries++) {
    const port = 20000 + Math.floor(Math.random() * 20000);
    const s = await open(port);
    if (!s) continue;
    const partner = await open(port + 1000);
    await new Promise((r) => s.close(r));
    if (!partner) continue;
    await new Promise((r) => partner.close(r));
    return port;
  }
  throw new Error("no pair of free ports found in 50 tries");
}

test("the free port's partner 1000 up is free too, even when the first one tried is taken", async () => {
  // A stand-in for a stranger's server: the first partner asked for is refused.
  let asked = 0;
  const port = await freePort((p) => (++asked === 2 ? Promise.resolve(null) : holdPort(p)));
  assert.equal(asked, 4, "it tried a second pair after the taken partner");
  assert.ok(port >= 20000 && port + 1000 < 65536, `port ${port}`);
  const partner = await holdPort(port + 1000);
  assert.ok(partner, `port ${port + 1000} should be free`);
  await new Promise((r) => partner.close(r));
});

/** Run the script told to look at `port` (and so port + 1000 for the pitch build). */
const run = (port, env = {}) =>
  new Promise((done) => {
    const child = spawn("node", [SCRIPT], {
      // Start from a known state: none of the settings that switch the look off.
      env: { ...process.env, HIFTH_BASE_URL: "", HIFTH_REUSE_SERVER: "", CI: "", HIFTH_E2E_PORT: String(port), ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("exit", (status) => done({ status, out }));
  });

test("with nothing on either port it passes and says nothing", async () => {
  const port = await freePort();
  const { status, out } = await run(port);
  assert.equal(status, 0, out);
  assert.equal(out.trim(), "");
});

test("a server on the app's port stops it, naming the port, who holds it and how to stop it", async () => {
  const s = await hold("127.0.0.1");
  try {
    const { port } = s.address();
    const { status, out } = await run(port);
    assert.equal(status, 1, out);
    assert.match(out, new RegExp(`\\b${port}\\b`));
    // This test's own process is the holder.
    assert.match(out, new RegExp(`\\b${process.pid}\\b`));
    assert.match(out, new RegExp(`kill ${process.pid}\\b`));
  } finally {
    await new Promise((r) => s.close(r));
  }
});

test("a server on the pitch build's port stops it too", async () => {
  const s = await hold("127.0.0.1");
  try {
    const pitch = s.address().port;
    const { status, out } = await run(pitch - 1000);
    assert.equal(status, 1, out);
    assert.match(out, new RegExp(`\\b${pitch}\\b`));
  } finally {
    await new Promise((r) => s.close(r));
  }
});

test("a server that listens only on the other kind of address is still found", async (t) => {
  // The preview server answers on whichever of the two the name "localhost"
  // gives it, so a look at one of them alone would miss half the leftovers.
  // On the Mac this was written on, a server on this address also answers on
  // the other, so here it is the two tests above that fail when only one
  // address is tried (seen with only this one tried, 2026-11-11). This test
  // is for a machine where the two are kept apart.
  let s;
  try {
    s = await hold("::1");
  } catch {
    t.skip("this machine has no ::1 address");
    return;
  }
  try {
    const { status, out } = await run(s.address().port);
    assert.equal(status, 1, out);
  } finally {
    await new Promise((r) => s.close(r));
  }
});

test("a run pointed at a server that is already up does not look at the ports", async () => {
  // HIFTH_BASE_URL makes the tests start no server of their own.
  const s = await hold("127.0.0.1");
  try {
    const { status, out } = await run(s.address().port, { HIFTH_BASE_URL: "http://localhost:9" });
    assert.equal(status, 0, out);
  } finally {
    await new Promise((r) => s.close(r));
  }
});

test("a run asked by name to use the server on the port does not stop for it", async () => {
  const s = await hold("127.0.0.1");
  try {
    const port = s.address().port;
    assert.equal((await run(port, { HIFTH_REUSE_SERVER: "1" })).status, 0);
    // Hosted CI never uses a server that is already there, so there it still stops.
    assert.equal((await run(port, { HIFTH_REUSE_SERVER: "1", CI: "true" })).status, 1);
  } finally {
    await new Promise((r) => s.close(r));
  }
});
