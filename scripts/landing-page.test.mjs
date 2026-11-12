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
