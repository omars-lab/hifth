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

// What \`defaults read com.apple.dt.Xcode IDEProvisioningTeamByIdentifier\`
// prints. On 2026-11-09 the owner signed in after the paid membership was
// bought, and Xcode still listed the team as a free "Personal Team": an
// install from a free team stops opening after 7 days, so the iPad shown in
// the pitch could expire the week of the meeting. Made-up team ids.
const freeTeam = `{
    "00000000-0000-0000-0000-000000000000" =     (
                {
            isFreeProvisioningTeam = 1;
            teamID = AAAAAAAAAA;
            teamName = "Someone (Personal Team)";
            teamType = "Personal Team";
        }
    );
}`;
const paidTeam = `{
    "00000000-0000-0000-0000-000000000000" =     (
                {
            isFreeProvisioningTeam = 0;
            teamID = AAAAAAAAAA;
            teamName = "Someone";
            teamType = Individual;
        }
    );
}`;

test("an Apple account with a paid team lets the install go on, quietly", () => {
  const out = spawnSync("sh", [script, "-"], { input: one + paidTeam, encoding: "utf8" });
  assert.equal(out.status, 0, out.stdout);
  assert.equal(out.stdout, "");
});

test("an Apple account with only a free team stops the install, saying a free install expires", () => {
  const out = spawnSync("sh", [script, "-"], { input: one + freeTeam, encoding: "utf8" });
  assert.equal(out.status, 1);
  assert.match(out.stdout, /7 days/);
  assert.match(out.stdout, /Personal Team/);
});

test("an Apple account whose teams Xcode has not listed yet stops the install", () => {
  const out = spawnSync("sh", [script, "-"], { input: one, encoding: "utf8" });
  assert.equal(out.status, 1);
});
