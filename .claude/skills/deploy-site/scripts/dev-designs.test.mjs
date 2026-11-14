/**
 * The design pages on hifth.app served on this laptop, which the developer side bar lists.
 *
 * Owner, 2026-11-13: "when we are running the landing hub in localhost mode, there is a tab for
 * designs for devs ... that will take us to pages like docs/design/hifth-app-mailing-list.html".
 * The design pages are added to the local folder only, after the release check has looked at
 * it, and the check refuses them if they ever reach a folder about to go up. Since 2026-11-14
 * the developer side bar lists them (dev-sidebar.mjs), in place of a floating Designs button.
 * Written before dev-designs.mjs and seen failing.
 *
 * Run with: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { addDevDesigns, commitDates, designList, notePage } from "./dev-designs.mjs";
import { fixtureEnv } from "../../../../scripts/gate-fixture.mjs";
import { execFileSync } from "node:child_process";
import { auditShipped, readFolder } from "./shipped.mjs";

function tree(root, files) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "hifth-dev-designs-"));
  const out = join(root, "out");
  const built = join(root, "built-docs");
  const notes = join(root, "notes");
  tree(out, {
    "index.html": "<html><body><h1>Hifth</h1></body></html>",
    "ar/index.html": "<html dir=rtl><body><h1>Hifth</h1></body></html>",
    "privacy.html": "<html><body><p>privacy</p></body></html>",
    "404.html": "<html><body><p>none</p></body></html>",
    "read/index.html": "<html><body><div id=root></div></body></html>",
  });
  tree(built, {
    "index.html": "<html><title>Hifth design pages</title></html>",
    "design/hifth-app-mailing-list.html": "<html><head><title>Hifth notify list</title></head></html>",
    "design/page-bar-options.html": "<html><head><title>Page bar options</title></head></html>",
  });
  tree(notes, {
    "share-look.md": "# How should the share menu look?\n\n![Plain](share-look/phone.png)\n",
    "share-look/phone.png": "png",
    "hifth-app-mailing-list.md": "# How should hifth.app's mailing list work?\n\nText.\n",
  });
  const old = new Date("2026-01-01");
  utimesSync(join(built, "design/page-bar-options.html"), old, old);
  return { out, built, notes };
}

test("the list holds the option pages and the written notes, newest first", () => {
  const { out, built, notes } = fixture();
  const list = addDevDesigns({ out, builtDocs: built, notes });
  const titles = list.map((d) => d.title);
  assert.ok(titles.includes("Hifth notify list"));
  assert.ok(titles.includes("How should the share menu look?"));
  const note = list.find((d) => d.title === "How should the share menu look?");
  assert.equal(note.href, "/docs/design/share-look.md.html");
  assert.equal(note.kind, "note");
  assert.ok(titles.indexOf("Hifth notify list") < titles.indexOf("Page bar options"), "a page changed recently is listed before an old one");
});

test("the front pages are left alone; the side bar, not this, puts a menu on them", () => {
  const { out, built, notes } = fixture();
  addDevDesigns({ out, builtDocs: built, notes });
  assert.equal(readFileSync(join(out, "index.html"), "utf8"), "<html><body><h1>Hifth</h1></body></html>");
});

test("the pages themselves are copied in, and a written note is drawn as a page with its pictures", () => {
  const { out, built, notes } = fixture();
  addDevDesigns({ out, builtDocs: built, notes });
  assert.ok(existsSync(join(out, "docs/design/hifth-app-mailing-list.html")));
  assert.ok(existsSync(join(out, "docs/index.html")));
  const note = readFileSync(join(out, "docs/design/share-look.md.html"), "utf8");
  assert.match(note, /<h1[^>]*>How should the share menu look\?<\/h1>/);
  assert.match(note, /src="share-look\/phone\.png"/);
  assert.ok(existsSync(join(out, "docs/design/share-look/phone.png")));
  const index = readFileSync(join(out, "docs/design/index.html"), "utf8");
  assert.match(index, /Page bar options/);
  assert.match(index, /How should hifth\.app's mailing list work\?/);
});

test("the release check refuses the design pages if they ever reach a folder going up", () => {
  const { out, built, notes } = fixture();
  addDevDesigns({ out, builtDocs: built, notes });
  const { problems } = auditShipped(readFolder(out).files);
  const why = (path) => problems.filter((p) => p.path === path).map((p) => p.why).join(" | ");
  assert.match(why("docs/design/hifth-app-mailing-list.html"), /design page/);
});

test("the list is read from the folders, so a new design page shows up with no list to edit", () => {
  const { built, notes } = fixture();
  writeFileSync(join(built, "design/new-thing-options.html"), "<title>A new thing</title>");
  const titles = designList({ builtDocs: built, notes }).map((d) => d.title);
  assert.ok(titles.includes("A new thing"));
});

test("each page is dated by its last commit, not by when the build copied it", () => {
  const repo = mkdtempSync(join(tmpdir(), "hifth-dev-designs-git-"));
  const env = fixtureEnv();
  const git = (...args) => execFileSync("git", ["-C", repo, ...args], { env, stdio: "pipe" });
  git("init", "-q");
  tree(repo, { "docs/design/old.html": "<title>Old</title>", "docs/design/new.md": "# New\n" });
  git("add", "docs/design/old.html");
  execFileSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-qm", "old"], {
    env: { ...env, GIT_COMMITTER_DATE: "2026-01-02T00:00:00Z" },
    stdio: "pipe",
  });
  git("add", "docs/design/new.md");
  execFileSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-qm", "new"], {
    env: { ...env, GIT_COMMITTER_DATE: "2026-03-04T00:00:00Z" },
    stdio: "pipe",
  });
  git("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "--allow-empty", "-m", "x");
  const dates = commitDates(repo, "docs/design");
  assert.equal(new Date(dates.get("new.md")).toISOString().slice(0, 10), "2026-03-04");
  assert.ok(dates.has("old.html"));
  assert.ok(dates.get("old.html") < dates.get("new.md"));
});

test("a note's highlighted boxes are drawn as boxes, and a folded one opens on a tap", () => {
  const html = notePage(
    "# T\n\n> [!tip] Recommended\n> Keep it.\n\n> [!example]- The pictures\n> ![a](a.png)\n\n> Just a quote.\n",
    "T",
  );
  assert.doesNotMatch(html, /\[!tip\]|\[!example\]/);
  assert.match(html, /<aside class="callout callout-tip"><p class="callout-title">Recommended<\/p>\s*<p>Keep it\.<\/p>/);
  assert.match(html, /<details class="callout callout-example"><summary>The pictures<\/summary>[\s\S]*src="a\.png"/);
  assert.match(html, /<blockquote>\s*<p>Just a quote\.<\/p>/);
});
