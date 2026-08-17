/**
 * The server that gives a sitting back to the person who was in the middle of it.
 *
 * The reason this file exists is a bug that cost a reader most of an evening twice
 * over. The browser's own store was the only place a sitting's *place* and its drawn
 * corrections lived, and a browser store is the least dependable link in the chain:
 * it is per-origin, so opening this machine by its tailnet name and by its tailnet
 * address are two different memories of the same sitting, and neither can see the
 * other. A reader who arrived by the other address was handed a sitting that had
 * forgotten them — card one, every box back where it shipped — while every answer
 * they had given sat safely on the machine that served them the page.
 *
 * So the machine hands them back, and these hold it to that.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { spawn } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SCRIPT = new URL("./serve-sittings.mjs", import.meta.url).pathname;

const AN = { kind: "placement", id: "13:35", page: 13, line: 2, name: "fatha", rule: "line-tilt", by: [0.5, 0], to: [1, 2] };
const OTHER = { kind: "wrong-shape", id: "99:1", page: 99, line: 4, name: "sukun", rule: "line-tilt", size: [6, 4] };

let dir;
let proc;
let base;
let token;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "hifth-serve-"));
  // A hand-over that has already been banked, and a live log holding one answer that
  // came after it plus one from a different sitting entirely — because one log covers
  // every sitting and the endpoint is deliberately not the thing that separates them.
  writeFileSync(join(dir, "mark-report-fallback-p1of16.23.json"), JSON.stringify({ said: [AN] }));
  writeFileSync(
    join(dir, "answers.jsonl"),
    [AN, OTHER].map((p) => JSON.stringify({ t: "2026-08-14T04:05:24.478Z", kind: "report", payload: p })).join("\n") + "\n",
  );

  // Port 0 is not offered: the script takes a number and prints where it landed, so
  // a fixed high port is simpler than parsing. Collisions fail loudly rather than
  // silently talking to somebody else's server, which is the failure worth avoiding.
  base = "http://127.0.0.1:4187";
  proc = spawn(process.execPath, [SCRIPT, "--dir", dir, "--host", "127.0.0.1", "--port", "4187", "--log", "answers.jsonl"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  writeFileSync(join(dir, "probe.html"), "<!doctype html><html><head><title>x</title></head><body></body></html>");
  for (let i = 0; i < 100 && !token; i += 1) {
    await wait(50);
    try {
      // The token is only readable from a page this server served, which is the whole
      // of what it is for.
      const page = await (await fetch(`${base}/probe.html`)).text();
      token = /t=([a-f0-9]+)/.exec(page)?.[1] || null;
    } catch {
      // not up yet
    }
  }
});

afterAll(() => {
  proc?.kill();
  rmSync(dir, { recursive: true, force: true });
});

describe("handing a sitting back its own answers", () => {
  it("serves a page with somewhere for its answers to go", async () => {
    const html = await (await fetch(`${base}/probe.html`)).text();
    expect(html).toContain("HIFTH_SESSION");
    expect(html).toContain("/api/answers");
    // Ahead of the page's own scripts, and never ahead of the doctype — prepending
    // there puts the page in quirks mode, breaking its layout to fix its reporting.
    expect(html.indexOf("HIFTH_SESSION")).toBeGreaterThan(html.indexOf("<head>"));
  });

  it("gives back the hand-over and the live log as two separate records", async () => {
    const t = token;
    const r = await (await fetch(`${base}/api/answers?t=${t}&name=mark-report-fallback-p1of16.23.json`)).json();
    expect(r.ok).toBe(true);
    // Separate because they are different kinds of record: a hand-over is a snapshot
    // with its retractions already applied, and the log is the raw stream with the
    // retractions still in it as their own lines. Only the page can merge them.
    expect(r.banked).toEqual([AN]);
    expect(r.log).toEqual([AN, OTHER]);
  });

  it("still answers when no hand-over was ever banked", async () => {
    const t = token;
    const r = await (await fetch(`${base}/api/answers?t=${t}&name=nothing-was-ever-written.json`)).json();
    // A reader who has never pressed hand-over has still given answers, and the log
    // is the whole of what they are owed. Refusing here would hand them nothing.
    expect(r.ok).toBe(true);
    expect(r.banked).toEqual([]);
    expect(r.log.length).toBe(2);
  });

  it("will not read a sitting out to a page it did not serve", async () => {
    const r = await (await fetch(`${base}/api/answers?t=deadbeef&name=mark-report-fallback-p1of16.23.json`)).json();
    expect(r.ok).toBe(false);
  });

  it("cannot be walked out of the directory it is serving", async () => {
    const t = token;
    const r = await (await fetch(`${base}/api/answers?t=${t}&name=${encodeURIComponent("../../etc/hosts")}`)).json();
    expect(r.ok).toBe(true);
    expect(r.banked).toEqual([]);
  });
});

/**
 * The listing that lets the front door stop being a photograph.
 *
 * The page it feeds had every one of its numbers worked out when it was generated
 * and then frozen, so a finished sitting stayed in the list looking unfinished and
 * a re-deal left the page describing parts that no longer held those marks. The
 * one thing that must be true of this route is the thing the caching would break:
 * it reads the directory at the moment it is asked, because the sittings are
 * rebuilt while the server runs and a server holding its own idea of what is on
 * the disk would just be the stale thing instead of the page.
 */
describe("saying what is on the disk right now", () => {
  const sitting = (name, head, ids) =>
    writeFileSync(
      join(dir, name),
      [
        "<!doctype html><html><head></head><body><script>",
        `const HEAD = ${JSON.stringify({ built: "mark-report", ...head })};`,
        `const CARDS = ${JSON.stringify(ids.map((id) => ({ id })))};`,
        "</script></body></html>",
      ].join("\n"),
    );

  const listing = async () => (await (await fetch(`${base}/api/sittings?t=${token}`)).json());

  it("lists the sittings, with the marks each is asking about", async () => {
    sitting("sit.part-1.html", { part: "1/2", slice: "-p1of2-aXX", shown: 2, pool: 4, population: 4, alreadyAnswered: 0 }, ["1:1", "1:2"]);
    const r = await listing();
    expect(r.ok).toBe(true);
    const one = r.sittings.filter((s) => s.name === "sit.part-1.html")[0];
    expect(one.part).toBe("1/2");
    expect(one.ids).toEqual(["1:1", "1:2"]);
  });

  // The whole point. A part rebuilt under a running server has to show up on the
  // next open of the front door, not on the next restart of this.
  it("sees a sitting that arrived after it started", async () => {
    const before = (await listing()).sittings.length;
    sitting("sit.part-2.html", { part: "2/2", slice: "-p2of2-aXX", shown: 2, pool: 4, population: 4, alreadyAnswered: 0 }, ["2:1", "2:2"]);
    expect((await listing()).sittings.length).toBe(before + 1);
  });

  // The output directory is full of pages that are not sittings, including the
  // front door itself and the probe above.
  it("does not list the other pages in the directory", async () => {
    const names = (await listing()).sittings.map((s) => s.name);
    expect(names).not.toContain("probe.html");
    expect(names.every((n) => n.startsWith("sit."))).toBe(true);
  });

  it("will not list to a page it did not serve", async () => {
    const r = await (await fetch(`${base}/api/sittings?t=deadbeef`)).json();
    expect(r.ok).toBe(false);
  });
});

describe("the script itself", () => {
  it("parses", () => {
    expect(() => execFileSync(process.execPath, ["--check", SCRIPT])).not.toThrow();
  });
});
