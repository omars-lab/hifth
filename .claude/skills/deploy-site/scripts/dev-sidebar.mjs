/**
 * The developer side bar on hifth.app served on this laptop.
 *
 * Owner, 2026-11-14: "as part of our landing page, can we have a side bar that only appears in
 * local host mode that ingresses into pages like …/.dev-hub/index.html#panels .. it should be
 * inspired by sidebar of earlbear-agentic-workflow".
 *
 * prepare (release-hifth-app.mjs) calls these after the release check has looked at the folder,
 * so the check sees the folder as it would go up. They add, to the local copy only:
 *
 *   dev-hub/        the features page (`make feature-links`), its links pointed at the app in /read/
 *   the side bar    on the front pages, the features page and the written design notes
 *
 * The side bar works like earlbear's: groups of pages under headings, each heading folds, the
 * page you are on is lit, the bar folds to icons (a group's pages then open beside its icon), and
 * on a phone it is a drawer behind a Menu button. It replaces the floating Designs button: the
 * design pages are its last group. It is drawn in a shadow root, so neither the page's styles nor
 * its own leak across.
 *
 * publish always rebuilds the folder from scratch, so none of it can ride along. If it ever did,
 * the release check refuses it: dev-hub/ is not a file hifth.app needs, and the side bar carries
 * a word only it uses (shipped.mjs, NEVER and MARKERS). Tests: dev-sidebar.test.mjs.
 */
import { cpSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

/** The word the release check looks for; only the side bar puts it in a page. */
export const SIDEBAR_MARK = "data-dev-sidebar";

/** The features page's sections, by the heading each is drawn under. */
export const FEATURE_GROUPS = [
  ["places", "Places and layouts"],
  ["tools", "Tools in hand"],
  ["panels", "Panels open on arrival"],
];

/** hifth.app's own pages; the side bar goes on each, never on the app under read/. */
export const FRONT_PAGES = ["index.html", "privacy.html", "404.html", "ar/index.html", "ar/privacy.html"];

const SITE_LINKS = [
  ["/", "Front page"],
  ["/ar/", "Front page in Arabic"],
  ["/privacy.html", "Privacy page"],
  ["/404.html", "Page not found"],
  ["/read/", "The app"],
];

const escape = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const unescape = (s) =>
  String(s).replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" })[e]);

const noGitEnv = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));

/**
 * Where the features page was last built: this checkout's own `.dev-hub/` if it has one, else
 * the newest among the repo's other worktrees (the page is built where the walk runs).
 * @param {{repo: string, worktrees?: string[]}} where
 * @returns {{dir: string, takenAt: string | null} | null}
 */
export function findFeaturesPage({ repo, worktrees = listWorktrees(repo) }) {
  const has = (root) => existsSync(join(root, ".dev-hub", "index.html"));
  const pick = has(repo)
    ? repo
    : worktrees
        .filter((w) => w !== repo && has(w))
        .sort((a, b) => statSync(join(b, ".dev-hub", "index.html")).mtimeMs - statSync(join(a, ".dev-hub", "index.html")).mtimeMs)[0];
  if (!pick) return null;
  const dir = join(pick, ".dev-hub");
  const stamp = join(dir, "taken-at.txt");
  return { dir, takenAt: existsSync(stamp) ? readFileSync(stamp, "utf8").trim() || null : null };
}

function listWorktrees(repo) {
  const r = spawnSync("git", ["-C", repo, "worktree", "list", "--porcelain"], { encoding: "utf8", env: noGitEnv() });
  return (r.stdout ?? "")
    .split("\n")
    .filter((l) => l.startsWith("worktree "))
    .map((l) => l.slice("worktree ".length));
}

/**
 * The features page as served from hifth.app: its links into the app point at /read/ (the page
 * is built to sit one folder below the app), and each section has an id a link can jump to,
 * added by heading for a page built before the sections had them.
 */
