// The store-numbers command, against a made-up key and made-up daily reports.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { daysBack, rowsFor, run } from "./store-numbers.mjs";

const KEY = generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey.export({ type: "pkcs8", format: "pem" });
const ENV = { ASC_REVIEWS_KEY_ID: "ABCDE12345", ASC_ISSUER_ID: "00000000-0000-0000-0000-000000000000", ASC_VENDOR_NUMBER: "80000000" };
const readKey = () => KEY;
const NOW = Date.parse("2026-12-05T15:00:00Z");

const HEAD = ["Provider", "SKU", "Title", "Product Type Identifier", "Units", "Country Code", "Device", "Apple Identifier"].join("\t");
const row = (code, units, country, device, app = "999") => ["APPLE", "made-up-sku", "Made-up title", code, units, country, device, app].join("\t");
const REPORTS = {
  "2026-12-02": [HEAD, row("1F", 3, "US", "iPad"), row("1F", 2, "GB", "iPhone"), row("F1", 1, "US", "Desktop"), row("1F", 9, "US", "iPad", "123")].join("\n"),
  "2026-12-03": [HEAD, row("7F", 4, "US", "iPad"), row("3F", 1, "EG", "iPhone"), row("1T", 2, "EG", "iPad")].join("\n"),
};

function fakeStore(calls) {
  return async (url, init = {}) => {
    calls.push({ url, init });
    if (url.includes("/v1/apps?filter[bundleId]="))
      return { ok: true, status: 200, json: async () => ({ data: [{ type: "apps", id: "999", attributes: { bundleId: "com.bytesofpurpose.hifth" } }] }) };
    const date = new URL(url).searchParams.get("filter[reportDate]");
    if (REPORTS[date]) return { ok: true, status: 200, arrayBuffer: async () => gzipSync(REPORTS[date]) };
    return { ok: false, status: 404, json: async () => ({ errors: [{ detail: "There were no sales for the date specified." }] }) };
  };
}

const setup = (env = ENV) => {
  const dir = mkdtempSync(join(tmpdir(), "store-numbers-"));
  const lines = [];
  const calls = [];
  const go = (...argv) => run(argv, { env, dir, readKey, fetch: fakeStore(calls), now: NOW, out: (l) => lines.push(l) });
  return { dir, lines, calls, go };
};

test("the days asked for end yesterday, oldest first, and stop at Apple's year", () => {
  assert.deepEqual(daysBack(NOW, 3), ["2026-12-02", "2026-12-03", "2026-12-04"]);
  assert.equal(daysBack(NOW, 5000).length, 365);
});

test("pull asks Apple for the daily summary report, keeps each day once, and leaves yesterday open", async () => {
  const { dir, lines, calls, go } = setup();
  assert.equal(await go("pull", "--days", "3"), 0);
  const asked = calls.filter((c) => c.url.includes("salesReports")).map((c) => new URL(c.url).searchParams);
  assert.equal(asked.length, 3);
  assert.equal(asked[0].get("filter[frequency]"), "DAILY");
  assert.equal(asked[0].get("filter[reportType]"), "SALES");
  assert.equal(asked[0].get("filter[reportSubType]"), "SUMMARY");
  assert.equal(asked[0].get("filter[version]"), "1_1");
  assert.equal(calls.find((c) => c.url.includes("salesReports")).init.headers.accept, "application/a-gzip");
  assert.ok(existsSync(join(dir, "daily", "2026-12-02.tsv")));
  assert.ok(!existsSync(join(dir, "daily", "2026-12-04.tsv")), "yesterday's report may not be made yet; ask again next time");
  assert.deepEqual(lines, ["fetched 2 days' reports and 0 days with nothing to report; the rest were already kept"]);

  calls.length = 0;
  await go("pull", "--days", "4");
  const again = calls.filter((c) => c.url.includes("salesReports")).map((c) => new URL(c.url).searchParams.get("filter[reportDate]"));
  assert.deepEqual(again, ["2026-12-01", "2026-12-04"], "only the days not kept");
  assert.equal(readFileSync(join(dir, "daily", "2026-12-01.tsv"), "utf8"), "", "a day with nothing is kept empty");
});

test("summary counts this app's first downloads, updates and downloads again, by device and country", async () => {
  const { lines, go } = setup();
  await go("pull", "--days", "3");
  lines.length = 0;
  await go("summary", "--days", "3");
  assert.deepEqual(lines, [
    "2026-12-02 to 2026-12-04: 2 of 3 days' reports kept",
    "first downloads 8, updates 4, downloads again 1",
    "first downloads by device: iPad 5, iPhone 2, Mac 1",
    "first downloads by country, top 10: US 4, EG 2, GB 2",
  ]);
});

test("no vendor number, or no key, says which setting is missing and prints no value", async () => {
  const { go } = setup({ ...ENV, ASC_VENDOR_NUMBER: "" });
  await assert.rejects(go("pull"), /ASC_VENDOR_NUMBER is not loaded/);
  const noKey = setup({ ASC_VENDOR_NUMBER: "80000000" });
  const err = await noKey.go("pull").catch((e) => e);
  assert.match(err.message, /ASC_REVIEWS_KEY_ID or ASC_ISSUER_ID is not loaded/);
  assert.ok(!err.message.includes("80000000"));
});

test("a report without the columns this reads is refused, not miscounted", () => {
  assert.throws(() => rowsFor("A\tB\n1\t2", "999"), /without the columns/);
});

test("summary before any pull says to pull", async () => {
  await assert.rejects(setup().go("summary"), /run pull first/);
});
