/**
 * What may go up to hifth.app, and what must never.
 *
 * The release reads the exact folder it is about to upload and refuses it if it holds a file
 * the site does not need, or a sign of a development feature. Two lists do the work:
 *
 *   ALLOWED  the files the site needs: the front page at the root (with its pictures in shots/
 *            and the wordmark's font in fonts/), its Arabic copy in ar/, the app under read/,
 *            the one file that tells Apple which links open the app (app-links.mjs), and the
 *            file the apps read at launch (app-status.mjs).
 *            Anything else is refused, so a new kind of file has to be added here on purpose.
 *   NEVER    files that are refused with a reason, because each could really end up in the
 *            folder on this laptop. A pitch build leaves read/pitch/ behind (found 2026-11-11),
 *            and the build writes debug copies of the source next to the app.
 *   MARKERS  words that only a development feature would put in a shipped file.
 *
 * Owner, 2026-11-11: "ensuring the bare minimum is deployed (in prod, no dev functionality)".
 * Tests: shipped.test.mjs. The release script, release-hifth-app.mjs, calls auditShipped.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { APP_LINKS_FILE, appLinksProblems } from "./app-links.mjs";
import { APP_STATUS_FILE, appStatusProblems } from "./app-status.mjs";

/**
 * Where the app's script rule (apps/landing/_headers, under /read/) leaves a gap for the
 * scripts written into the app's own page. Their words change with every build, so the release
 * fills the gap in (release-hifth-app.mjs, assemble).
 */
export const APP_SCRIPTS_GAP = "{app-inline-scripts}";

/**
 * The fingerprint a script rule needs to let each script written into a page run: SHA-256 of
 * the script's words exactly as they sit between its tags, in base64, the way browsers compute
 * it. A script loaded from a file (one with src) needs none.
 */
export function inlineScriptHashes(html) {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
    ([, words]) => `'sha256-${createHash("sha256").update(words, "utf8").digest("base64")}'`,
  );
}

const ALLOWED = [
  /^(index\.html|privacy\.html|sources\.html|support\.html|404\.html|styles\.css|notify\.js|_headers|_redirects)$/,
  /^ar\/(index|privacy|sources|support)\.html$/,
  /^shots\/[\w-]+\.(png|jpg|webp)$/,
  /^fonts\/[\w.-]+\.(woff2|txt)$/,
  /^read\/(index\.html|sw\.js|workbox-[\w-]+\.js|manifest\.webmanifest|favicon\.svg)$/,
  /^read\/icons\/[\w.-]+$/,
  /^read\/assets\/.+$/,
];

