// The guard that stops a Claude session from printing a saved secret.
//
// On 2026-11-13 a hand-run decrypt printed every saved value into a chat: the command sent
// stdout away, but the tool wrote the values to stderr. The two Cloudflare tokens were replaced
// (the database password too, if the owner reset it). The guard refuses the ways a session could show a value, and lets the
// name-only commands through. Every command below is made up; none carries a real value.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const GUARD = join(dirname(fileURLToPath(import.meta.url)), "guard-secrets.py");

const run = (tool_name, tool_input) =>
  spawnSync("python3", [GUARD], { input: JSON.stringify({ tool_name, tool_input }), encoding: "utf8" });
const bash = (command) => run("Bash", { command });

const REFUSED = [
  ["the command that leaked", "npx dotenvx decrypt --stdout -f ../hifth/.env.encrypted -fk ../hifth/.env.keys 2>&1 >/dev/null | head -5"],
  ["a decrypt with no redirection", "dotenvx decrypt -f .env.encrypted"],
  ["reading one value", "npx dotenvx get SUPABASE_DB_URL"],
  ["printing the key pair", "npx -y @dotenvx/dotenvx@2.28.0 keypair"],
  ["a run that prints the whole environment", "npx dotenvx run -f .env -- printenv"],
  ["a run that echoes a value", "dotenvx run -- echo $CLOUDFLARE_API_TOKEN"],
  ["a run into a shell", "dotenvx run -- sh -c 'echo $X'"],
  ["a run into node that prints", "dotenvx run -- node -e 'console.log(process.env)'"],
  ["showing the plain file", "cat .env"],
  ["showing the plain file in another checkout", "head -3 ../hifth/.env"],
  ["searching the plain file", "grep TOKEN /Users/someone/repo/.env"],
  ["showing the key file", "cat .env.keys"],
  ["loading the plain file into the shell", "source .env && echo $SUPABASE_DB_URL"],
  ["reading the key from the password manager", "lpass show --notes dotenvx/hifth"],
  ["copying the plain file, then reading the copy", "cp ../hifth/.env x && cat x"],
  ["a python script that opens the plain file", "python3 - <<'EOF'\nprint(open('../hifth/.env').read())\nEOF"],
  ["reading the plain file into a variable", "X=$(<.env); echo ok"],
  ["redirecting the plain file with no space", "cat<.env"],
  ["a run into node that prints one value", "dotenvx run -- node -p process.env.X"],
  ["a run in debug mode, which prints every value it loads", "npx dotenvx run --debug -f .env -- node build.mjs"],
  ["an echo of a command that reads the file", 'echo "$(cat .env.keys)"'],
  ["a local override file", "cat .env.local"],
];

for (const [what, command] of REFUSED) {
  test(`refused: ${what}`, () => {
    const r = bash(command);
    assert.equal(r.status, 2, `should refuse: ${command}`);
    assert.match(r.stderr, /make env-check/, "the refusal names the safe command");
  });
}

const ALLOWED = [
  ["the name-only check", "make env-check"],
  ["the token check", "make cf-tokens"],
  ["a building script run with the settings loaded", "npx dotenvx run -q -f ../hifth/.env -- node packages/etl/scripts/qul-page-fixture.mjs --page 1"],
  ["the names in the encrypted file", "sed -E 's/=.*//' ../hifth/.env.encrypted"],
  ["the encrypted file in git", "git show HEAD:.env.encrypted | wc -l"],
  ["the example file", "cat .env.example"],
  ["a word that only looks like the file", "grep -rn dotenv scripts/env/README.md"],
  ["the shape check on a saved value", "python3 scripts/env/lib/envfile.py check SUPABASE_DB_URL .env"],
  ["a commit message that mentions the refused commands", 'git commit -m "Refuse dotenvx decrypt, lpass show and cat .env"'],
  ["searching a script for the words", 'grep -n "lpass show" scripts/env/env-keys.sh'],
  ["a run of a script whose name has 'get' in it", "npx dotenvx run -f .env -- node scripts/get-pages.mjs"],
  ["listing the plain file", "ls -l .env"],
  ["moving the old key aside", "mv .env.keys .env.keys.old"],
  ["a word that ends in env", "cat .envrc.md"],
  ["a recursive search in a folder with no plain file", "grep -rn TOKEN scripts"],
];

for (const [what, command] of ALLOWED) {
  test(`allowed: ${what}`, () => {
    const r = bash(command);
    assert.equal(r.status, 0, `should allow: ${command}\n${r.stderr}`);
  });
}

test("the file-reading tools may not open the plain file or the key file", () => {
  assert.equal(run("Read", { file_path: "/x/repo/.env" }).status, 2);
  assert.equal(run("Read", { file_path: "/x/repo/.env.keys" }).status, 2);
  assert.equal(run("Grep", { pattern: "TOKEN", path: "/x/repo/.env" }).status, 2);
  assert.equal(run("Read", { file_path: "/x/repo/.env.encrypted" }).status, 0);
  assert.equal(run("Read", { file_path: "/x/repo/scripts/env/env-set.sh" }).status, 0);
});

test("a recursive search over a folder that holds the plain file is refused", () => {
  const dir = mkdtempSync(join(tmpdir(), "guard-"));
  writeFileSync(join(dir, ".env"), "MADE_UP=1\n");
  const inDir = (command) => spawnSync("python3", [GUARD], { input: JSON.stringify({ tool_name: "Bash", tool_input: { command }, cwd: dir }), encoding: "utf8" });
  assert.equal(inDir("grep -rn SUPABASE_DB_URL .").status, 2, "plain grep -r does not skip ignored files");
  assert.equal(inDir("grep -rn SUPABASE_DB_URL").status, 2, "no folder given means this one");
  assert.equal(inDir("rg --hidden TOKEN").status, 2);
  assert.equal(inDir("grep -rn --exclude='.env*' TOKEN .").status, 0);
  assert.equal(inDir("rg TOKEN").status, 0, "rg skips hidden and ignored files by default");
});

test("input it cannot read lets the call through rather than stopping all work", () => {
  const r = spawnSync("python3", [GUARD], { input: "not json", encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /could not check/, "a guard that could not run says so");
});
