// The features page on the development hub: one card per place, tool, panel and
// layout a link can open, with the web link and the iPad link side by side.
// Every list comes from the link contract, so a new tool or panel without a card
// (or without a line saying what a hafiz uses it for) fails here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cards, looksLikePitchBuild, readContract, renderPage } from "./feature-links.mjs";

const contractPath = fileURLToPath(new URL("../../../../docs/design/app-url-scheme.openapi.json", import.meta.url));
const contract = readContract(JSON.parse(readFileSync(contractPath, "utf8")));

test("every tool, panel and layout in the link contract has a card with a line on its use", () => {
  const all = cards(contract);
  for (const tool of contract.tools) assert.ok(all.some((c) => c.group === "tools" && c.key === tool), `no card for tool ${tool}`);
  for (const panel of contract.panels) assert.ok(all.some((c) => c.group === "panels" && c.key === panel), `no card for panel ${panel}`);
  for (const view of contract.views) assert.ok(all.some((c) => c.group === "places" && c.key === `view-${view}`), `no card for view ${view}`);
  for (const c of all) assert.ok(c.use.length > 10, `card ${c.id} says nothing about its use`);
  assert.equal(new Set(all.map((c) => c.id)).size, all.length, "two cards share an id");
});

test("a tool the page has no line for stops the build instead of getting a blank card", () => {
  const grown = { ...contract, tools: [...contract.tools, "lasso"] };
  assert.throws(() => cards(grown), /lasso/);
});

test("each card's iPad link reaches the same place as its web link", () => {
  const byId = Object.fromEntries(cards(contract).map((c) => [c.id, c]));
  assert.equal(byId["tool-note"].route, "/hafs-kfqc/p7?tool=note");
  assert.equal(byId["tool-note"].link, "hifth://x-callback-url/open?page=7&tool=note");
  assert.equal(byId["place-verse"].route, "/hafs-kfqc/2:255");
  assert.equal(byId["place-verse"].link, "hifth://x-callback-url/open?verse=2:255");
  assert.equal(byId["place-surah"].route, "/hafs-kfqc/18:1?open=context");
  assert.equal(byId["place-surah"].link, "hifth://x-callback-url/open?surah=18");
  assert.equal(byId["place-words"].route, "/hafs-kfqc/2:255?w=3-7");
  assert.equal(byId["panel-lookalikes"].route, "/hafs-kfqc/2:48?open=lookalikes");
  assert.equal(byId["place-view-two"].link, "hifth://x-callback-url/open?page=7&view=two");
});

test("the page's web links are relative, so it works under any address the app is served from", () => {
  const html = renderPage(cards(contract), { pictures: new Set() });
  const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length > 20);
  for (const h of hrefs) {
    if (h.startsWith("hifth://")) continue;
    if (h === "data:,") continue; // the empty tab icon, so the browser does not ask the server for one
    assert.ok(!h.startsWith("/") && !/^[a-z]+:/i.test(h), `link is not relative: ${h}`);
  }
  assert.match(html, /href="\.\.\/#\/hafs-kfqc\/p7\?tool=note"/);
});

test("panels that only the pitch build has never show a picture, even if one is on disk", () => {
  const all = cards(contract);
  const pitchOnly = all.filter((c) => c.pitchOnly).map((c) => c.id);
  assert.deepEqual(pitchOnly.sort(), ["panel-commentary", "panel-context"]);
  const html = renderPage(all, { pictures: new Set(all.map((c) => c.id)) });
  assert.doesNotMatch(html, /shots\/panel-commentary\.png/);
  assert.doesNotMatch(html, /shots\/panel-context\.png/);
  assert.match(html, /shots\/tool-note\.png/);
});

test("the page carries no Arabic text and no device id", () => {
  const html = renderPage(cards(contract), { pictures: new Set() });
  assert.doesNotMatch(html, /\p{Script=Arabic}/u);
  assert.doesNotMatch(html, /[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/i);
  assert.ok(html.includes("DEVICE=&quot;$HIFTH_IPAD&quot;"), "the command names the iPad by a shell variable, not by its id");
});

test("make feature-links takes pictures only when asked", () => {
  // The native Makefile's SHOTS names its pictures folder, so a switch of that name
  // was always on; the switch is PICTURES=1.
  const repo = fileURLToPath(new URL("../../../../", import.meta.url));
  const dry = (...extra) => execFileSync("make", ["-s", "-n", "-C", repo, "feature-links", ...extra], { encoding: "utf8" });
  assert.doesNotMatch(dry(), /--shots/);
  assert.match(dry("PICTURES=1"), /--shots --base http:\/\/127\.0\.0\.1:7123\//);
});

test("a site that hands out the private commentary file counts as the pitch build", () => {
  assert.equal(looksLikePitchBuild({ status: 200, contentType: "application/json" }), true);
  assert.equal(looksLikePitchBuild({ status: 200, contentType: "text/html; charset=utf-8" }), false);
  assert.equal(looksLikePitchBuild({ status: 404, contentType: "text/plain" }), false);
});
