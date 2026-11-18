import { test } from "node:test";
import assert from "node:assert/strict";
import { countFrom, sheet } from "./invite-codes.mjs";
import { inviteHash } from "../../../../apps/landing/lib/invites.mjs";

// The codes here are made up.

test("how many codes: 5 unless told, and only a sensible whole number", () => {
  assert.deepEqual(countFrom([]), { count: 5 });
  assert.deepEqual(countFrom(["--count", "12"]), { count: 12 });
  for (const bad of [["--count"], ["--count", "0"], ["--count", "-3"], ["--count", "2.5"], ["--count", "many"], ["--count", "500"], ["--what"]]) {
    assert.ok(countFrom(bad).error, bad.join(" "));
  }
});

test("the sheet lists each code once, then one line for the setting holding only scrambled copies", async () => {
  const codes = ["0a1b-2c3d-4e5f-6g7h", "zzzz-zzzz-zzzz-zzzz"];
  const text = await sheet(codes);
  for (const code of codes) assert.equal(text.split(code).length, 2, code);
  const setting = text.split("\n").find((line) => line.startsWith("SIGN_IN_INVITES="));
  assert.equal(setting, `SIGN_IN_INVITES=${await inviteHash(codes[0])},${await inviteHash(codes[1])}`);
  for (const code of codes) assert.ok(!setting.includes(code));
});
