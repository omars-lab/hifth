import { test } from "node:test";
import assert from "node:assert/strict";
import { INVITE_LETTERS, inviteHash, newInvite, tidyInvite } from "./invites.mjs";

/*
 * Invite codes for the tester stage of sign-in (step 18 of docs/design/sign-in.md). A code is
 * made by us, never picked by a person, and only its scrambled copy is ever set on the server.
 * Every code here is made up. Written before invites.mjs, and watched failing.
 */

test("a new code is 16 letters and digits in four groups, from letters that cannot be mixed up", () => {
  const code = newInvite();
  assert.match(code, /^[0-9a-hjkmnp-tv-z]{4}(-[0-9a-hjkmnp-tv-z]{4}){3}$/);
  assert.equal(INVITE_LETTERS.length, 32);
  for (const confusing of "ilou") assert.ok(!INVITE_LETTERS.includes(confusing), confusing);
});

test("a new code comes from 80 random bits: every letter is drawn from the whole alphabet", () => {
  const bytes = (fill) => (array) => array.fill(fill);
  assert.equal(newInvite({ random: bytes(0) }), "0000-0000-0000-0000");
  assert.equal(newInvite({ random: bytes(31) }), "zzzz-zzzz-zzzz-zzzz");
  assert.equal(newInvite({ random: bytes(255) }), "zzzz-zzzz-zzzz-zzzz");
  assert.notEqual(newInvite(), newInvite());
});

test("a code typed with capitals, spaces, no dashes, or a look-alike letter is the same code", () => {
  const code = "0a1b-2c3d-4e5f-6g7h";
  for (const typed of ["0A1B-2C3D-4E5F-6G7H", "  0a1b 2c3d 4e5f 6g7h\n", "0a1b2c3d4e5f6g7h", "Oalb-2c3d-4e5f-6g7h", "0aIb–2c3d—4e5f_6g7h"]) {
    assert.equal(tidyInvite(typed), "0a1b2c3d4e5f6g7h", typed);
  }
  assert.equal(tidyInvite(code), "0a1b2c3d4e5f6g7h");
});

test("what is not text tidies to nothing", () => {
  for (const odd of [undefined, null, 7, ["0a1b"], {}, "", "  - "]) assert.equal(tidyInvite(odd), "");
});

test("the scrambled copy is 64 hex letters, the same however the code was typed, and not the code", async () => {
  const hash = await inviteHash("0a1b-2c3d-4e5f-6g7h");
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(await inviteHash(" 0A1B 2C3D 4E5F 6G7H "), hash);
  assert.notEqual(await inviteHash("0a1b-2c3d-4e5f-6g7j"), hash);
  assert.ok(!hash.includes("0a1b2c3d"));
});
