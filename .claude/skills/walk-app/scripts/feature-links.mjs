#!/usr/bin/env node
// The features page on the development hub (docs/design/feature-links.md).
//
// One card per place, tool, panel and layout a link can open. Each card has a
// picture, a link that opens it in the browser and the app's own hifth:// link,
// plus the laptop command that sends that link to the iPad. The lists come from
// the link contract (docs/design/app-url-scheme.openapi.json), which the app's
// Swift parser and the web router are both held to, so a new tool or panel
// without a line here stops the page being written.
//
//   node feature-links.mjs                       write .dev-hub/index.html
//   node feature-links.mjs --shots --base URL    also take pictures from the site at URL
//   node feature-links.mjs --out DIR             write somewhere else
//
// Pictures come from the public build only. Before taking any, the script asks
// the site for the pitch build's private commentary file and refuses if it gets
// it, and during the run it fails on any private file the page manages to load.
// The page is served at /dev-hub/ by the dev server (apps/web/src/dev/dev-hub.ts).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");

/** Panels only the private pitch build has; the public build drops them. */
export const PITCH_ONLY_PANELS = ["commentary", "context"];

const PAGE = 7;
const VERSE = "2:255";
/** A verse with look-alikes and roots worth showing. */
const LINKED_VERSE = "2:48";

const TOOL_USE = {
  read: "Read with nothing in hand: a stray touch opens nothing.",
  select: "Touch a verse to open the verses like it, or drag across a passage.",
  highlight: "Drag across a passage to colour it, to find it again at a glance.",
  bookmark: "Touch a page to drop a bookmark and come back to it.",
  note: "Touch a word to pin a note to it.",
  harakat: "Point at a vowel sign to note it.",
  word: "Touch a word to open it into its parts.",
  mistake: "Touch a word to mark a mistake in your recitation, by its kind.",
  crop: "Drag a box over the page to cut part of it out.",
};

const PANEL_USE = {
  jump: "Go to a page, a juz or a surah.",
  about: "What the app is, and where its pages come from.",
  record: "Your revision record: what you revised, and when.",
  shelf: "The record by juz, where a juz is saved for reading offline.",
  key: "The colour key for the tajweed colouring.",
  editions: "Choose which mus'haf to read.",
  tips: "Short tips on what the app can do.",
  lookalikes: "The verses that read like this one, to keep them apart.",
  roots: "The roots of this verse's words, and where else they appear.",
  commentary: "The verse's commentary, beside the page. Pitch build only.",
  context: "The commentary led by the surah's introduction. Pitch build only.",
};

const VIEW_USE = {
  one: "One page at a time, as on a phone.",
  two: "Two pages side by side, as the mus'haf lies open.",
};

const PANEL_ON_VERSE = new Set(["lookalikes", "roots", "commentary", "context"]);

/** The lists a link can name, read from the contract's `open` action. */
export function readContract(json) {
  const params = json.paths["/x-callback-url/open"].get.parameters;
  const list = (name) => params.find((p) => p.name === name).schema.enum;
  const edition = params.find((p) => p.name === "edition");
  return {
    tools: list("tool"),
    panels: list("open"),
    views: list("view"),
    edition: edition?.schema?.default ?? "hafs-kfqc",
  };
}

const lineFor = (table, kind, key) => {
  const line = table[key];
  if (!line) throw new Error(`no line for ${kind} ${key}: say what a hafiz uses it for in feature-links.mjs`);
  return line;
};

