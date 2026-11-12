/**
 * The landing pages must not call Hifth "free".
 *
 * Hifth will have paid features. Its code is open under the GNU GPL, and the GPL's
 * "free software" means free to read, change and share, not free of charge. A
 * visitor reads "free" as "costs nothing", so the footer said the wrong thing.
 * Found 2026-11-12 from Omar's comment on the footer ("We are going to have paid
 * features too"). Reads the source pages only, so it runs offline.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LANDING = join(dirname(fileURLToPath(import.meta.url)), "..", "apps", "landing");
const PAGES = ["index.html", "privacy.html", "404.html"];

/** Lines of a page's visible text that call something free. */
export function freeClaims(html) {
  return html
    .split("\n")
    .map((line) => line.replace(/<[^>]*>/g, " "))
    .filter((text) => /\bfree\b/i.test(text))
    .map((text) => text.trim());
}

test("the rule spots a free claim and ignores markup", () => {
  assert.deepEqual(freeClaims("<p>Hifth is free software under the GNU GPL.</p>"), [
    "Hifth is free software under the GNU GPL.",
  ]);
  assert.deepEqual(freeClaims('<p class="free-tier">Hifth is open source.</p>'), []);
});

test("no landing page calls Hifth free", () => {
  const found = [];
  for (const page of PAGES) {
    for (const claim of freeClaims(readFileSync(join(LANDING, page), "utf8"))) {
      found.push(`${page}: ${claim}`);
    }
  }
  assert.deepEqual(found, [], `paid features are planned; say "open source" instead:\n${found.join("\n")}`);
});

/** The declarations of one exact selector in a stylesheet, later rules winning. */
export function declarations(css, selector) {
  const out = {};
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  for (const [, sel, body] of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(rule)) {
    if (!sel.split(",").map((s) => s.trim()).includes(selector)) continue;
    for (const decl of body.split(";")) {
      const at = decl.indexOf(":");
      if (at > 0) out[decl.slice(0, at).trim()] = decl.slice(at + 1).trim();
    }
  }
  return out;
}

/**
 * Why the sign-up button beside the email box looks no bigger than the box.
 * Found 2026-11-12 from Omar's comment "Button feels bigger than email field": the
 * two were the same height, but the button was a bold, dark-outlined pill beside a
 * faint, gently rounded box. Returns what still differs; empty means they match.
 */
export function buttonOutweighsEmail(css) {
  const box = declarations(css, "#notify-email");
  const button = { ...declarations(css, ".button"), ...declarations(css, "#notify-form .button") };
  const differs = [];
  if (button["border-radius"] !== box["border-radius"]) {
    differs.push(`corners: button ${button["border-radius"]}, email box ${box["border-radius"]}`);
  }
  const weight = button["font-weight"] ?? button.font?.match(/^(\d{3})\s/)?.[1] ?? "400";
  if (Number(weight) > 500) differs.push(`button text weight ${weight}, heavier than 500`);
  return differs;
}

test("the rule spots a pill button beside a rounded box", () => {
  const pill = ".button { border-radius: 999px; font: 600 16px/1.2 sans-serif; } #notify-email { border-radius: 12px; }";
  assert.equal(buttonOutweighsEmail(pill).length, 2);
});

test("the sign-up button does not outweigh the email box", () => {
  const css = readFileSync(join(LANDING, "styles.css"), "utf8");
  assert.deepEqual(buttonOutweighsEmail(css), []);
});

// The wordmark is set in Aref Ruqaa (owner, 2026-11-12, a comment on the front page). The font is
// kept on the site, cut down to the wordmark's letters, so the page asks no outside host for it.
// A cut file holds only those letters, so any other Arabic set in it would fall back unseen.
test("the wordmark's font is kept on the site and holds the wordmark's letters", () => {
  const css = readFileSync(join(LANDING, "styles.css"), "utf8");
  const face = css.match(/@font-face\s*{[^}]*}/)?.[0] ?? "";
  assert.match(face, /font-family:\s*"Aref Ruqaa"/);
  const url = face.match(/url\("?([^")]+)"?\)/)?.[1];
  assert.ok(url && !/^https?:/.test(url), "the font is served from the site itself");
  const font = readFileSync(join(LANDING, url));
  assert.equal(font.subarray(0, 4).toString("latin1"), "wOF2");
  assert.ok(font.length < 20_000, `the cut font is small (${font.length} bytes)`);
  assert.match(css, /\.wordmark\s*{[^}]*"Aref Ruqaa"/);
  const html = readFileSync(join(LANDING, "index.html"), "utf8");
  const words = [...html.matchAll(/class="wordmark"[^>]*>([^<]+)</g)].map((m) => m[1].trim());
  assert.deepEqual(words, ["حفظ"], "only the wordmark is set in the cut font");
});

