import { test } from "node:test";
import assert from "node:assert/strict";
import { uploadAllowed } from "./testflight-allowed.mjs";

const row = (fields) => ({ decisions: [{ id: "native-testflight-licence", ...fields }] });

test("an open question keeps the upload locked", () => {
  assert.equal(uploadAllowed(row({ status: "open" })), false);
});

// Settled on C means "own devices only": answering the question must not
// open the upload (2026-10-11, the owner chose C first and A later).
test("settled on own devices only keeps the upload locked", () => {
  assert.equal(uploadAllowed(row({ status: "decided", decided: "C" })), false);
});

test("settled on either upload option opens it", () => {
  assert.equal(uploadAllowed(row({ status: "decided", decided: "A" })), true);
  assert.equal(uploadAllowed(row({ status: "decided", decided: "B" })), true);
});

test("no row at all keeps the upload locked", () => {
  assert.equal(uploadAllowed({ decisions: [] }), false);
});
