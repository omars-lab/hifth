/**
 * The developer side bar on hifth.app served on this laptop (dev-sidebar.mjs).
 *
 * The tests use made-up folders and a made-up features page. The side bar's clicks are run in
 * jsdom, a browser without a screen; how it looks is checked by eye at 1280 and 390 px.
 * Run with: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { addDevSidebar, copyFeaturesPage, featureCards, featuresPage, findFeaturesPage, sidebarHtml } from "./dev-sidebar.mjs";
import { auditShipped, readFolder } from "./shipped.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const { JSDOM } = createRequire(join(REPO, "apps/web/package.json"))("jsdom");

function tree(root, files) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
}

const card = (id, title, href, cls = "card") =>
  `<article class="${cls}" id="${id}"><a href="${href}"><img src="shots/${id}.png"></a><h3>${title}</h3><a href="${href}">Open here</a></article>`;

/** A features page as `make feature-links` wrote it before its sections had ids. */
const OLD_HUB = `<!doctype html><html><head><title>Hifth features by link</title></head><body>
<section><h2>Places and layouts <span class="n">1</span></h2><div class="grid">${card("place-page", "Page 7", "../#/hafs-kfqc/p7")}</div></section>
<section><h2>Tools in hand <span class="n">1</span></h2><div class="grid">${card("note", "Note pen", "../#/hafs-kfqc/p7?tool=note")}</div></section>
<section><h2>Panels open on arrival <span class="n">2</span></h2><div class="grid">${card("panel-jump", "Jump &amp; find", "../#/hafs-kfqc/p7?open=jump")}${card("about", "About", "../#/hafs-kfqc/p7?open=about")}${card("panel-commentary", "Commentary", "../#/hafs-kfqc/p7?open=commentary", "card pitch")}</div></section>
</body></html>`;

const DESIGNS = [
  { href: "/docs/design/hifth-app-mailing-list.html", title: "Hifth notify list", kind: "page", mtime: Date.parse("2026-11-12") },
  { href: "/docs/design/share-look.md.html", title: "How should the share menu look?", kind: "note", mtime: Date.parse("2026-11-01") },
];

