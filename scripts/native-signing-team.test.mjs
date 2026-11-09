import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The iPad install signs with the team found in the keychain. It used to read
// the ten letters in brackets at the end of the certificate's name, which are
// the certificate's own id, not the team's. With the paid membership
// (2026-11-08) the two differ, so the build asked Apple for a team that does
// not exist. The team is the certificate's "OU" field.
const root = fileURLToPath(new URL("..", import.meta.url));
const script = join(root, "native/scripts/signing-team.sh");

function standInCertificate() {
  const dir = mkdtempSync(join(tmpdir(), "signing-team-"));
  const pem = join(dir, "cert.pem");
  const made = spawnSync("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
    "-keyout", join(dir, "key.pem"), "-out", pem,
    "-subj", "/UID=AAAA111111/CN=Apple Development: someone@example.com (CERT999999)/OU=TEAM123456/O=Someone/C=US",
  ], { encoding: "utf8" });
  assert.equal(made.status, 0, made.stderr);
  return readFileSync(pem, "utf8");
}

test("the signing team is the certificate's OU, not the id in its name", () => {
  const out = spawnSync("sh", [script, "-"], { input: standInCertificate(), encoding: "utf8" });
  assert.equal(out.status, 0, out.stderr);
  assert.equal(out.stdout.trim(), "TEAM123456");
});

test("no certificate prints nothing and does not fail the make file", () => {
  const out = spawnSync("sh", [script, "-"], { input: "", encoding: "utf8" });
  assert.equal(out.stdout.trim(), "");
});