export function featuresPage(html) {
  let out = html.replace(/href="\.\.\/#/g, 'href="/read/#');
  for (const [id, heading] of FEATURE_GROUPS) {
    out = out.replace(new RegExp(`<section><h2>${heading}\\b`), `<section id="${id}"><h2>${heading}`);
  }
  return out;
}

/**
 * The cards on the features page, by section.
 * @returns {{id: string, heading: string, cards: {id: string, title: string}[]}[]}
 */
export function featureCards(html) {
  const page = featuresPage(html);
  return FEATURE_GROUPS.map(([id, heading]) => {
    const start = page.indexOf(`<section id="${id}">`);
    const end = start < 0 ? -1 : page.indexOf("</section>", start);
    const body = start < 0 ? "" : page.slice(start, end < 0 ? undefined : end);
    // A card marked "pitch" opens a panel only the private pitch build has; it is listed all
    // the same, since the link goes to its card on the features page, and marked as such.
    const cards = [...body.matchAll(/<article class="card( pitch)?" id="([^"]+)">[\s\S]*?<h3>([^<]*)<\/h3>/g)].map((m) => ({
      id: m[2],
      title: unescape(m[3]).trim(),
      ...(m[1] ? { pitch: true } : {}),
    }));
    return { id, heading, cards };
  }).filter((g) => g.cards.length);
}

/**
 * Copy the features page into the local folder, at /dev-hub/.
 * @returns {{id: string, heading: string, cards: {id: string, title: string}[]}[]} its sections
 */
export function copyFeaturesPage({ from, out }) {
  const to = join(out, "dev-hub");
  cpSync(from, to, { recursive: true });
  const file = join(to, "index.html");
  const html = featuresPage(readFileSync(file, "utf8"));
  writeFileSync(file, html);
  return featureCards(html);
}

