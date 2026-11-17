import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The release setup check, run against a made-up home folder and made-up key
// ids, so the tests never read the laptop's real App Store Connect key or the
// repo's saved settings. Only the key checks are run (--only), so no test asks
// Xcode or the keychain anything.
const script = fileURLToPath(new URL("./check-release-setup.mjs", import.meta.url));
const KEY_ID = "TEST123456";
const ISSUER = "00000000-0000-0000-0000-000000000000";

function home({ key, mode = 0o600 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "home-"));
  if (key) {
    mkdirSync(join(dir, ".appstoreconnect/private_keys"), { recursive: true });
    const file = join(dir, ".appstoreconnect/private_keys", `AuthKey_${key}.p8`);
    writeFileSync(file, "made-up, not a key\n");
    chmodSync(file, mode);
  }
  return dir;
}

// The two ids reach the check as ASC_KEY_ID and ASC_ISSUER_ID, the way
// `dotenvx run` hands over the repo's saved settings.
function check(dir, ids = {}) {
  const env = { ...process.env };
  delete env.ASC_KEY_ID;
  delete env.ASC_ISSUER_ID;
  if (ids.keyId) env.ASC_KEY_ID = ids.keyId;
  if (ids.issuerId) env.ASC_ISSUER_ID = ids.issuerId;
  const r = spawnSync(process.execPath, [script, "--home", dir, "--only", "key-file,key-ids"], { encoding: "utf8", env });
  return { code: r.status, said: r.stdout + r.stderr };
}

test("no key says it is missing, gives the page to make one, and fails", () => {
  const { code, said } = check(home());
  assert.equal(code, 1);
  assert.match(said, /missing\s+App Store Connect key file/);
  assert.match(said, /appstoreconnect\.apple\.com\/access\/integrations\/api/);
});

test("a key other people on the laptop can read is not ok", () => {
  const { code, said } = check(home({ key: KEY_ID, mode: 0o644 }), { keyId: KEY_ID, issuerId: ISSUER });
  assert.equal(code, 1);
  assert.match(said, /chmod 600/);
});

test("a key with its two ids passes, and neither id is printed", () => {
  const { code, said } = check(home({ key: KEY_ID }), { keyId: KEY_ID, issuerId: ISSUER });
  assert.equal(code, 0, said);
  assert.match(said, /ok\s+App Store Connect key file/);
  assert.match(said, /ok\s+App Store Connect key ID and issuer ID/);
  assert.doesNotMatch(said, new RegExp(KEY_ID));
  assert.doesNotMatch(said, new RegExp(ISSUER));
});

test("ids that name a different key than the file on disk are caught", () => {
  const { code, said } = check(home({ key: KEY_ID }), { keyId: "OTHER98765", issuerId: ISSUER });
  assert.equal(code, 1);
  assert.match(said, /no key file matches/);
});

test("a key file with no saved ids says how to save them", () => {
  const { code, said } = check(home({ key: KEY_ID }));
  assert.equal(code, 1);
  assert.match(said, /missing\s+App Store Connect key ID and issuer ID/);
  assert.match(said, /make env-set NAME=ASC_ISSUER_ID/);
});
