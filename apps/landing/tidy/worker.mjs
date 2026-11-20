// hifth.app's list tidy: a Cloudflare Worker with a daily timer and no web address
// (wrangler.toml beside this file). It reaches the list with the same three settings as the
// site's form, set as this Worker's own secrets: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and
// LIST_KEY. Why it exists, and what it does: ../lib/tidy.mjs.

import { runTidy } from "../lib/tidy.mjs";

export default {
  async scheduled(_controller, env) {
    await runTidy(env);
  },
};
