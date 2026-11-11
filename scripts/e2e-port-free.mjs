#!/usr/bin/env node
/**
 * Is anything already on the ports the browser tests serve the app on?
 *
 * The tests start their own server and never adopt one that is already there
 * (apps/web/playwright.config.ts says why). So a server left over from an
 * earlier look makes theirs fail to start, minutes into a push, in a way that
 * reads like a broken test. This looks first, and says in a few lines which
 * port is held, by what, and how to stop it (docs/design/build-and-test.md ②).
 *
 * Exit 0, silent: both ports are free. Exit 1: one is held.
 * `make pre-push-checks` runs it before anything slow.
 */
import { connect } from "node:net";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { e2ePorts } from "./lib/e2e-port.mjs";

// Pointed at a server that is already up, the tests start none of their own.
// And HIFTH_REUSE_SERVER=1 asks them, by name, to use the one on the port.
// Hosted CI never reuses one, so there the setting changes nothing.
if (process.env.HIFTH_BASE_URL) process.exit(0);
if (process.env.HIFTH_REUSE_SERVER === "1" && !process.env.CI) process.exit(0);

const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const ports = e2ePorts({ root });

/** Does anything answer on this port at this address? */
const answers = (port, host) =>
  new Promise((done) => {
    const s = connect({ port, host });
    const end = (yes) => {
      s.destroy();
      done(yes);
    };
    s.setTimeout(1000, () => end(false));
    s.once("connect", () => end(true));
    s.once("error", () => end(false));
  });

/** "localhost" may mean either address, so both are tried. */
const held = async (port) => (await Promise.all(["127.0.0.1", "::1"].map((h) => answers(port, h)))).some(Boolean);

/** Who is listening there, as [{ pid, command }]. Empty when it cannot be told. */
function holders(port) {
  const r = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fpc"], { encoding: "utf8", timeout: 5000 });
  if (r.error || !r.stdout) return [];
  const found = [];
  for (const line of r.stdout.split("\n")) {
    if (line.startsWith("p")) found.push({ pid: line.slice(1), command: "" });
    else if (line.startsWith("c") && found.length) found.at(-1).command = line.slice(1);
  }
  return found;
}

const names = { app: "the app", pitch: "the private pitch build" };
let stopped = false;
for (const kind of ["app", "pitch"]) {
  const port = ports[kind];
  if (!(await held(port))) continue;
  stopped = true;
  const who = holders(port);
  console.error(`The browser tests cannot start: something is already on port ${port}, where they serve ${names[kind]}.`);
  if (who.length) {
    for (const { pid, command } of who) console.error(`  It is ${command || "a program"}, process ${pid}. To stop it: kill ${pid}`);
  } else {
    console.error(`  To see what it is: lsof -nP -iTCP:${port} -sTCP:LISTEN`);
  }
}
if (stopped) {
  console.error("  It is most likely a preview server left running from an earlier look. Stop it and push again.");
  process.exit(1);
}