/** Every card, in the order the page shows them. */
export function cards(contract) {
  const ed = contract.edition;
  const card = (group, key, name, use, route, query, extra = {}) => ({
    id: `${group === "places" ? "place" : group.slice(0, -1)}-${key}`,
    group,
    key,
    name,
    use,
    route: `/${ed}/${route}`,
    link: `hifth://x-callback-url/open?${query}`,
    pitchOnly: false,
    ...extra,
  });
  const out = [
    card("places", "page", `Page ${PAGE}`, "Open the page you are revising.", `p${PAGE}`, `page=${PAGE}`),
    card("places", "verse", `Verse ${VERSE}`, "Go straight to the verse you are stuck on.", VERSE, `verse=${VERSE}`),
    card("places", "surah", "Surah 18", "Start a surah at its first verse, with its introduction open (the introduction is pitch build only).", "18:1?open=context", "surah=18"),
    card("places", "words", `Words 3 to 7 of ${VERSE}`, "Point at a few words inside a verse; they pulse so the eye lands on them.", `${VERSE}?w=3-7`, `verse=${VERSE}&words=3-7`),
  ];
  for (const view of contract.views) {
    out.push(card("places", `view-${view}`, view === "two" ? "Two pages" : "One page", lineFor(VIEW_USE, "view", view), `p${PAGE}?view=${view}`, `page=${PAGE}&view=${view}`));
  }
  for (const tool of contract.tools) {
    out.push(card("tools", tool, title(tool), lineFor(TOOL_USE, "tool", tool), `p${PAGE}?tool=${tool}`, `page=${PAGE}&tool=${tool}`));
  }
  for (const panel of contract.panels) {
    const onVerse = PANEL_ON_VERSE.has(panel);
    const at = panel === "commentary" || panel === "context" ? VERSE : LINKED_VERSE;
    out.push(
      card(
        "panels",
        panel,
        panel === "lookalikes" ? "Look-alikes" : title(panel),
        lineFor(PANEL_USE, "panel", panel),
        onVerse ? `${at}?open=${panel}` : `p${PAGE}?open=${panel}`,
        onVerse ? `verse=${at}&open=${panel}` : `page=${PAGE}&open=${panel}`,
        { pitchOnly: PITCH_ONLY_PANELS.includes(panel) },
      ),
    );
  }
  return out;
}

const title = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const GROUPS = [
  ["places", "Places and layouts"],
  ["tools", "Tools in hand"],
  ["panels", "Panels open on arrival"],
];

/**
 * What the last `make feature-check` found for one card, as a line on the card.
 * `checks` is its results file (native/shots/feature-check/latest.json), or null.
 */
function checkLine(c, checks) {
  const r = checks?.results?.find((x) => x.id === c.id);
  if (!r) return `<p class="check none">Not checked in the app yet.</p>`;
  const when = `(${esc(checks.on ?? "app")}, ${esc(String(checks.at ?? "").slice(0, 10))})`;
  if (r.result === "pass") return `<p class="check pass">✓ Works in the app ${when}</p>`;
  if (r.result === "place-only") {
    const rest = String(r.why ?? "").replace(/^the verse is right;\s*/, "");
    return `<p class="check partial">✓ The place works in the app ${when}; ${esc(rest)}</p>`;
  }
  if (r.result === "not-in-build") return `<p class="check none">Not checked: the build checked was the public one ${when}.</p>`;
  return `<p class="check fail">✗ Not working in the app ${when}: ${esc(r.why ?? r.result)}</p>`;
}

/**
 * The page itself. `pictures` is the set of card ids with a picture on disk;
 * `checks` is the last `make feature-check` results file, or null.
 */