// Device tabs (owner, 2026-11-12, a comment on the front page): one tab per device. The ones
// that work today open the app in the browser; the apps that have not shipped say "coming soon"
// and lead to the sign-up form. They are radio buttons and CSS, so they work with scripts off.
test("each device tab has a panel, and only what exists today opens the app", () => {
  const html = readFileSync(join(LANDING, "index.html"), "utf8");
  const css = readFileSync(join(LANDING, "styles.css"), "utf8");
  const tabs = [...html.matchAll(/<input[^>]*name="device"[^>]*id="device-([\w-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(tabs, ["desktop", "mobile", "ipad", "iphone", "mac"]);
  for (const tab of tabs) {
    const panel = html.match(new RegExp(`<div class="device-panel" id="panel-${tab}"[\\s\\S]*?</div>\\s*<!-- /panel -->`))?.[0];
    assert.ok(panel, `a panel for ${tab}`);
    assert.match(html, new RegExp(`<label for="device-${tab}"`), `a label for ${tab}`);
    assert.match(css, new RegExp(`#device-${tab}:checked ~ \\.device-panels #panel-${tab}`), `CSS shows ${tab}'s panel`);
    const app = tab === "iphone" || tab === "mac";
    if (app) {
      assert.match(panel, /coming soon/i, `${tab} says coming soon`);
      assert.match(panel, /href="#notify"/, `${tab} leads to the sign-up form`);
      assert.doesNotMatch(panel, /href="\/read\/"/, `${tab} does not open the browser app as if it were the app`);
    } else {
      assert.match(panel, /href="\/read\/"/, `${tab} opens the app`);
    }
  }
  assert.equal((html.match(/name="device"[^>]*checked/g) ?? []).length, 1, "one tab starts chosen");
});

// The pitch to The Study Quran's team is private; the public front page never names it or
// promises its commentary (project CLAUDE.md, "What we are building right now").
test("the public front page does not name The Study Quran", () => {
  for (const name of PAGES) {
    const html = readFileSync(join(LANDING, name), "utf8");
    assert.doesNotMatch(html, /study\s*quran/i, name);
  }
});

/**
 * Every picture the front page shows must be in the folder and allowed to ship.
 *
 * The pictures are taken by `make landing-shots` into apps/landing/shots/, and the
 * release copies only the kinds the allow list in shipped.mjs names. A picture the
 * page names but nobody took, or one in a kind the release drops, is a broken image
 * on hifth.app that no test of the app would notice. Added 2026-11-12 with the
 * front page's pictures.
 */
import { existsSync } from "node:fs";
import { auditShipped } from "../.claude/skills/deploy-site/scripts/shipped.mjs";

/** The shots/ pictures a page names, as paths from the site's root. */
export function picturesNamed(html) {
  const found = new Set();
  for (const [, url] of html.matchAll(/(?:src|href|srcset)="([^"]+)"/g)) {
    for (const part of url.split(",")) {
      const path = part.trim().split(/\s+/)[0].replace(/^\.?\//, "");
      if (path.startsWith("shots/")) found.add(path);
    }
  }
  return [...found].sort();
}

/** What is wrong with each picture a page names: missing from the folder, or refused by the release. */
export function pictureProblems(html, landing = LANDING) {
  const problems = [];
  for (const path of picturesNamed(html)) {
    if (!existsSync(join(landing, path))) problems.push(`${path}: not in apps/landing (run make landing-shots)`);
    const refused = auditShipped([{ path, text: null }]).problems.filter((p) => p.path === path);
    for (const { why } of refused) problems.push(`${path}: ${why}`);
  }
  return problems;
}

test("the picture check finds a missing picture, a refused kind and a pitch picture", () => {
  const html = [
    '<img src="/shots/nobody-took-this.jpg" alt="">',
    '<img src="shots/moving.gif" alt="">',
    '<source srcset="/shots/pitch-commentary.jpg 2x, /shots/also-missing.webp 1x">',
    '<a href="/read/">not a picture</a>',
  ].join("\n");
  assert.deepEqual(picturesNamed(html), [
    "shots/also-missing.webp",
    "shots/moving.gif",
    "shots/nobody-took-this.jpg",
    "shots/pitch-commentary.jpg",
  ]);
  const problems = pictureProblems(html);
  for (const path of picturesNamed(html)) {
    assert.ok(problems.some((p) => p.startsWith(`${path}: not in apps/landing`)), `${path} should be missing`);
  }
  assert.ok(problems.some((p) => p.startsWith("shots/moving.gif: not on the list")), problems.join("\n"));
  assert.ok(problems.some((p) => p.startsWith("shots/pitch-commentary.jpg: a picture from a pitch build")), problems.join("\n"));
});

test("every picture the front page names is in the folder and allowed to ship", () => {
  const html = readFileSync(join(LANDING, "index.html"), "utf8");
  const problems = pictureProblems(html);
  assert.deepEqual(problems, [], problems.join("\n"));
});