test("the copied features page opens the app in /read/, and each section has an id to jump to", () => {
  const html = featuresPage(OLD_HUB);
  assert.doesNotMatch(html, /href="\.\.\/#/);
  assert.match(html, /href="\/read\/#\/hafs-kfqc\/p7\?open=jump"/);
  for (const id of ["places", "tools", "panels"]) assert.match(html, new RegExp(`<section id="${id}"><h2>`), id);
  assert.equal(featuresPage(html), html, "a page that already has the ids is left as it is");
});

test("the side bar reads the features page's cards by section", () => {
  assert.deepEqual(featureCards(OLD_HUB), [
    { id: "places", heading: "Places and layouts", cards: [{ id: "place-page", title: "Page 7" }] },
    { id: "tools", heading: "Tools in hand", cards: [{ id: "note", title: "Note pen" }] },
    { id: "panels", heading: "Panels open on arrival", cards: [{ id: "panel-jump", title: "Jump & find" }, { id: "about", title: "About" }, { id: "panel-commentary", title: "Commentary", pitch: true }] },
  ]);
});

test("the features page is taken from this checkout first, else the newest other worktree", () => {
  const root = mkdtempSync(join(tmpdir(), "hifth-dev-sidebar-"));
  const [here, walk, older] = ["here", "walk", "older"].map((n) => join(root, n));
  tree(walk, { ".dev-hub/index.html": OLD_HUB, ".dev-hub/taken-at.txt": "2026-11-12 18:04 UTC\n" });
  tree(older, { ".dev-hub/index.html": OLD_HUB });
  const old = new Date("2026-01-01");
  utimesSync(join(older, ".dev-hub/index.html"), old, old);
  mkdirSync(here, { recursive: true });

  assert.deepEqual(findFeaturesPage({ repo: here, worktrees: [here, older, walk] }), {
    dir: join(walk, ".dev-hub"),
    takenAt: "2026-11-12 18:04 UTC",
  });
  tree(here, { ".dev-hub/index.html": OLD_HUB });
  assert.deepEqual(findFeaturesPage({ repo: here, worktrees: [here, older, walk] }), { dir: join(here, ".dev-hub"), takenAt: null });
  assert.equal(findFeaturesPage({ repo: older + "-none", worktrees: [] }), null);
});

test("with no features page, each features group says how to make one", () => {
  const html = sidebarHtml({ designs: DESIGNS, features: null });
  assert.equal(html.match(/make feature-links/g).length, 3);
  assert.doesNotMatch(html, /\/dev-hub\/#/);
});

function folder() {
  const root = mkdtempSync(join(tmpdir(), "hifth-dev-sidebar-"));
  const out = join(root, "out");
  const hub = join(root, "hub");
  tree(out, {
    "index.html": "<html><body><h1>Hifth</h1></body></html>",
    "ar/index.html": "<html dir=rtl><body><h1>Hifth</h1></body></html>",
    "privacy.html": "<html><body><p>privacy</p></body></html>",
    "404.html": "<html><body><p>none</p></body></html>",
    "read/index.html": "<html><body><div id=root></div></body></html>",
    "docs/design/index.html": "<html><body><h1>Design pages</h1></body></html>",
    "docs/design/share-look.md.html": "<html><body><h1>Share look</h1></body></html>",
    "docs/design/page-bar-options.html": "<html><body><h1>Page bar options</h1></body></html>",
  });
  tree(hub, { "index.html": OLD_HUB, "shots/panel-jump.png": "png" });
  return { out, hub };
}

test("the side bar goes on the front pages, the features page and the notes; never on the app or a public options page", () => {
  const { out, hub } = folder();
  const features = copyFeaturesPage({ from: hub, out });
  const pages = addDevSidebar({ out, designs: DESIGNS, features });
  const has = (p) => /data-dev-sidebar/.test(readFileSync(join(out, p), "utf8"));
  for (const p of ["index.html", "ar/index.html", "privacy.html", "404.html", "dev-hub/index.html", "docs/design/index.html", "docs/design/share-look.md.html"]) {
    assert.ok(has(p), p);
    assert.ok(pages.includes(p), p);
  }
  assert.ok(!has("read/index.html"), "the app under read/");
  assert.ok(!has("docs/design/page-bar-options.html"), "an options page, which is public as it stands");
  assert.match(readFileSync(join(out, "dev-hub/shots/panel-jump.png"), "utf8"), /png/, "the features page's pictures come too");
  const front = readFileSync(join(out, "index.html"), "utf8");
  assert.match(front, /href="\/dev-hub\/#panels"/);
  assert.match(front, /href="\/dev-hub\/#panel-jump"[^>]*>Jump &amp; find</);
  assert.match(front, /href="\/docs\/design\/hifth-app-mailing-list\.html"[^>]*>Hifth notify list/);
});

test("the release check refuses the side bar and the copied features page if they ever reach a folder going up", () => {
  const { out, hub } = folder();
  addDevSidebar({ out, designs: DESIGNS, features: copyFeaturesPage({ from: hub, out }) });
  const { problems } = auditShipped(readFolder(out).files);
  const why = (path) => problems.filter((p) => p.path === path).map((p) => p.why).join(" | ");
  assert.match(why("index.html"), /side bar/);
  assert.match(why("dev-hub/index.html"), /features page/);
});

/** The side bar running in a page at that address, wide or on a phone. */
function open(url, { phone = false, stored = {} } = {}) {
  const html = `<!doctype html><html><body><h1>Page</h1>${sidebarHtml({ designs: DESIGNS, features: featureCards(OLD_HUB) })}</body></html>`;
  const dom = new JSDOM(html, {
    url,
    runScripts: "dangerously",
    beforeParse(window) {
      window.matchMedia = (q) => ({ matches: phone && /max-width/.test(q), media: q, addEventListener() {} });
      for (const [k, v] of Object.entries(stored)) window.localStorage.setItem(k, v);
    },
  });
  const { window } = dom;
  const root = window.document.querySelector("[data-dev-sidebar]").shadowRoot;
  const group = (key) => root.querySelector(`[data-group="${key}"]`);
  const lit = () => [...root.querySelectorAll("a.lit")].map((a) => a.textContent);
  return { window, root, group, lit };
}

test("the page you are on is lit and its group is open, and it follows the part after #", async () => {
  const { window, group, lit } = open("http://127.0.0.1:7124/dev-hub/#panels");
  assert.deepEqual(lit(), ["The whole section"]);
  assert.ok(group("panels").classList.contains("open"));
  assert.ok(!group("tools").classList.contains("open"));
  window.location.hash = "#panel-jump";
  await new Promise((r) => window.setTimeout(r, 10));
  assert.deepEqual(lit(), ["Jump & find"]);
});

test("the front page lights its own link, and index.html counts as the folder", () => {
  assert.deepEqual(open("http://127.0.0.1:7124/").lit(), ["Front page"]);
  assert.deepEqual(open("http://127.0.0.1:7124/ar/index.html").lit(), ["Front page in Arabic"]);
});

test("a heading opens and closes its group", () => {
  const { group } = open("http://127.0.0.1:7124/");
  const head = group("tools").querySelector(".head");
  head.click();
  assert.ok(group("tools").classList.contains("open"));
  assert.equal(head.getAttribute("aria-expanded"), "true");
  head.click();
  assert.ok(!group("tools").classList.contains("open"));
});

test("folding to icons pushes the page less, is remembered, and opens a group beside its icon", () => {
  const first = open("http://127.0.0.1:7124/");
  first.root.querySelector(".fold").click();
  assert.ok(first.root.querySelector(".bar").classList.contains("folded"));
  assert.ok(first.window.document.documentElement.classList.contains("dev-sb-folded"));
  assert.equal(first.window.localStorage.getItem("hifth-dev-sidebar:folded"), "1");

  const again = open("http://127.0.0.1:7124/", { stored: { "hifth-dev-sidebar:folded": "1" } });
  assert.ok(again.root.querySelector(".bar").classList.contains("folded"), "folded again on the next page");
  const tools = again.group("tools");
  tools.querySelector(".head").click();
  assert.ok(tools.classList.contains("fly"));
  tools.querySelector(".head").click();
  assert.ok(tools.classList.contains("fly"), "a second click keeps it open");
  again.window.document.body.click();
  assert.ok(!tools.classList.contains("fly"), "a click elsewhere closes it");
  tools.querySelector(".head").click();
  again.window.document.dispatchEvent(new again.window.KeyboardEvent("keydown", { key: "Escape" }));
  assert.ok(!tools.classList.contains("fly"), "Escape closes it");
});

test("on a phone the side bar is a drawer: Menu opens it, Escape or the backdrop closes it", () => {
  const { window, root } = open("http://127.0.0.1:7124/", { phone: true, stored: { "hifth-dev-sidebar:folded": "1" } });
  const bar = root.querySelector(".bar");
  root.querySelector(".menu").click();
  assert.ok(bar.classList.contains("drawer"));
  assert.ok(!root.querySelector(".backdrop").hidden);
  window.document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
  assert.ok(!bar.classList.contains("drawer"));
  root.querySelector(".menu").click();
  root.querySelector(".backdrop").click();
  assert.ok(!bar.classList.contains("drawer"));
  const tools = root.querySelector('[data-group="tools"]');
  tools.querySelector(".head").click();
  assert.ok(tools.classList.contains("open") && !tools.classList.contains("fly"), "a phone opens groups in place, even when folded on the laptop");
});

// On a phone the comment bar (also on this laptop only) wraps to two rows across the bottom of
// the screen, and a Menu button placed there was hidden behind it (seen 2026-11-14 at 390 px).
test("on a phone the Menu button sits at the top, clear of the comment bar along the bottom", () => {
  const css = sidebarHtml({ designs: DESIGNS, features: featureCards(OLD_HUB) });
  const rule = css.match(/\.menu\{all:unset;[^}]*\}/)[0];
  assert.match(rule, /top:\d+px/);
  assert.doesNotMatch(rule, /bottom:/);
});

// "Panels open on arrival" was cut to "Panels open on arr…" at the side bar's width
// (seen 2026-11-14); a group's name wraps onto a second line instead.
test("a long group name wraps instead of being cut off", () => {
  const css = sidebarHtml({ designs: DESIGNS, features: featureCards(OLD_HUB) });
  const rule = css.match(/\.head \.label\{[^}]*\}/)[0];
  assert.match(rule, /min-width:0/);
  assert.doesNotMatch(rule, /nowrap|ellipsis/);
});

test("the design pages can be found by title", () => {
  const { root } = open("http://127.0.0.1:7124/");
  const find = root.querySelector('[data-group="designs"] input');
  find.value = "share";
  find.dispatchEvent(new find.ownerDocument.defaultView.Event("input"));
  const shown = [...root.querySelectorAll('[data-group="designs"] .items a:not(.all)')].filter((a) => !a.hidden).map((a) => a.firstChild.textContent);
  assert.deepEqual(shown, ["How should the share menu look?"]);
});
