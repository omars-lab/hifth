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
const PAGES = ["index.html", "privacy.html", "404.html", "ar/index.html", "ar/privacy.html"];

/** Lines of a page's visible text that call something free. */
export function freeClaims(html) {
  return html
    .split("\n")
    .map((line) => line.replace(/<[^>]*>/g, " "))
    .filter((text) => /\bfree\b|مجان/i.test(text))
    .map((text) => text.trim());
}

test("the rule spots a free claim and ignores markup", () => {
  assert.deepEqual(freeClaims("<p>Hifth is free software under the GNU GPL.</p>"), [
    "Hifth is free software under the GNU GPL.",
  ]);
  assert.deepEqual(freeClaims("<p>حفظ تطبيق مجاني</p>"), ["حفظ تطبيق مجاني"]);
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
  for (const name of ["index.html", "ar/index.html"]) {
    const html = readFileSync(join(LANDING, name), "utf8");
    const words = [...html.matchAll(/class="wordmark"[^>]*>([^<]+)</g)].map((m) => m[1].trim());
    assert.deepEqual(words, ["حفظ"], `${name}: only the wordmark is set in the cut font`);
  }
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
    assert.doesNotMatch(html, /study\s*quran|القرآن الدراسي/i, name);
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

test("every picture the front pages name is in the folder and allowed to ship", () => {
  for (const name of ["index.html", "ar/index.html"]) {
    const problems = pictureProblems(readFileSync(join(LANDING, name), "utf8"));
    assert.deepEqual(problems, [], `${name}:\n${problems.join("\n")}`);
  }
});

/*
 * The front page in two languages (owner, 2026-11-12, a comment on the opening picture: "there
 * should also be a global bar to select language ... by default it should be english, but we
 * should have option to switch to arabic"). English is the page at /, Arabic is its own page at
 * /ar/, and a bar at the top of every page links the two. Two plain pages keep the site free of
 * scripts that rewrite words, so each works with scripts off and a search engine sees both.
 */
const BILINGUAL = [
  ["index.html", "ar/index.html"],
  ["privacy.html", "ar/privacy.html"],
];
const read = (name) => readFileSync(join(LANDING, name), "utf8");
const address = (name) => "/" + name.replace(/index\.html$/, "");

/** The language bar's links, as [href, lang, current?]. */
export function languageBar(html) {
  const bar = html.match(/<nav class="lang-bar"[\s\S]*?<\/nav>/)?.[0];
  if (!bar) return null;
  return [...bar.matchAll(/<a([^>]*)>/g)].map(([, attrs]) => [
    attrs.match(/href="([^"]+)"/)?.[1],
    attrs.match(/hreflang="([^"]+)"/)?.[1],
    /aria-current="page"/.test(attrs),
  ]);
}

test("the language bar spots the link to the page you are on", () => {
  const html = '<nav class="lang-bar" aria-label="Language"><a href="/" hreflang="en" aria-current="page">English</a> <a href="/ar/" hreflang="ar">العربية</a></nav>';
  assert.deepEqual(languageBar(html), [["/", "en", true], ["/ar/", "ar", false]]);
  assert.equal(languageBar("<p>no bar</p>"), null);
});

test("every page has the language bar, linking its English and Arabic copies", () => {
  for (const [en, ar] of BILINGUAL) {
    for (const [name, lang] of [[en, "en"], [ar, "ar"]]) {
      const html = read(name);
      assert.match(html, new RegExp(`<html lang="${lang}"${lang === "ar" ? ' dir="rtl"' : ""}>`), `${name} says its language`);
      assert.deepEqual(
        languageBar(html),
        [[address(en), "en", lang === "en"], [address(ar), "ar", lang === "ar"]],
        `${name}: English first, then Arabic, the page you are on marked`,
      );
      for (const [other, l] of [[en, "en"], [ar, "ar"]]) {
        assert.match(html, new RegExp(`<link rel="alternate" hreflang="${l}" href="https://hifth.app${address(other)}" />`), `${name} names its ${l} copy for search engines`);
      }
    }
  }
  assert.ok(languageBar(read("404.html")), "the page for a wrong address has the bar too");
});

/** What a front page is made of, to compare the two languages' copies. */
export function outline(html) {
  return {
    ids: [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]),
    features: (html.match(/<div class="feature">/g) ?? []).length,
    pictures: (html.match(/<img\s/g) ?? []).length,
    opens: (html.match(/href="\/read\/"/g) ?? []).length,
    form: html.match(/<form[^>]*>/)?.[0],
    fields: [...html.matchAll(/<input[^>]*name="([^"]+)"/g)].map((m) => m[1]),
  };
}

test("the Arabic front page has everything the English one has", () => {
  assert.deepEqual(outline(read("ar/index.html")), outline(read("index.html")));
});

// The app picks its own language from what the reader chose in it, then the browser. A link
// carrying ?lang= would beat the reader's own choice on every reload, since the app keeps the
// address it was opened with, so both pages open the app the same way.
test("both front pages open the app without forcing its language", () => {
  for (const name of ["index.html", "ar/index.html"]) assert.doesNotMatch(read(name), /\?lang=/, name);
});

test("the Arabic sign-up form answers in Arabic", () => {
  const html = read("ar/index.html");
  assert.match(html, /<input type="hidden" name="lang" value="ar" \/>/);
  assert.match(html, /class="cf-turnstile"[^>]*data-language="ar"/);
  assert.match(html, /href="\/ar\/privacy\.html"/, "it links the Arabic privacy page");
});

// The scripture check refuses runs of fully vowelled Arabic, which is how a verse looks. The
// page's own Arabic is plain words about the app, so it carries no vowel marks at all, and no
// line of it can be taken for a verse.
test("the Arabic pages carry no vowel marks", () => {
  for (const name of ["ar/index.html", "ar/privacy.html"]) {
    const marked = read(name).split("\n").filter((line) => /[\u064B-\u0652\u0670]/.test(line));
    assert.deepEqual(marked, [], name);
  }
});

/*
 * The opening picture shows the book both ways (owner, 2026-11-12: "i want to see two pages view
 * as well"): two facing pages as on a computer, and one page on a phone in front of it, each in
 * the language of the page around it.
 */
test("the opening picture shows two facing pages and a phone, in the page's language", () => {
  for (const [name, suffix] of [["index.html", ""], ["ar/index.html", "-ar"]]) {
    const figure = read(name).match(/<figure class="hero-picture"[\s\S]*?<\/figure>/)?.[0] ?? "";
    const imgs = [...figure.matchAll(/<img([^>]*)>/g)].map(([, a]) => ({
      src: a.match(/src="([^"]+)"/)?.[1],
      w: Number(a.match(/width="(\d+)"/)?.[1]),
      h: Number(a.match(/height="(\d+)"/)?.[1]),
    }));
    assert.deepEqual(imgs.map((i) => i.src), [`/shots/hero-spread${suffix}.jpg`, `/shots/hero-phone${suffix}.jpg`], name);
    assert.ok(imgs[0].w > imgs[0].h, `${name}: the facing pages are wider than tall`);
    assert.ok(imgs[1].h > imgs[1].w, `${name}: the phone is taller than wide`);
  }
});
