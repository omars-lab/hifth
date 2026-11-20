import { test } from "node:test";
import assert from "node:assert/strict";
import { handleDeleteAccount, handleDropMarks, handleKeepMarks, handleReadMarks, handleSignIn, handleWord } from "./sign-in-api.mjs";
import { MOST_COPY_BYTES } from "./marks-copy.mjs";
import { localD1 } from "./test-d1.mjs";

/*
 * Sign-in step 21, "your marks follow you" (docs/design/sign-in.md): one copy of a reader's
 * marks file on hifth.app, kept only when they press "Keep a copy of my marks on hifth.app".
 *   GET    /api/marks   the copy, its number and when it was saved
 *   PUT    /api/marks   { marks, after } replaces the copy whole, if nobody replaced it since `after`
 *   DELETE /api/marks   removes the copy; the account stays
 * Every address needs the reader's own session, in the Authorization line. The merging happens
 * on the device: the server keeps the file as it came and only checks it is a marks file.
 * Written before marks-copy.mjs, and watched failing. All marks here are made up.
 */

const check = async (note) =>
  typeof note === "string" && note.startsWith("apple:")
    ? { ok: true, appleUser: note.slice("apple:".length), appId: "app.example.hifth" }
    : { ok: false, reason: "bad-signature" };

function setUp(extra = {}) {
  const { db, rows } = localD1();
  return { db, rows, env: { SIGN_IN: "on", ACCOUNTS: db, APPLE_APP_IDS: "app.example.hifth", ...extra } };
}

const at = (method, session, body) =>
  new Request("https://hifth.app/api/marks", {
    method,
    headers: { "content-type": "application/json", ...(session ? { authorization: `Bearer ${session}` } : {}) },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });

async function signedIn(env, user = "000001.made-up.0001") {
  const word = (await (await handleWord(new Request("https://hifth.app/api/sign-in/word", { method: "POST", body: "{}" }), env)).json()).word;
  const res = await handleSignIn(
    new Request("https://hifth.app/api/sign-in", { method: "POST", body: JSON.stringify({ note: `apple:${user}`, word }) }),
    env,
    { check },
  );
  return (await res.json()).session;
}

const marks = (label = "made-up bookmark") => ({
  kind: "hifth.bookmarks",
  version: 2,
  savedAt: 1_700_000_000_000,
  bookmarks: [{ id: "b1", label, page: 3, events: [] }],
  scopedNotes: [],
});

test("the whole way: keep a copy, read it back from another device, replace it, delete it", async () => {
  const { env } = setUp();
  const phone = await signedIn(env);
  const tablet = await signedIn(env);

  assert.equal((await handleReadMarks(at("GET", tablet), env)).status, 404, "no copy until the reader keeps one");

  const kept = await handleKeepMarks(at("PUT", phone, { marks: marks(), after: 0 }), env);
  assert.equal(kept.status, 200);
  const { number } = await kept.json();
  assert.equal(number, 1);

  const read = await handleReadMarks(at("GET", tablet), env);
  assert.equal(read.status, 200);
  const body = await read.json();
  assert.deepEqual(body.marks, marks(), "the file comes back as it went");
  assert.equal(body.number, 1);
  assert.equal(typeof body.savedAt, "number");

  const again = await handleKeepMarks(at("PUT", tablet, { marks: marks("renamed"), after: 1 }), env);
  assert.equal((await again.json()).number, 2);
  assert.equal((await (await handleReadMarks(at("GET", phone), env)).json()).marks.bookmarks[0].label, "renamed");

  assert.equal((await handleDropMarks(at("DELETE", phone), env)).status, 204);
  assert.equal((await handleReadMarks(at("GET", tablet), env)).status, 404);
  assert.equal((await handleReadMarks(at("GET", tablet), env)).headers.get("cache-control"), "no-store");
});

test("a device that has not seen the latest copy cannot write over it; it is told the newer number", async () => {
  const { env } = setUp();
  const phone = await signedIn(env);
  const tablet = await signedIn(env);
  await handleKeepMarks(at("PUT", phone, { marks: marks("first"), after: 0 }), env);
  await handleKeepMarks(at("PUT", phone, { marks: marks("second"), after: 1 }), env);

  const stale = await handleKeepMarks(at("PUT", tablet, { marks: marks("stale"), after: 1 }), env);
  assert.equal(stale.status, 409);
  assert.deepEqual(await stale.json(), { reason: "newer-copy", number: 2 });
  const fresh = await handleKeepMarks(at("PUT", tablet, { marks: marks("stale"), after: 0 }), env);
  assert.equal(fresh.status, 409, "a device that thinks there is no copy cannot start one over an existing copy");
  assert.equal((await (await handleReadMarks(at("GET", phone), env)).json()).marks.bookmarks[0].label, "second");
});

