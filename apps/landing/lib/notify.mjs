// The "tell me when the Mac app is out" list (docs/design/hifth-app-site.md ①).
//
// Two handlers, called by the Pages Functions in functions/api/. They take what they need
// (the fetch for the spam check, the clock, the token maker) as options, so the tests can
// stand in for Cloudflare without a network. The table they write is in schema.sql.
//
// Rules this keeps: the spam check is asked once per sign-up and never retried, because a
// Turnstile token works once; an email is never written back into an answer or a log; a
// leave link that matches nothing says the same as one that worked, so the link cannot be
// used to test whether an address is on the list.

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const DEFAULT_HOSTNAMES = ["hifth.app"];
const MAX_EMAIL = 254;

/** The email, trimmed and lower-cased, or null when it is not a plausible address. */
export function cleanEmail(raw) {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function wantsJson(request) {
  return (request.headers.get("Accept") || "").includes("application/json");
}

const page = (title, message) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${title} — Hifth</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <main class="prose">
    <h1>${title}</h1>
    <p>${message}</p>
    <p><a href="/">Back to Hifth</a></p>
  </main>
</body>
</html>
`;

function answer(request, status, title, message) {
  if (wantsJson(request)) {
    return new Response(JSON.stringify({ ok: status < 300, message }), {
      status,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
  return new Response(page(title, message), {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

/** POST /api/notify: check the spam token, then keep the email. */
export async function handleNotify(request, env, { fetch = globalThis.fetch, now = () => new Date(), newToken = randomToken } = {}) {
  if (!env?.DB || !env?.TURNSTILE_SECRET) {
    return answer(request, 503, "Not open yet", "The list isn't open yet. Please try again in a few days.");
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return answer(request, 400, "That didn't go through", "That didn't look like the sign-up form. Please try again.");
  }
  const email = cleanEmail(form.get("email"));
  if (!email) {
    return answer(request, 400, "Check the address", "That doesn't look like an email address.");
  }
  const token = form.get("cf-turnstile-response");
  if (typeof token !== "string" || !token) {
    return answer(request, 400, "One more step", "Please finish the spam check, then press the button again.");
  }

  const check = new FormData();
  check.set("secret", env.TURNSTILE_SECRET);
  check.set("response", token);
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) check.set("remoteip", ip);

  let verdict;
  try {
    const res = await fetch(SITEVERIFY, { method: "POST", body: check });
    verdict = await res.json();
  } catch {
    return answer(request, 502, "That didn't go through", "The spam check couldn't be reached. Please try again in a minute.");
  }

  const allowed = env.TURNSTILE_HOSTNAMES
    ? String(env.TURNSTILE_HOSTNAMES).split(",").map((h) => h.trim()).filter(Boolean)
    : DEFAULT_HOSTNAMES;
  if (!verdict?.success || !allowed.includes(verdict.hostname)) {
    return answer(request, 403, "That didn't go through", "The spam check didn't pass. Please try again.");
  }

  const result = await env.DB.prepare(
    "INSERT INTO notify (email, created_at, unsubscribe_token) VALUES (?1, ?2, ?3) ON CONFLICT(email) DO NOTHING",
  )
    .bind(email, now().toISOString(), newToken())
    .run();

  if (result?.meta?.changes === 0) {
    return answer(request, 200, "Already on the list", "You're already on the list. We'll write once, when the Mac app is out.");
  }
  return answer(request, 200, "You're on the list", "You're on the list. We'll write once, when the Mac app is out.");
}

/** GET /api/unsubscribe?t=…: take the email off the list. Says the same whether or not it matched. */
export async function handleUnsubscribe(request, env) {
  const done = () => answer(request, 200, "You're off the list", "You're off the list. You won't hear from us.");
  if (!env?.DB) return answer(request, 503, "Not open yet", "This link doesn't work yet. Please try again in a few days.");
  const t = new URL(request.url).searchParams.get("t") || "";
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(t)) return done();
  await env.DB.prepare("DELETE FROM notify WHERE unsubscribe_token = ?1").bind(t).run();
  return done();
}
