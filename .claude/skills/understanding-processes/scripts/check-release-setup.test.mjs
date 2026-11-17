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

const REVIEWS_ID = "REVIEW7890";

function home({ key, mode = 0o600, reviewsKey, reviewsMode = 0o600 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "home-"));
  const place = (id, m) => {
    mkdirSync(join(dir, ".appstoreconnect/private_keys"), { recursive: true });
    const file = join(dir, ".appstoreconnect/private_keys", `AuthKey_${id}.p8`);
    writeFileSync(file, "made-up, not a key\n");
    chmodSync(file, m);
  };
  if (key) place(key, mode);
  if (reviewsKey) place(reviewsKey, reviewsMode);
  return dir;
}

// The ids reach the check as ASC_KEY_ID, ASC_REVIEWS_KEY_ID and ASC_ISSUER_ID,
// the way `dotenvx run` hands over the repo's saved settings.
function check(dir, ids = {}, only = "key-file,key-ids") {
  const env = { ...process.env };
  delete env.ASC_KEY_ID;
  delete env.ASC_REVIEWS_KEY_ID;
  delete env.ASC_ISSUER_ID;
  delete env.ASC_VENDOR_NUMBER;
  if (ids.vendor) env.ASC_VENDOR_NUMBER = ids.vendor;
  if (ids.keyId) env.ASC_KEY_ID = ids.keyId;
  if (ids.reviewsId) env.ASC_REVIEWS_KEY_ID = ids.reviewsId;
  if (ids.issuerId) env.ASC_ISSUER_ID = ids.issuerId;
  const r = spawnSync(process.execPath, [script, "--home", dir, "--only", only], { encoding: "utf8", env });
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

// The second key, hifth-reviews, reads and answers store reviews and pulls the
// download and sales reports. A release never needs it, so a missing one is
// reported and never fails the check.
test("the reviews key in place passes, and its id is never printed", () => {
  const dir = home({ key: KEY_ID, reviewsKey: REVIEWS_ID });
  const { code, said } = check(dir, { keyId: KEY_ID, reviewsId: REVIEWS_ID, issuerId: ISSUER }, "reviews-key");
  assert.equal(code, 0, said);
  assert.match(said, /ok\s+The reviews key/);
  assert.doesNotMatch(said, new RegExp(REVIEWS_ID));
  assert.doesNotMatch(said, new RegExp(ISSUER));
});

test("no reviews key says how to make it, and does not fail the check", () => {
  const { code, said } = check(home({ key: KEY_ID }), { keyId: KEY_ID, issuerId: ISSUER }, "reviews-key");
  assert.equal(code, 0, said);
  assert.match(said, /later\s+The reviews key/);
  assert.match(said, /make env-set NAME=ASC_REVIEWS_KEY_ID/);
});

test("a saved reviews id with no file, or a file others can read, is caught", () => {
  const ids = { keyId: KEY_ID, reviewsId: REVIEWS_ID, issuerId: ISSUER };
  assert.match(check(home({ key: KEY_ID }), ids, "reviews-key").said, /no key file matches the saved ASC_REVIEWS_KEY_ID/);
  const open = check(home({ key: KEY_ID, reviewsKey: REVIEWS_ID, reviewsMode: 0o644 }), ids, "reviews-key");
  assert.match(open.said, /chmod 600/);
});

test("the vendor number is reported, never printed, and never fails the check", () => {
  const none = check(home(), {}, "vendor-number");
  assert.equal(none.code, 0);
  assert.match(none.said, /later\s+The vendor number/);
  assert.match(none.said, /make env-set NAME=ASC_VENDOR_NUMBER/);
  const saved = check(home(), { vendor: "86543210" }, "vendor-number");
  assert.match(saved.said, /ok\s+The vendor number/);
  assert.doesNotMatch(saved.said, /86543210/);
  assert.match(check(home(), { vendor: "8654-x" }, "vendor-number").said, /digits only/);
});

test("the reviews key being the upload key is caught", () => {
  const ids = { keyId: KEY_ID, reviewsId: KEY_ID, issuerId: ISSUER };
  const { said } = check(home({ key: KEY_ID }), ids, "reviews-key");
  assert.match(said, /the same key as ASC_KEY_ID/);
});
