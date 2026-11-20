// The daily tidy of the Mac-app list (docs/design/hifth-app-mailing-list.md, item ⑦), run once a
// day by the small Worker in ../tidy/. One call to the list's notify_tidy function does two jobs:
// it deletes addresses nobody confirmed within 7 days, so the privacy page's promise holds on a
// quiet week, and, being a call at all, it keeps Supabase's free project from going to sleep.
//
// It logs one greppable line per step and never the list's address, a key or anyone's email:
// the function answers only a count. A failed run throws, so Cloudflare marks it failed.

import { LIST_SETTINGS, rpc } from "./notify.mjs";

export async function runTidy(env, { fetch = globalThis.fetch, log = console.log } = {}) {
  const missing = LIST_SETTINGS.filter((k) => !env?.[k]);
  if (missing.length) {
    log(`ev=tidy_skipped missing=${missing.join(",")}`);
    throw new Error("the list's settings are missing");
  }
  log("ev=tidy_start");
  let removed;
  try {
    removed = await rpc(env, fetch, "notify_tidy", {});
  } catch (e) {
    log(`ev=tidy_failed status=${e?.status ?? "none"}`);
    throw new Error("the list could not be tidied");
  }
  if (!Number.isInteger(removed) || removed < 0) {
    log("ev=tidy_failed status=200 why=not_a_count");
    throw new Error("the list answered something other than a count");
  }
  log(`ev=tidy_ok removed=${removed}`);
  return removed;
}