test("each reader sees only their own copy", async () => {
  const { env } = setUp();
  const mine = await signedIn(env, "000001.made-up.0001");
  const theirs = await signedIn(env, "000002.made-up.0002");
  await handleKeepMarks(at("PUT", mine, { marks: marks("mine"), after: 0 }), env);
  assert.equal((await handleReadMarks(at("GET", theirs), env)).status, 404);
  assert.equal((await handleDropMarks(at("DELETE", theirs), env)).status, 204);
  assert.equal((await handleReadMarks(at("GET", mine), env)).status, 200, "another reader's delete left mine alone");
});

test("every address needs a live session in the Authorization line", async () => {
  const { env, rows } = setUp();
  for (const session of [undefined, "made-up-session"]) {
    assert.equal((await handleReadMarks(at("GET", session), env)).status, 401);
    assert.equal((await handleKeepMarks(at("PUT", session, { marks: marks(), after: 0 }), env)).status, 401);
    assert.equal((await handleDropMarks(at("DELETE", session), env)).status, 401);
  }
  assert.equal(rows("marks_copies").length, 0);
});

test("only a marks file is kept: anything else, or a file carrying more than marks, is refused", async () => {
  const { env, rows } = setUp();
  const session = await signedIn(env);
  const refused = [
    "not json",
    [],
    { after: 0 },
    { marks: "text", after: 0 },
    { marks: { ...marks(), kind: "something.else" }, after: 0 },
    { marks: { ...marks(), version: "2" }, after: 0 },
    { marks: { ...marks(), bookmarks: "none" }, after: 0 },
    // The record of what the reader opened goes only by its own tick box, never inside the marks.
    { marks: { ...marks(), revision: [{ page: 1 }] }, after: 0 },
    { marks: marks(), after: -1 },
    { marks: marks(), after: "1" },
  ];
  for (const body of refused) {
    const res = await handleKeepMarks(at("PUT", session, body), env);
    assert.equal(res.status, 400, JSON.stringify(body).slice(0, 60));
  }
  assert.equal(rows("marks_copies").length, 0);
});

test("a copy bigger than the limit is refused and says so, and nothing is kept", async () => {
  const { env, rows } = setUp();
  const session = await signedIn(env);
  const big = { ...marks(), bookmarks: [{ id: "b1", label: "x".repeat(MOST_COPY_BYTES), page: 3, events: [] }] };
  const res = await handleKeepMarks(at("PUT", session, { marks: big, after: 0 }), env);
  assert.equal(res.status, 413);
  assert.deepEqual(await res.json(), { reason: "too-big", most: MOST_COPY_BYTES });
  assert.equal(rows("marks_copies").length, 0);
});

test("the limit leaves room for a reader with years of notes, and fits in one database row", () => {
  // Cloudflare's database holds at most 2,000,000 bytes in one row.
  assert.ok(MOST_COPY_BYTES <= 2_000_000);
  // A thousand notes of 500 letters each, the heaviest reader we can picture.
  assert.ok(MOST_COPY_BYTES >= 1000 * 500 * 1.5);
});

test("delete my account deletes the copy too", async () => {
  const { env, rows } = setUp();
  const session = await signedIn(env);
  const other = await signedIn(env, "000002.made-up.0002");
  await handleKeepMarks(at("PUT", session, { marks: marks(), after: 0 }), env);
  await handleKeepMarks(at("PUT", other, { marks: marks("other"), after: 0 }), env);
  const res = await handleDeleteAccount(at("POST", session, {}), env);
  assert.equal(res.status, 200);
  assert.equal(rows("marks_copies").length, 1, "only the other reader's copy is left");
});

test("with sign-in switched off, the marks address answers as if it was not there", async () => {
  const { env, rows } = setUp({ SIGN_IN: "off" });
  assert.equal((await handleReadMarks(at("GET", "s"), env)).status, 404);
  assert.equal((await handleKeepMarks(at("PUT", "s", { marks: marks(), after: 0 }), env)).status, 404);
  assert.equal((await handleDropMarks(at("DELETE", "s"), env)).status, 404);
  assert.equal(rows("marks_copies").length, 0);
});