export function renderPage(all, { pictures, takenAt = null, checks = null }) {
  const cardHtml = (c) => {
    const command = `make app-device-open DEVICE="$HIFTH_IPAD" LINK='${c.link}'`;
    const picture = c.pitchOnly
      ? `<div class="shot none">Pitch build only: no picture is kept of it.</div>`
      : pictures.has(c.id)
        ? `<a href="../#${esc(c.route)}" class="shot"><img src="shots/${esc(c.id)}.png" alt="The public build at ${esc(c.name)}" loading="lazy"></a>`
        : `<div class="shot none">No picture yet. Run <code>make feature-links PICTURES=1</code>.</div>`;
    return `<article class="card${c.pitchOnly ? " pitch" : ""}" id="${esc(c.id)}">
  ${picture}
  <h3>${esc(c.name)}</h3>
  <p>${esc(c.use)}</p>
  ${checkLine(c, checks)}
  <div class="links">
    <a href="../#${esc(c.route)}">Open here</a>
    <a href="${esc(c.link)}" title="Works when this page is open on the iPad itself">Open in the iPad app</a>
  </div>
  <div class="cmd"><code>${esc(command)}</code><button type="button" data-copy="${esc(command)}">Copy</button></div>
</article>`;
  };
  const sections = GROUPS.map(([g, heading]) => {
    const inGroup = all.filter((c) => c.group === g);
    return `<section><h2>${esc(heading)} <span class="n">${inGroup.length}</span></h2><div class="grid">${inGroup.map(cardHtml).join("\n")}</div></section>`;
  }).join("\n");
  const shotCount = all.filter((c) => !c.pitchOnly && pictures.has(c.id)).length;
  const rs = checks?.results ?? [];
  const works = rs.filter((r) => r.result === "pass" || r.result === "place-only").length;
  const broken = rs.filter((r) => !["pass", "place-only", "not-in-build"].includes(r.result)).length;
  const checkSummary = checks
    ? `Checked in the app: ${works} of ${rs.length} work, ${broken} ${broken === 1 ? "does" : "do"} not (${esc(checks.on ?? "app")}, ${esc(String(checks.at ?? "").slice(0, 10))}). Run it again with <code>make feature-check SIM=&lt;simulator id&gt;</code> or <code>DEVICE="$HIFTH_IPAD"</code>.`
    : `Not yet checked in the app. <code>make feature-check SIM=&lt;simulator id&gt;</code> sends every card to the debug app and marks each one here.`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hifth features by link</title>
<link rel="icon" href="data:,">
<style>
:root { --bg:#f6f3ec; --card:#fffdf8; --ink:#1f1b16; --muted:#6b6257; --line:#e2dccf; --accent:#2f6b4f; --code:#efe9dc; --bad:#a3322a; }
@media (prefers-color-scheme: dark) { :root { --bg:#171513; --card:#211e1a; --ink:#ece6da; --muted:#a59c8f; --line:#38332c; --accent:#7fc3a0; --code:#2b2722; --bad:#f08a80; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.5 system-ui, -apple-system, sans-serif; }
main { max-width:1200px; margin:0 auto; padding:24px 16px 64px; }
h1 { font-size:1.6rem; margin:0 0 4px; }
.lead { color:var(--muted); margin:0 0 20px; max-width:70ch; }
.how { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:12px 16px; margin-bottom:28px; }
.how ol { margin:6px 0 0; padding-left:20px; }
h2 { font-size:1.15rem; margin:28px 0 12px; }
h2 .n { color:var(--muted); font-weight:400; }
.grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:14px; }
.card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:10px; display:flex; flex-direction:column; gap:6px; min-width:0; }
.card h3 { margin:4px 0 0; font-size:1rem; }
.card p { margin:0; color:var(--muted); font-size:.9rem; }
.shot { display:block; aspect-ratio:1194/834; border-radius:6px; overflow:hidden; background:var(--code); }
.shot img { width:100%; height:100%; object-fit:cover; display:block; }
.shot.none { display:flex; align-items:center; justify-content:center; text-align:center; padding:12px; color:var(--muted); font-size:.85rem; }
.pitch .shot.none { border:1px dashed var(--line); background:transparent; }
.check { font-size:.85rem; margin:0; }
.check.pass { color:var(--accent); }
.check.partial { color:var(--accent); }
.check.fail { color:var(--bad); font-weight:600; }
.check.none { color:var(--muted); }
.stale { color:var(--bad); font-weight:600; margin:8px 0 0; }
.links { display:flex; gap:12px; flex-wrap:wrap; font-size:.9rem; }
.links a { color:var(--accent); }
.cmd { display:flex; gap:6px; align-items:flex-start; margin-top:auto; }
.cmd code { flex:1; min-width:0; overflow-wrap:anywhere; font-size:.75rem; background:var(--code); padding:4px 6px; border-radius:4px; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
button { font:inherit; font-size:.8rem; border:1px solid var(--line); background:var(--card); color:var(--ink); border-radius:5px; padding:3px 8px; cursor:pointer; }
button.done { color:var(--accent); }
</style>
</head>
<body>
<main>
<h1>Every feature, by link</h1>
<p class="lead">One card for each place, tool and panel a link can open. "Open here" opens it in this browser. The command sends the same link to the app on the iPad, over the cable.</p>
<div class="how">
  <strong>Sending a link to the iPad</strong>
  <ol>
    <li>Plug the iPad in and unlock it. In the laptop's terminal, set <code>HIFTH_IPAD</code> to its name from <code>xcrun devicectl list devices</code>.</li>
    <li>Copy a card's command and run it from the repository.</li>
    <li>Not yet tried on the real iPad: whether the app turns the page or restarts is the first open question in the design note.</li>
  </ol>
  <p class="lead" style="margin:8px 0 0">Pictures: ${shotCount} of ${all.filter((c) => !c.pitchOnly).length}, from the public build${takenAt ? `, taken ${esc(takenAt)}` : ""}. Refresh them with <code>make feature-links PICTURES=1</code>.</p>
  <p class="lead" style="margin:8px 0 0">${checkSummary}</p>
  ${checks?.stale ? `<p class="stale">The crosses may be wrong: ${esc(checks.stale)}.</p>` : ""}
</div>
${sections}
</main>
<script>
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-copy]");
  if (!b) return;
  try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "Copied"; b.classList.add("done"); }
  catch { b.textContent = "Select and copy"; }
  setTimeout(() => { b.textContent = "Copy"; b.classList.remove("done"); }, 1500);
});
</script>
</body>
</html>
`;
}

/** The pitch build serves its private commentary as JSON; the public one has no such file. */
export function looksLikePitchBuild({ status, contentType }) {
  return status === 200 && /json/i.test(contentType ?? "");
}

const log = (ev, fields = {}) => {
  const kv = Object.entries(fields).map(([k, v]) => `${k}=${typeof v === "string" && /\s/.test(v) ? JSON.stringify(v) : v}`);
  console.log([new Date().toISOString(), `pid=${process.pid}`, `ev=${ev}`, ...kv].join(" "));
};

async function takePictures(all, { base, outDir }) {
  const probe = await fetch(new URL("assets/private/study-quran/key.json", base));
  if (looksLikePitchBuild({ status: probe.status, contentType: probe.headers.get("content-type") })) {
    throw new Error(`${base} hands out the pitch build's private commentary; pictures come from the public build only (make preview)`);
  }
  const require = createRequire(join(repo, "apps/web/package.json"));
  const { chromium } = require("@playwright/test");
  const browser = await chromium.launch();
  const shots = join(outDir, "shots");
  mkdirSync(shots, { recursive: true });
  try {
    for (const c of all.filter((x) => !x.pitchOnly)) {
      const context = await browser.newContext({ viewport: { width: 1194, height: 834 }, deviceScaleFactor: 1, locale: "en-US" });
      const page = await context.newPage();
      const leaked = [];
      page.on("response", (r) => {
        if (r.url().includes("/assets/private/") && r.ok()) leaked.push(r.url());
      });
      log("shot_start", { id: c.id });
      await page.goto(new URL(`?lang=en#${c.route}`, base).href, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(1200);
      if (leaked.length) throw new Error(`the page loaded a private file (${leaked[0]}); stopping`);
      await page.screenshot({ path: join(shots, `${c.id}.png`) });
      log("shot_done", { id: c.id });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

async function main(argv) {
  const arg = (name) => {
    const i = argv.indexOf(name);
    return i < 0 ? null : argv[i + 1];
  };
  const outDir = resolve(arg("--out") ?? join(repo, ".dev-hub"));
  const contract = readContract(JSON.parse(readFileSync(join(repo, "docs/design/app-url-scheme.openapi.json"), "utf8")));
  const all = cards(contract);
  mkdirSync(outDir, { recursive: true });
  let takenAt = null;
  if (argv.includes("--shots")) {
    const base = arg("--base") ?? "http://127.0.0.1:7123/";
    log("shots_begin", { base, cards: all.length });
    await takePictures(all, { base, outDir });
    takenAt = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
    writeFileSync(join(outDir, "taken-at.txt"), takenAt + "\n");
  } else if (existsSync(join(outDir, "taken-at.txt"))) {
    takenAt = readFileSync(join(outDir, "taken-at.txt"), "utf8").trim();
  }
  const shotsDir = join(outDir, "shots");
  const pictures = new Set(existsSync(shotsDir) ? readdirSync(shotsDir).filter((f) => f.endsWith(".png")).map((f) => f.slice(0, -4)) : []);
  const checksFile = join(repo, "native/shots/feature-check/latest.json");
  const checks = existsSync(checksFile) ? JSON.parse(readFileSync(checksFile, "utf8")) : null;
  writeFileSync(join(outDir, "index.html"), renderPage(all, { pictures, takenAt, checks }));
  log("page_written", { path: join(outDir, "index.html"), cards: all.length, pictures: pictures.size });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => {
    log("error", { msg: e.message });
    process.exit(1);
  });
}