// Small line icons, drawn in the side bar's own colour.
const PATHS = {
  site: "M3 11l9-7 9 7M5 9.5V20h5v-6h4v6h5V9.5",
  places: "M3 5h7a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H3zM21 5h-7a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h7z",
  tools: "M4 20l4.5-1L19 8.5 15.5 5 5 15.5zM13.5 7l3.5 3.5",
  panels: "M3 4h18v16H3zM14 4v16M16.5 8h2M16.5 11h2",
  designs: "M12 3v3M12 6l-6 15M12 6l6 15M8 15h8",
  chevron: "M9 6l6 6-6 6",
  fold: "M14 6l-6 6 6 6M19 6v12",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6L6 18",
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${PATHS[name]}"/></svg>`;

const WIDE = 256;
const NARROW = 68;

const STYLE = `
:host{all:initial}
*{box-sizing:border-box}
.bar{--ink:#1d1b17;--soft:#6b6457;--paper:#f3eee3;--card:#fffdf8;--rule:#d9d2c3;--lit:#e4dac4;--accent:#2e5d8a;
  position:fixed;z-index:2147483000;left:0;top:0;bottom:0;width:${WIDE}px;display:flex;flex-direction:column;
  background:var(--paper);color:var(--ink);border-right:1px solid var(--rule);font:14px/1.4 system-ui,-apple-system,sans-serif}
@media (prefers-color-scheme:dark){.bar{--ink:#ece6d9;--soft:#a39b8c;--paper:#201f1b;--card:#2a2924;--rule:#3a372f;--lit:#3b382f;--accent:#8db8e0}}
header{display:flex;align-items:center;gap:.5rem;padding:14px 14px 10px;border-bottom:1px solid var(--rule)}
.brand{font-weight:700;font-size:15px;white-space:nowrap}
.brand small{display:block;font-weight:400;font-size:12px;color:var(--soft)}
nav{flex:1;overflow:auto;padding:8px}
.group{margin-bottom:2px}
.head{all:unset;box-sizing:border-box;width:100%;display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-weight:600;color:var(--ink)}
.head:hover,.head:focus-visible{background:var(--lit)}
.head:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.head .label{flex:1;min-width:0;line-height:1.25}
.count{font-weight:400;font-size:12px;color:var(--soft)}
.chev{transition:transform .15s;color:var(--soft)}
.group.open .chev{transform:rotate(90deg)}
.items{display:none;padding:2px 0 6px 30px}
.group.open .items{display:block}
.items a{display:block;padding:5px 10px;border-radius:6px;color:var(--ink);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.items a:hover,.items a:focus-visible{background:var(--lit)}
.items a.lit{background:var(--lit);font-weight:600;box-shadow:inset 3px 0 0 var(--accent)}
.items a.whole{color:var(--soft);font-style:italic}
.items a.all{border-top:1px solid var(--rule);margin-top:4px;padding-top:8px;font-weight:600}
.items a small{color:var(--soft);font-size:11px;margin-left:.35rem}
.items a[hidden]{display:none}
.items .none{margin:4px 10px;color:var(--soft)}
.items code{font-size:12px}
.items input{width:100%;margin:2px 0 6px;padding:6px 8px;border:1px solid var(--rule);border-radius:6px;background:var(--card);color:var(--ink);font:inherit}
.fly-title{display:none}
footer{border-top:1px solid var(--rule);padding:8px}
.fold{all:unset;box-sizing:border-box;width:100%;display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;color:var(--soft)}
.fold:hover,.fold:focus-visible{background:var(--lit);color:var(--ink)}
.close,.menu{display:none}
.vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

/* Folded to icons: only the icons show, and a group's pages open beside its icon. */
.bar.folded{width:${NARROW}px}
.bar.folded header{justify-content:center;padding:14px 4px 10px}
.bar.folded .brand small,.bar.folded .brand .word{display:none}
.bar.folded nav{overflow:visible;padding:8px 10px}
.bar.folded .head{justify-content:center;padding:10px}
.bar.folded .head .label,.bar.folded .count,.bar.folded .chev,.bar.folded .fold .label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.bar.folded .fold{justify-content:center}
.bar.folded .fold svg{transform:rotate(180deg)}
.bar.folded .items{position:fixed;left:${NARROW + 4}px;width:260px;max-height:calc(100vh - 24px);overflow:auto;padding:6px;
  background:var(--card);border:1px solid var(--rule);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.18)}
.bar.folded .group.open .items{display:none}
.bar.folded .group.fly .items{display:block}
.bar.folded .fly-title{display:block;margin:2px 10px 6px;font-weight:700}

/* A phone: the side bar is a drawer behind a Menu button, and never folds. */
@media (max-width:640px){
  .bar,.bar.folded{width:min(300px,85vw);transform:translateX(-100%);transition:transform .2s;box-shadow:none}
  .bar.drawer{transform:none;box-shadow:0 0 40px rgba(0,0,0,.3)}
  .bar.folded header{justify-content:flex-start;padding:14px 14px 10px}
  .bar.folded .brand small,.bar.folded .brand .word{display:inline}
  .bar.folded .brand small{display:block}
  .bar.folded nav{overflow:auto;padding:8px}
  .bar.folded .head{justify-content:flex-start;padding:8px 10px}
  .bar.folded .head .label,.bar.folded .count,.bar.folded .chev{position:static;width:auto;height:auto;clip:auto}
  .bar.folded .items{position:static;width:auto;max-height:none;background:none;border:0;box-shadow:none;padding:2px 0 6px 30px}
  .bar.folded .group.open .items{display:block}
  .bar.folded .fly-title{display:none}
  footer{display:none}
  .close{all:unset;margin-left:auto;display:flex;padding:6px;border-radius:6px;cursor:pointer}
  .close:hover,.close:focus-visible{background:var(--lit)}
  .menu{all:unset;position:fixed;z-index:2147483000;left:12px;top:12px;display:flex;align-items:center;gap:6px;padding:9px 14px;border-radius:999px;
    background:#2b2a26;color:#f6f1e6;font:600 14px/1 system-ui,-apple-system,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer}
  .backdrop{position:fixed;inset:0;z-index:2147482999;background:rgba(0,0,0,.4)}
}
.backdrop[hidden]{display:none}
@media (prefers-reduced-motion:reduce){.bar,.chev{transition:none}}`;

// Pushes the page over so the side bar never covers it; the left side even on the Arabic page,
// because the bar itself is always on the left.
const PUSH = `<style data-dev-sidebar-push>@media (min-width:641px){html{padding-left:${WIDE}px!important}html.dev-sb-folded{padding-left:${NARROW}px!important}}</style>`;

function group({ key, label, iconName, count, items }) {
  return `<div class="group" data-group="${key}">
<button type="button" class="head" aria-expanded="false" title="${escape(label)}">${icon(iconName)}<span class="label">${escape(label)}</span>${count == null ? "" : `<span class="count">${count}</span>`}<span class="chev">${icon("chevron")}</span></button>
<div class="items"><p class="fly-title">${escape(label)}</p>${items}</div></div>`;
}

const link = (href, text, cls = "", extra = "") =>
  `<a href="${escape(href)}"${cls ? ` class="${cls}"` : ""}>${escape(text)}${extra}</a>`;

const day = (ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * The side bar, as one block of HTML to put before </body>.
 * @param {{designs: {href: string, title: string, kind: string, mtime: number}[],
 *   features: {id: string, heading: string, cards: {id: string, title: string}[]}[] | null}} what
 *   the design pages (designList), and the features page's sections, or null when there is none
 */
export function sidebarHtml({ designs, features }) {
  const groups = [
    group({
      key: "site",
      label: "hifth.app",
      iconName: "site",
      count: SITE_LINKS.length,
      items: SITE_LINKS.map(([href, text]) => link(href, text)).join(""),
    }),
  ];
  for (const [id, heading] of FEATURE_GROUPS) {
    const section = features?.find((g) => g.id === id);
    const items = section
      ? link(`/dev-hub/#${id}`, "The whole section", "whole") + section.cards.map((c) => link(`/dev-hub/#${c.id}`, c.title, "", c.pitch ? "<small>pitch only</small>" : "")).join("")
      : `<p class="none">No features page yet. Run <code>make feature-links</code>, then serve again.</p>`;
    groups.push(group({ key: id, label: heading, iconName: id, count: section ? section.cards.length : null, items }));
  }
  groups.push(
    group({
      key: "designs",
      label: "Design pages",
      iconName: "designs",
      count: designs.length,
      items:
        `<input type="search" placeholder="Find a design page" aria-label="Find a design page">` +
        designs
          .map((d) => link(d.href, d.title, "", `<small>${d.kind === "note" ? "note" : "page"} · ${day(d.mtime)}</small>`))
          .join("") +
        link("/docs/design/index.html", "All design pages", "all") +
        link("/docs/", "The design front door", "all"),
    }),
  );
  const shadow = `<style>${STYLE}</style>
<button type="button" class="menu" aria-expanded="false" aria-controls="bar">${icon("menu")}Menu</button>
<div class="backdrop" hidden></div>
<aside class="bar" id="bar" aria-label="Pages for developers on this laptop">
<header><span class="brand"><span class="word">Hifth</span><small>on this laptop only</small></span><button type="button" class="close" aria-label="Close the menu">${icon("close")}</button></header>
<nav>${groups.join("\n")}</nav>
<footer><button type="button" class="fold" aria-pressed="false">${icon("fold")}<span class="label">Fold to icons</span></button></footer>
</aside>`;
  return `
<!-- Developer side bar: added on this laptop only by the deploy-site skill's prepare step; a release refuses it. -->
${PUSH}<div ${SIDEBAR_MARK} dir="ltr" lang="en"><template>${shadow}</template><script>(${behaviour.toString()})(document.currentScript.parentElement)</script></div>
`;
}

/**
 * What the side bar does, run in the page. Written as a function so it is checked like the rest
 * of this file, then put in the page as its source text.
 */
function behaviour(host) {
  const KEY = "hifth-dev-sidebar:folded";
  const root = host.attachShadow({ mode: "open" });
  root.append(host.querySelector("template").content.cloneNode(true));
  const $ = (s) => root.querySelector(s);
  const bar = $(".bar");
  const menu = $(".menu");
  const backdrop = $(".backdrop");
  const fold = $(".fold");
  const groups = [...root.querySelectorAll(".group")];
  const phone = () => matchMedia("(max-width: 640px)").matches;

  let folded = false;
  try {
    folded = localStorage.getItem(KEY) === "1";
  } catch {
    // Storage blocked (a private window): start unfolded.
  }
  const setFolded = (on) => {
    folded = on;
    bar.classList.toggle("folded", on);
    document.documentElement.classList.toggle("dev-sb-folded", on);
    fold.setAttribute("aria-pressed", String(on));
    fold.querySelector(".label").textContent = on ? "Show the labels" : "Fold to icons";
    closeFly();
    try {
      localStorage.setItem(KEY, on ? "1" : "0");
    } catch {
      // Storage blocked: the fold still works, it is just not remembered.
    }
  };

  // The page you are on is lit, by path and by the part of the page after #.
  const norm = (p) => p.replace(/index\.html$/, "");
  const light = () => {
    const links = [...root.querySelectorAll(".items a")];
    for (const a of links) a.classList.remove("lit");
    const path = norm(location.pathname);
    const at = (a) => new URL(a.href, location.href);
    const lit =
      links.find((a) => norm(at(a).pathname) === path && at(a).hash === location.hash) ??
      links.find((a) => norm(at(a).pathname) === path && !at(a).hash);
    if (!lit) return null;
    lit.classList.add("lit");
    lit.setAttribute("aria-current", "page");
    return lit;
  };
  const openGroup = (g, on) => {
    g.classList.toggle("open", on);
    g.querySelector(".head").setAttribute("aria-expanded", String(on));
  };

  // Folded: a group's pages open beside its icon, on hover or a click.
  let flying = null;
  function closeFly() {
    if (!flying) return;
    flying.classList.remove("fly");
    flying.querySelector(".head").setAttribute("aria-expanded", "false");
    flying = null;
  }
  const openFly = (g) => {
    if (flying === g) return;
    closeFly();
    flying = g;
    g.classList.add("fly");
    g.querySelector(".head").setAttribute("aria-expanded", "true");
    const items = g.querySelector(".items");
    const top = g.querySelector(".head").getBoundingClientRect().top;
    items.style.top = `${Math.max(12, Math.min(top, innerHeight - items.offsetHeight - 12))}px`;
  };
  for (const g of groups) {
    const head = g.querySelector(".head");
    head.addEventListener("click", () => {
      // Hovering has usually opened it already, so a click keeps it open rather than closing it.
      if (folded && !phone()) openFly(g);
      else openGroup(g, !g.classList.contains("open"));
    });
    g.addEventListener("mouseenter", () => folded && !phone() && openFly(g));
    g.addEventListener("mouseleave", () => folded && !phone() && flying === g && closeFly());
  }
  document.addEventListener("click", (e) => {
    if (flying && !e.composedPath().includes(flying)) closeFly();
  });

  // A phone: the side bar is a drawer.
  const drawer = (on) => {
    bar.classList.toggle("drawer", on);
    backdrop.hidden = !on;
    menu.setAttribute("aria-expanded", String(on));
    if (on) $(".close").focus();
  };
  menu.addEventListener("click", () => drawer(true));
  $(".close").addEventListener("click", () => {
    drawer(false);
    menu.focus();
  });
  backdrop.addEventListener("click", () => drawer(false));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (flying) closeFly();
    else if (bar.classList.contains("drawer")) {
      drawer(false);
      menu.focus();
    }
  });
  // A link to another part of the same page closes the drawer, so the page shows.
  root.addEventListener("click", (e) => {
    if (e.target.closest?.(".items a")) {
      drawer(false);
      closeFly();
    }
  });

  fold.addEventListener("click", () => setFolded(!folded));

  // Find a design page by its title.
  const find = root.querySelector('[data-group="designs"] input');
  find?.addEventListener("input", () => {
    const q = find.value.toLowerCase();
    for (const a of root.querySelectorAll('[data-group="designs"] .items a:not(.all)')) {
      a.hidden = Boolean(q) && !a.textContent.toLowerCase().includes(q);
    }
  });

  const showHere = () => {
    const lit = light();
    const g = lit?.closest(".group");
    if (g) openGroup(g, true);
    return lit;
  };
  setFolded(folded);
  showHere()?.scrollIntoView?.({ block: "nearest" });
  addEventListener("hashchange", showHere);
}

/**
 * Put the side bar on the front pages, the features page and the written design notes.
 * @param {{out: string, designs: object[], features: object[] | null}} what
 * @returns {string[]} the pages it went on, relative to the folder
 */
export function addDevSidebar({ out, designs, features }) {
  const block = sidebarHtml({ designs, features });
  const notes = join(out, "docs", "design");
  const pages = [
    ...FRONT_PAGES,
    "dev-hub/index.html",
    "docs/design/index.html",
    ...(existsSync(notes) ? readdirSync(notes).filter((n) => n.endsWith(".md.html")).map((n) => `docs/design/${n}`) : []),
  ];
  const done = [];
  for (const page of pages) {
    const file = join(out, page);
    if (!existsSync(file)) continue;
    const html = readFileSync(file, "utf8");
    writeFileSync(file, /<\/body>/i.test(html) ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, () => `${block}</body>`) : html + block);
    done.push(page);
  }
  return done;
}