const NEVER = [
  // The one exception is the file that tells Apple which links open the app (app-links.mjs),
  // at exactly the path Apple fetches; its words are checked below.
  [/(^|\/)\./, "a hidden file; nothing on the site starts with a dot except Apple's links file", (path) => path !== APP_LINKS_FILE],
  [/\.map$/, "a debug copy of the source code, which only a developer needs"],
  [/^shots\/[^/]*pitch/, "a picture from a pitch build, which can show The Study Quran's text and never goes on the public site"],
  [/(^|\/)pitch\//, "part of a pitch build, which holds The Study Quran's text and never goes on the public site"],
  [/^read\/docs\//, "a design page; those stay at blog.bytesofpurpose.com/hifth/docs/"],
  [/^docs\//, "a design page, added on this laptop only for the developer side bar; those stay at blog.bytesofpurpose.com/hifth/docs/"],
  [/^dev-hub\//, "the features page, copied in on this laptop only for the developer side bar"],
  [/^(functions|lib)\//, "the server's own code, which would be readable as a plain file"],
];

export const MARKERS = [
  [/data-dev-sidebar/, "the developer side bar, which opens the features page and the design pages on this laptop only"],
  [/\/@vite\/client/, "the development server's live reload"],
  [/page-?comments/i, "the page-comment button, a development tool"],
  [/\/intent\/|\.intent\/|intent-picture/, "the 'what each commit was for' picture, which is served on this laptop only"],
  [/dev-fixtures\//, "the outside library's page data, which is served on this laptop only"],
  [/\b[123]x0{20}[A-Z]{2}\b/, "Cloudflare's test key for the spam check, which lets every robot through"],
  [/\blocalhost\b|127\.0\.0\.1/, "an address on this laptop, which no reader can reach"],
  [/\[contact address to come\]/, "the privacy page's placeholder, still waiting on a real contact address"],
  // The form reaches the list from the server side only; a page naming the project's address
  // would hand every reader the way to the list's door, and this repo keeps it out of sight.
  [/[\w-]+\.supabase\.co\b/, "a Supabase project's address, which only the form's server part may know (as a Pages secret)"],
  [/local-list-key-made-up-not-secret/, "the made-up site key that opens the list on this laptop only"],
];

/** The reason for each development sign found in a text, as "it mentions ..." lines. */
export function markersIn(text) {
  return MARKERS.filter(([re]) => re.test(text)).map(([, why]) => `it mentions ${why}`);
}

// The sources page is required in both languages: the permission emails send the rights
// holders to it (launch-citations-page). So is the support page: Apple asks every store
// listing for one (launch-support-page). And so is the links file: without it, no hifth.app
// link opens the app (launch item 9). And so is the file the apps read at launch: without it,
// a bad version could not be answered until Apple reviewed a new one (launch item 21).
const REQUIRED = [
  APP_LINKS_FILE,
  APP_STATUS_FILE,
  "index.html",
  "privacy.html",
  "sources.html",
  "ar/sources.html",
  "support.html",
  "ar/support.html",
  "404.html",
  "read/index.html",
  "read/sw.js",
];

const TEXT = new Set([".html", ".js", ".css", ".json", ".webmanifest", ".svg", ".txt", ".xml"]);

/** Whether a shipped file is read as text and searched for development markers. */
export function isText(path) {
  return TEXT.has(extname(path)) || /(^|\/)_(headers|redirects)$/.test(path) || path === APP_LINKS_FILE;
}

/**
 * @param {{path: string, text: string | null}[]} files  every file in the folder, with the text
 *   of each text file and null for pictures and fonts
 * @param {{commit?: string, shipping?: string}} opts  the commit being released, which the app
 *   must carry, and the apps' version in native/project.yml, which the launch file must not
 *   tell to update
 * @returns {{problems: {path: string, why: string}[], files: number}}
 */
export function auditShipped(files, opts = {}) {
  const problems = [];
  for (const { path, text } of files) {
    const never = NEVER.find(([re, , applies = () => true]) => re.test(path) && applies(path));
    if (never) {
      problems.push({ path, why: never[1] });
      continue;
    }
    if (path === APP_LINKS_FILE) {
      for (const why of appLinksProblems(text)) problems.push({ path, why });
      continue;
    }
    if (path === APP_STATUS_FILE) {
      for (const why of appStatusProblems(text, { shipping: opts.shipping })) problems.push({ path, why });
      continue;
    }
    if (!ALLOWED.some((re) => re.test(path))) {
      problems.push({ path, why: "not on the list of files hifth.app needs (shipped.mjs, ALLOWED)" });
      continue;
    }
    if (text == null) continue;
    for (const why of markersIn(text)) problems.push({ path, why });
    if (path === "_headers" && /cross-origin-opener-policy/i.test(text)) {
      problems.push({
        path,
        why: "it sets Cross-Origin-Opener-Policy, which cuts the old address's tab off from hifth.app's, so readers could not carry their marks across (apps/web/src/moved.ts)",
      });
    }
  }
  const headers = files.find((f) => f.path === "_headers")?.text ?? "";
  if (headers.includes(APP_SCRIPTS_GAP)) {
    problems.push({
      path: "_headers",
      why: "the app's script rule was never filled in with the fingerprint of the script in its page; put the folder together with the release script, not by hand",
    });
  }
  const appPage = files.find((f) => f.path === "read/index.html")?.text ?? "";
  const refused = inlineScriptHashes(appPage).filter((hash) => !headers.includes(hash));
  if (refused.length) {
    problems.push({
      path: "read/index.html",
      why: `browsers would refuse ${refused.length} script(s) written into the app's page, because the app's script rule does not name them; the app would still work, but fetch the reader's language one round trip later, with a refusal in every reader's console`,
    });
  }
  const have = new Set(files.map((f) => f.path));
  for (const path of REQUIRED) {
    if (!have.has(path)) problems.push({ path, why: "missing; the site does not work without it" });
  }
  if (opts.commit) {
    const carries = files.some(
      (f) => f.path.startsWith("read/assets/") && f.path.endsWith(".js") && f.text?.includes(opts.commit),
    );
    if (!carries) {
      problems.push({
        path: "read/assets",
        why: `the app does not carry commit ${opts.commit.slice(0, 8)}, so its source-code offer would name the wrong source; rebuild from that commit`,
      });
    }
  }
  return { problems, files: files.length };
}

/** Every file under a folder, as auditShipped takes them, with the total size. */
export function readFolder(dir) {
  const files = [];
  let bytes = 0;
  const walk = (at) => {
    for (const name of readdirSync(at).sort()) {
      const full = join(at, name);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
        continue;
      }
      const path = relative(dir, full).split(sep).join("/");
      bytes += stat.size;
      files.push({ path, text: isText(path) ? readFileSync(full, "utf8") : null });
    }
  };
  walk(dir);
  return { files, bytes };
}
