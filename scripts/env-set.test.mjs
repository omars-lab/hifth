// The hidden-prompt save (make env-set) says what shape a value should be before
// asking for it, refuses a value of the wrong shape without saving or printing it,
// and refuses to run at all when only the encrypted settings file is here: saving
// then would rebuild the encrypted file from one value and drop every other entry.
//
// Every address below is made up. The password in each is a marker, so a test can
// check the refusal never repeats it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ENV = join(dirname(fileURLToPath(import.meta.url)), "env");
const ENVFILE = join(ENV, "lib", "envfile.py");
const PASS = "Marker-Pass-123";
const REF = "abcdefghijklmnopqrst"; // made up, 20 letters like a real one
const GOOD = `postgresql://postgres.${REF}:${PASS}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`;

const envfile = (args, input = "") =>
  spawnSync("python3", [ENVFILE, ...args], { input, encoding: "utf8" });
const fresh = () => join(mkdtempSync(join(tmpdir(), "env-set-")), ".env");

test("it shows the expected shape of the database address before asking", () => {
  const r = envfile(["hint", "SUPABASE_DB_URL"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /postgresql:\/\/postgres\.<project ref>:<password>@/);
  assert.match(r.stdout, /session pooler/i);
  assert.match(r.stdout, /5432/);
});

test("a name with no shape on file says so, and asks nothing more", () => {
  const r = envfile(["hint", "SOME_OTHER_SECRET"]);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
});

test("a database address of the right shape is saved, readable only by you", () => {
  const file = fresh();
  const r = envfile(["set", "SUPABASE_DB_URL", file], GOOD + "\n");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(file, "utf8"), `SUPABASE_DB_URL='${GOOD}'\n`);
  assert.equal(statSync(file).mode & 0o777, 0o600);
});

const WRONG = [
  ["the dashboard's password placeholder left in",
   GOOD.replace(PASS, "[YOUR-PASSWORD]"), /placeholder/],
  ["the direct address, which needs IPv6",
   `postgresql://postgres:${PASS}@db.${REF}.supabase.co:5432/postgres`, /direct address/],
  ["the transaction pooler's port",
   GOOD.replace(":5432/", ":6543/"), /6543/],
  ["the pooler with a plain user name",
   GOOD.replace(`postgres.${REF}`, "postgres"), /postgres\.<project ref>/],
  ["another region's pooler (the old store's)",
   GOOD.replace("us-east-1", "us-west-2"), /us-east-1/],
  ["something that is not a database address",
   `https://${REF}.supabase.co`, /postgresql:\/\//],
  ["a password with an @ not written as %40",
   GOOD.replace(PASS, `${PASS}@x`), /%40/],
  ["a password with a # not written as %23",
   GOOD.replace(PASS, `${PASS}#x`), /%23/],
  ["encryption turned off",
   GOOD + "?sslmode=disable", /unencrypted/],
  ["a space pasted in",
   GOOD.replace(":5432", " :5432"), /space/],
];

for (const [what, value, says] of WRONG) {
  test(`refused, nothing saved and the password not shown: ${what}`, () => {
    const file = fresh();
    const r = envfile(["set", "SUPABASE_DB_URL", file], value + "\n");
    assert.equal(r.status, 1, `should refuse; stdout: ${r.stdout}`);
    assert.match(r.stderr, says);
    assert.match(r.stderr, /nothing saved/);
    assert.ok(!existsSync(file), "no file written");
    assert.ok(!(r.stderr + r.stdout).includes(PASS), "the password is never printed");
  });
}

test("a name with no shape on file is saved as given", () => {
  const file = fresh();
  const r = envfile(["set", "SOME_OTHER_SECRET", file], "anything at all\n");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(file, "utf8"), "SOME_OTHER_SECRET='anything at all'\n");
});

test("with only the encrypted settings file here, saving refuses and says what to run first", () => {
  const dir = mkdtempSync(join(tmpdir(), "env-set-"));
  writeFileSync(join(dir, ".env.encrypted"), "CLOUDFLARE_API_TOKEN=encrypted:made-up\n");
  const r = spawnSync("bash", [join(ENV, "env-set.sh"), "SUPABASE_DB_URL"], {
    cwd: dir,
    input: GOOD + "\n",
    encoding: "utf8",
  });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /make env-keys-pull/);
  assert.match(r.stderr, /make env-bootstrap/);
  assert.ok(!existsSync(join(dir, ".env")), "no plain file written");
  assert.equal(readFileSync(join(dir, ".env.encrypted"), "utf8"), "CLOUDFLARE_API_TOKEN=encrypted:made-up\n");
});

test("the settings check finds a value saved in the wrong shape, by name only", () => {
  const file = fresh();
  writeFileSync(file, `CLOUDFLARE_ACCOUNT_ID='made-up'\nSUPABASE_DB_URL='https://${REF}.supabase.co'\n`);
  const r = envfile(["shapes", file]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /SUPABASE_DB_URL is not the expected shape/);
  assert.ok(!(r.stderr + r.stdout).includes(REF), "the saved value is never printed");
  writeFileSync(file, `SUPABASE_DB_URL='${GOOD}'\n`);
  const ok = envfile(["shapes", file]);
  assert.equal(ok.status, 0, ok.stderr);
  assert.ok(!(ok.stderr + ok.stdout).includes(PASS));
});
