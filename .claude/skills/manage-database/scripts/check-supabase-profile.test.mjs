import { test } from "node:test";
import assert from "node:assert/strict";
import { LOGIN_COMMAND, PROJECT_NAME, namesFrom, verdictFor } from "./check-supabase-profile.mjs";

// The shape the command line tool answers with: IDs and organisation details
// sit next to the name, and none of them may reach the screen. Made-up values.
const row = (name, extra = {}) => ({
  id: "made-up-id",
  ref: "made-up-ref",
  organization_id: "made-up-org",
  organization_slug: "made-up-slug",
  name,
  region: "us-east-1",
  status: "ACTIVE_HEALTHY",
  ...extra,
});

test("only the name and the state are kept from the project list", () => {
  const read = namesFrom(JSON.stringify([row(PROJECT_NAME)]));
  assert.deepEqual(read, { projects: [{ name: PROJECT_NAME, status: "ACTIVE_HEALTHY" }] });
  assert.ok(!JSON.stringify(read).includes("made-up"));
});

test("an answer that is not a list is refused, never printed", () => {
  assert.ok(namesFrom("not json").error);
  assert.ok(namesFrom(JSON.stringify({ message: "made-up-ref" })).error);
  assert.ok(!JSON.stringify(namesFrom(JSON.stringify({ message: "made-up-ref" }))).includes("made-up"));
});

test("the right login reaches one project, named hifth.app", () => {
  assert.deepEqual(verdictFor([{ name: PROJECT_NAME, status: "ACTIVE_HEALTHY" }]), { ok: true });
});

test("another account, an empty one, or a crowded one is refused with the reason", () => {
  const other = verdictFor([{ name: "someone-elses-site", status: "ACTIVE_HEALTHY" }]);
  assert.equal(other.ok, false);
  assert.match(other.why, /another account/);
  assert.equal(verdictFor([]).ok, false);
  const crowded = verdictFor([
    { name: PROJECT_NAME, status: "ACTIVE_HEALTHY" },
    { name: "old-store", status: "INACTIVE" },
  ]);
  assert.equal(crowded.ok, false);
  assert.match(crowded.why, /2 projects/);
});

test("the command the owner is told to type names hifth's profile", () => {
  assert.equal(LOGIN_COMMAND, "! supabase login --profile ~/.supabase/profiles/hifth.yaml");
});
