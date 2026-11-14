/**
 * What may go up to hifth.app, and what must never.
 *
 * The release reads the exact folder it is about to upload and refuses it if it holds a file
 * the site does not need, or a sign of a development feature. Two lists do the work:
 *
 *   ALLOWED  the files the site needs: the front page at the root (with its pictures in shots/
 *            and the wordmark's font in fonts/), its Arabic copy in ar/, the app under read/.
 *            Anything else is refused, so a new kind of file has to be added here on purpose.
 *   NEVER    files that are refused with a reason, because each could really end up in the
 *            folder on this laptop. A pitch build leaves read/pitch/ behind (found 2026-11-11),
 *            and the build writes debug copies of the source next to the app.
 *   MARKERS  words that only a development feature would put in a shipped file.
 *
 * Owner, 2026-11-11: "ensuring the bare minimum is deployed (in prod, no dev functionality)".
 * Tests: shipped.test.mjs. The release script, release-hifth-app.mjs, calls auditShipped.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

const ALLOWED = [
  /^(index\.html|privacy\.html|404\.html|styles\.css|notify\.js|_headers|_redirects)$/,
  /^ar\/(index|privacy)\.html$/,
  /^shots\/[\w-]+\.(png|jpg|webp)$/,
  /^fonts\/[\w.-]+\.(woff2|txt)$/,
  /^read\/(index\.html|sw\.js|workbox-[\w-]+\.js|manifest\.webmanifest|favicon\.svg)$/,
  /^read\/icons\/[\w.-]+$/,
  /^read\/assets\/.+$/,
];

const NEVER = [
  [/(^|\/)\./, "a hidden file; nothing on the site starts with a dot"],
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

const REQUIRED = ["index.html", "privacy.html", "404.html", "read/index.html", "read/sw.js"];

const TEXT = new Set([".html", ".js", ".css", ".json", ".webmanifest", ".svg", ".txt", ".xml"]);

/** Whether a shipped file is read as text and searched for development markers. */
export function isText(path) {
  return TEXT.has(extname(path)) || /(^|\/)_(headers|redirects)$/.test(path);
}

/**
 * @param {{path: string, text: string | null}[]} files  every file in the folder, with the text
 *   of each text file and null for pictures and fonts
 * @param {{commit?: string}} opts  the commit being released; the app must carry it
 * @returns {{problems: {path: string, why: string}[], files: number}}
 */
export function auditShipped(files, opts = {}) {
  const problems = [];
  for (const { path, text } of files) {
    const never = NEVER.find(([re]) => re.test(path));
    if (never) {
      problems.push({ path, why: never[1] });
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
