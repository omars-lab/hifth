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

/*
 * Every answer in both of the front page's languages. The Arabic page sends lang=ar with the
 * form (owner, 2026-11-12, the language bar), so its reader is answered in Arabic, scripts or
 * not; anything else is answered in English. The Arabic carries no vowel marks: it is plain
 * words about the list, and the site's scripture check reads vowelled Arabic as a verse.
 */
const WORDS = {
  en: {
    closed: ["Not open yet", "The list isn't open yet. Please try again in a few days."],
    badForm: ["That didn't go through", "That didn't look like the sign-up form. Please try again."],
    badEmail: ["Check the address", "That doesn't look like an email address."],
    noToken: ["One more step", "Please finish the spam check, then press the button again."],
    unreachable: ["That didn't go through", "The spam check couldn't be reached. Please try again in a minute."],
    failed: ["That didn't go through", "The spam check didn't pass. Please try again."],
    already: ["Already on the list", "You're already on the list. We'll write once, when the Mac app is out."],
    joined: ["You're on the list", "You're on the list. We'll write once, when the Mac app is out."],
    left: ["You're off the list", "You're off the list. You won't hear from us."],
    linkClosed: ["Not open yet", "This link doesn't work yet. Please try again in a few days."],
    home: "Back to Hifth",
  },
  ar: {
    closed: ["لم تفتح بعد", "القائمة لم تفتح بعد. حاول مرة أخرى بعد أيام."],
    badForm: ["لم يصل طلبك", "لا يبدو هذا نموذج التسجيل. حاول مرة أخرى."],
    badEmail: ["راجع العنوان", "لا يبدو هذا عنوان بريد إلكتروني."],
    noToken: ["خطوة أخيرة", "أكمل التحقق من أنك لست برنامجا آليا، ثم اضغط الزر مرة أخرى."],
    unreachable: ["لم يصل طلبك", "تعذر الوصول إلى التحقق. حاول مرة أخرى بعد دقيقة."],
    failed: ["لم يصل طلبك", "لم ينجح التحقق. حاول مرة أخرى."],
    already: ["أنت في القائمة", "أنت في القائمة من قبل. سنكتب إليك مرة واحدة، حين يصدر تطبيق ماك."],
    joined: ["أضفناك إلى القائمة", "أضفناك إلى القائمة. سنكتب إليك مرة واحدة، حين يصدر تطبيق ماك."],
    left: ["خرجت من القائمة", "خرجت من القائمة، ولن نراسلك."],
    linkClosed: ["لم يفتح بعد", "هذا الرابط لا يعمل بعد. حاول مرة أخرى بعد أيام."],
    home: "العودة إلى حفظ",
  },
};

/** The language to answer in: Arabic when the page asked for it, English otherwise. */
const langOf = (value) => (value === "ar" ? "ar" : "en");

const page = (lang, title, message) => `<!doctype html>
<html lang="${lang}"${lang === "ar" ? ' dir="rtl"' : ""}>
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
    <p><a href="${lang === "ar" ? "/ar/" : "/"}">${WORDS[lang].home}</a></p>
  </main>
</body>
</html>
`;

function answer(request, status, key, lang = "en") {
  const [title, message] = WORDS[lang][key];
  if (wantsJson(request)) {
    return new Response(JSON.stringify({ ok: status < 300, message }), {
      status,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
  return new Response(page(lang, title, message), {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

/** POST /api/notify: check the spam token, then keep the email. */
export async function handleNotify(request, env, { fetch = globalThis.fetch, now = () => new Date(), newToken = randomToken } = {}) {
  let form;
  try {
    form = await request.formData();
  } catch {
    form = null;
  }
  const lang = langOf(form?.get("lang"));
  if (!env?.DB || !env?.TURNSTILE_SECRET) return answer(request, 503, "closed", lang);
  if (!form) return answer(request, 400, "badForm", lang);
  const email = cleanEmail(form.get("email"));
  if (!email) {
    return answer(request, 400, "badEmail", lang);
  }
  const token = form.get("cf-turnstile-response");
  if (typeof token !== "string" || !token) {
    return answer(request, 400, "noToken", lang);
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
    return answer(request, 502, "unreachable", lang);
  }

  const allowed = env.TURNSTILE_HOSTNAMES
    ? String(env.TURNSTILE_HOSTNAMES).split(",").map((h) => h.trim()).filter(Boolean)
    : DEFAULT_HOSTNAMES;
  if (!verdict?.success || !allowed.includes(verdict.hostname)) {
    return answer(request, 403, "failed", lang);
  }

  const result = await env.DB.prepare(
    "INSERT INTO notify (email, created_at, unsubscribe_token) VALUES (?1, ?2, ?3) ON CONFLICT(email) DO NOTHING",
  )
    .bind(email, now().toISOString(), newToken())
    .run();

  if (result?.meta?.changes === 0) {
    return answer(request, 200, "already", lang);
  }
  return answer(request, 200, "joined", lang);
}

/**
 * GET /api/unsubscribe?t=…[&lang=ar]: take the email off the list. Says the same whether or not
 * it matched. The leave link in an email to a reader who signed up in Arabic carries lang=ar.
 */
export async function handleUnsubscribe(request, env) {
  const params = new URL(request.url).searchParams;
  const lang = langOf(params.get("lang"));
  const done = () => answer(request, 200, "left", lang);
  if (!env?.DB) return answer(request, 503, "linkClosed", lang);
  const t = params.get("t") || "";
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(t)) return done();
  await env.DB.prepare("DELETE FROM notify WHERE unsubscribe_token = ?1").bind(t).run();
  return done();
}
