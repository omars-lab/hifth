// The laptop try of the list's daily tidy (try-tidy.mjs). Every address and key here is made up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { tidyDevArgs, tidyOutcome } from "./try-tidy.mjs";
import { LOCAL_LIST_KEY } from "./release-hifth-app.mjs";

const LIST = { url: "http://127.0.0.1:54321", key: "made-up-publishable" };

test("the Worker runs on this laptop only, with its timer's test door open", () => {
  const args = tidyDevArgs(8799, LIST, "/tmp/x");
  assert.equal(args[0], "dev");
  assert.ok(args.includes("--local"), "never on Cloudflare");
  assert.ok(args.includes("--test-scheduled"));
  assert.equal(args[args.indexOf("--ip") + 1], "127.0.0.1");
  assert.ok(!args.includes("--remote"));
});

test("it is given the local list's settings and the made-up local key, never the real ones", () => {
  const vars = tidyDevArgs(8799, LIST, "/tmp/x").filter((_, i, a) => a[i - 1] === "--var");
  assert.deepEqual(vars, [
    "SUPABASE_URL:http://127.0.0.1:54321",
    "SUPABASE_PUBLISHABLE_KEY:made-up-publishable",
    `LIST_KEY:${LOCAL_LIST_KEY}`,
  ]);
});

test("it reads the tidy's own line out of the runner's log", () => {
  assert.deepEqual(tidyOutcome("ready\nev=tidy_start\nev=tidy_ok removed=2\n"), { ok: true, removed: 2 });
  assert.deepEqual(tidyOutcome("ev=tidy_start\nev=tidy_failed status=503\n"), { ok: false, line: "ev=tidy_failed status=503" });
  assert.deepEqual(tidyOutcome("ev=tidy_skipped missing=LIST_KEY\n"), { ok: false, line: "ev=tidy_skipped missing=LIST_KEY" });
  assert.equal(tidyOutcome("ready on 127.0.0.1:8799\n"), null);
});
