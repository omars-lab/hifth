#!/usr/bin/env node
// The archive's receipt: proof that the archive about to be signed or sent to
// Apple is the one `make app-archive` made and checked, untouched since.
//
//   --write <archive>  after the release check passes: fingerprint every file
//                      in the app inside the archive, and save that beside it
//                      as <archive>.receipt.json, with the commit it was made
//                      from and whether the tree was clean
//   --check <archive>  before the export and the upload: the receipt is there,
//                      and the app inside still matches it file for file
//
// Why: the export and the upload took whatever folder sat at the archive's
// path. An archive made by hand in Xcode, an older one, or one with a file
// changed after the checks would have been signed and sent just the same,
// without ever passing the checks that keep the private build and the walk
// capture out of the store (backlog launch-archive-upload).
//
// Exit codes: 0 ok, 1 refused (with the reason), 2 used wrongly.
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync, writeFileSync, rmSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const APP = "Products/Applications/Hifth.app";
// The command that makes this archive: the iPad and iPhone one by default,
// `--by "make app-archive-mac"` for the Mac's, so a refusal names the right one.
const BY = () => arg("--by") ?? "make app-archive";

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

function say(line) {
  process.stdout.write(`${line}\n`);
}

/** Every file under the app, by its path inside it, in a fixed order. */
function files(root) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const at = join(dir, name);
      const st = lstatSync(at);
      if (st.isDirectory()) walk(at);
      else out.push(at);
    }
  };
  walk(root);
  return out;
}

/**
 * One hash over each file's path and its bytes (a link's target, for a link),
 * so a changed, added, removed or renamed file all give a different answer.
 */
function fingerprint(app) {
  const all = files(app);
  const hash = createHash("sha256");
  for (const at of all) {
    const st = lstatSync(at);
    const body = st.isSymbolicLink() ? Buffer.from(`link:${readlinkSync(at)}`) : readFileSync(at);
    hash.update(relative(app, at));
    hash.update("\0");
    hash.update(createHash("sha256").update(body).digest("hex"));
    hash.update("\n");
  }
  return { fingerprint: hash.digest("hex"), files: all.length };
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

const receiptOf = (archive) => `${archive}.receipt.json`;

function write(archive) {
  const app = join(archive, APP);
  // A failed run leaves no receipt behind from an earlier archive.
  rmSync(receiptOf(archive), { force: true });
  if (!existsSync(app)) {
    say(`ev=no_app archive=${archive}`);
    say(`  There is no app inside ${archive}, so it is not an archive this command can vouch for.`);
    process.exit(2);
  }
  const commit = arg("--commit") ?? git("rev-parse", "HEAD");
  const cleanArg = arg("--clean");
  const clean = cleanArg ? cleanArg === "yes" : git("status", "--porcelain").length === 0;
  const flavour = arg("--flavour") ?? null;
  const { fingerprint: fp, files: n } = fingerprint(app);
  const receipt = {
    madeBy: BY(),
    archive: resolve(archive),
    commit,
    clean,
    flavour,
    files: n,
    fingerprint: fp,
    at: new Date().toISOString(),
  };
  writeFileSync(receiptOf(archive), `${JSON.stringify(receipt, null, 2)}\n`);
  say(`ev=receipt_written commit=${commit.slice(0, 12)} clean=${clean ? "yes" : "no"} files=${n} fingerprint=${fp.slice(0, 12)}`);
}

function refuse(why) {
  say(`ev=receipt_refused`);
  say(`  ${why}`);
  say(`  Only an archive made and checked by ${BY()} is signed or sent. Run: ${BY()}`);
  process.exit(1);
}

function check(archive) {
  const at = receiptOf(archive);
  if (!existsSync(at)) refuse(`The archive at ${archive} has no receipt, so it was not made by ${BY()}.`);
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(at, "utf8"));
  } catch {
    refuse(`The receipt beside ${archive} cannot be read.`);
  }
  if (typeof receipt?.fingerprint !== "string" || !/^[0-9a-f]{64}$/.test(receipt.fingerprint))
    refuse(`The receipt beside ${archive} has no fingerprint.`);
  const app = join(archive, APP);
  if (!existsSync(app)) refuse(`There is no app inside ${archive}.`);
  const now = fingerprint(app);
  if (now.fingerprint !== receipt.fingerprint)
    refuse(
      `The app inside ${archive} has changed since make app-archive checked it (${receipt.files} files then, ${now.files} now).`,
    );
  say(
    `ev=receipt_ok commit=${String(receipt.commit).slice(0, 12)} clean=${receipt.clean ? "yes" : "no"} files=${now.files} made=${receipt.at}`,
  );
  if (!receipt.clean) say(`  Note: this archive was made from uncommitted work.`);
}

const toWrite = arg("--write");
const toCheck = arg("--check");
if (toWrite) write(toWrite);
else if (toCheck) check(toCheck);
else {
  say("usage: archive-receipt.mjs --write <archive> [--flavour public] | --check <archive>  [--by <the command that makes it>]");
  process.exit(2);
}
