import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// A signed build for a real iPhone or iPad asks Apple for the app's signing
// profile, and only an Apple account signed in to Xcode can ask. On
// 2026-11-09 none was, and the build failed three minutes in with Xcode's
// "No Accounts". The install now checks first and says what to do.
const root = fileURLToPath(new URL("..", import.meta.url));
const script = join(root, "native/scripts/xcode-account.sh");

// What `defaults read com.apple.dt.Xcode DVTDeveloperAccountManagerAppleIDLists`
// prints, with no account and with one (made-up address).
const none = `{
    "IDE.Identifiers.Prod" =     (
    );
    "IDE.Prod" =     (
    );
}`;
const one = `{
    "IDE.Identifiers.Prod" =     (
    );
    "IDE.Prod" =     (
                {
            identifier = "someone@example.com";
        }
    );
}`;

test("no Apple account in Xcode stops the install with what to do", () => {
  const out = spawnSync("sh", [script, "-"], { input: none, encoding: "utf8" });
  assert.equal(out.status, 1);
  assert.match(out.stdout, /Xcode → Settings → Accounts/);
});

test("nothing from Xcode at all counts as no account", () => {
  const out = spawnSync("sh", [script, "-"], { input: "", encoding: "utf8" });
  assert.equal(out.status, 1);
});

test("an Apple account in Xcode lets the install go on, quietly", () => {
  const out = spawnSync("sh", [script, "-"], { input: one, encoding: "utf8" });
  assert.equal(out.status, 0, out.stdout);
  assert.equal(out.stdout, "");
});
