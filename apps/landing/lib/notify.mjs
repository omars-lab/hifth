// The "tell me when the Mac app is out" list (docs/design/hifth-app-mailing-list.md).
//
// Three handlers, called by the Pages Functions in functions/api/:
//
//   POST /api/notify        check the spam token, keep the address waiting, send one email to confirm it
//   GET|POST /api/confirm   the link in that email: a page with a button; pressing it confirms
//   GET|POST /api/unsubscribe  the leave link: a page with a button; pressing it (or the mail
//                           program's own one-click leave) takes the address off
//
// The list itself is on Supabase, in a table the site cannot read. The site reaches it only
// through three database functions (supabase/migrations/20261113000001_notify_list.sql), with
// the publishable key and the site's own list key; the secret key is never here. The handlers
// take what they need (fetch, the mail sender, the code maker) as options, so the tests can
// stand in for Cloudflare, Supabase and the mail service without a network.
//
// Rules this keeps: the spam check is asked once per sign-up and never retried, because a
// Turnstile token works once; an email is never written back into an answer or a log; a new
// address and one already on the list get the same answer, and so do a leave link that matched
// and one that did not, so neither can be used to learn who is on the list; opening a link
// never changes anything, because mail programs open links to scan them.

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const DEFAULT_HOSTNAMES = ["hifth.app"];
const MAX_EMAIL = 254;
const CONFIRM_CODE = /^[0-9a-f]{48}$/;
const LEAVE_CODE = /^[0-9a-f]{64}$/;
const LIST_SETTINGS = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "LIST_KEY"];

/** The email, trimmed and lower-cased, or null when it is not a plausible address. */
export function cleanEmail(raw) {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

/** 24 random bytes as hex: the code in a confirm link. */
function randomCode() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function wantsJson(request) {
  return (request.headers.get("Accept") || "").includes("application/json");
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/**
 * How the confirm email goes out, or null when there is no way yet. The mail service is still
 * an open decision (docs/design/hifth-app-mailing-list.md, "Which service sends the mail?"), so
 * the only sender built is the laptop's stand-in: MAIL_SENDER=dev-log, which writes the confirm
 * link (never the address) to the local server's log, and only when the page is served from
 * this laptop. Anywhere else the form says the list is not open yet.
 */
export function pickSender(env, request, log = console.log) {
  if (env?.MAIL_SENDER !== "dev-log") return null;
  if (!LOCAL_HOSTS.has(new URL(request.url).hostname)) return null;
  return async ({ lang, confirmUrl }) => {
    log(`ev=notify_confirm_link lang=${lang} url=${confirmUrl}`);
  };
}

/*
 * Every answer in both of the front page's languages. The Arabic page sends lang=ar with the
 * form (owner, 2026-11-12, the language bar), so its reader is answered in Arabic, scripts or
 * not, and the links in their email carry lang=ar too; anything else is answered in English.
 * The Arabic carries no vowel marks: it is plain words about the list, and the site's scripture
 * check reads vowelled Arabic as a verse.
 */
const WORDS = {
  en: {
    closed: ["Not open yet", "The list isn't open yet. Please try again in a few days."],
    badForm: ["That didn't go through", "That didn't look like the sign-up form. Please try again."],
    badEmail: ["Check the address", "That doesn't look like an email address."],
    noToken: ["One more step", "Please finish the spam check, then press the button again."],
    unreachable: ["That didn't go through", "The spam check couldn't be reached. Please try again in a minute."],
    failed: ["That didn't go through", "The spam check didn't pass. Please try again."],
    later: ["That didn't go through", "The list couldn't be reached just now. Please try again later."],
    inbox: ["Almost there", "Check your inbox. We've sent one email with a button to confirm. Once you press it, we'll write once more, when the Mac app is out."],
    confirmAsk: ["One more step", "Press the button to join the list. We'll write once, when the Mac app is out."],
    confirmButton: "Join the list",
    confirmed: ["You're on the list", "We'll write once, when the Mac app is out. Nothing else."],
    expired: ["This link has expired", "Please sign up again on the front page, and we'll send a fresh one."],
    leaveAsk: ["Leave the list?", "Press the button to take your address off the list."],
    leaveButton: "Leave the list",
    left: ["You're off the list", "Your address is gone from the list. You won't hear from us."],
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
    later: ["لم يصل طلبك", "تعذر الوصول إلى القائمة الآن. حاول مرة أخرى لاحقا."],
    inbox: ["بقيت خطوة", "راجع بريدك. أرسلنا رسالة واحدة فيها زر للتأكيد. إذا ضغطته، سنكتب إليك مرة أخرى حين يصدر تطبيق ماك."],
    confirmAsk: ["خطوة أخيرة", "اضغط الزر لتنضم إلى القائمة. سنكتب إليك مرة واحدة، حين يصدر تطبيق ماك."],
    confirmButton: "انضم إلى القائمة",
    confirmed: ["أنت في القائمة", "سنكتب إليك مرة واحدة، حين يصدر تطبيق ماك. لا شيء غير ذلك."],
    expired: ["انتهت صلاحية الرابط", "سجل مرة أخرى من الصفحة الأولى، وسنرسل إليك رابطا جديدا."],
    leaveAsk: ["الخروج من القائمة؟", "اضغط الزر لنحذف عنوانك من القائمة."],
    leaveButton: "اخرج من القائمة",
    left: ["خرجت من القائمة", "حذفنا عنوانك من القائمة، ولن نراسلك."],
    linkClosed: ["لم يفتح بعد", "هذا الرابط لا يعمل بعد. حاول مرة أخرى بعد أيام."],
    home: "العودة إلى حفظ",
  },
};

/** The language to answer in: Arabic when the page asked for it, English otherwise. */
const langOf = (value) => (value === "ar" ? "ar" : "en");

const escapeAttr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** A plain page. With `action`, it carries one button that POSTs back to the same link. */
const page = (lang, title, message, action) => `<!doctype html>
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
${action ? `    <form method="post" action="${escapeAttr(action.url)}"><button type="submit" class="button">${action.button}</button></form>\n` : ""}    <p><a href="${lang === "ar" ? "/ar/" : "/"}">${WORDS[lang].home}</a></p>
  </main>
</body>
</html>
`;

const HEADERS = { "cache-control": "no-store", "referrer-policy": "no-referrer" };

function answer(request, status, key, lang = "en", action) {
  const [title, message] = WORDS[lang][key];
  if (wantsJson(request)) {
    return new Response(JSON.stringify({ ok: status < 300, message }), {
      status,
      headers: { ...HEADERS, "content-type": "application/json; charset=utf-8" },
    });
  }
  return new Response(page(lang, title, message, action), {
    status,
    headers: { ...HEADERS, "content-type": "text/html; charset=utf-8" },
  });
}

const hasListSettings = (env) => LIST_SETTINGS.every((k) => env?.[k]);

/**
 * Calls one of the list's database functions. Returns its answer, or throws when the list could
 * not be reached or refused: a free Supabase project that has slept answers 503, and every such
 * failure is "please try again later" to the reader.
 */
async function rpc(env, fetch, name, args) {
  const res = await fetch(`${String(env.SUPABASE_URL).replace(/\/+$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ p_key: env.LIST_KEY, ...args }),
  });
  if (!res.ok) throw new Error(`list answered ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** POST /api/notify: check the spam token, keep the address waiting, send the confirm email. */
export async function handleNotify(request, env, { fetch = globalThis.fetch, send, newCode = randomCode } = {}) {
  let form;
  try {
    form = await request.formData();
  } catch {
    form = null;
  }
  const lang = langOf(form?.get("lang"));
  const sender = send === undefined ? pickSender(env, request) : send;
  if (!hasListSettings(env) || !env?.TURNSTILE_SECRET || !sender) return answer(request, 503, "closed", lang);
  if (!form) return answer(request, 400, "badForm", lang);
  const email = cleanEmail(form.get("email"));
  if (!email) return answer(request, 400, "badEmail", lang);
  const token = form.get("cf-turnstile-response");
  if (typeof token !== "string" || !token) return answer(request, 400, "noToken", lang);

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

  const code = newCode();
  const confirmUrl = `${new URL(request.url).origin}/api/confirm?c=${code}${lang === "ar" ? "&lang=ar" : ""}`;
  try {
    await rpc(env, fetch, "notify_add", { p_email: email, p_lang: lang, p_confirm: code });
    await sender({ to: email, lang, confirmUrl });
  } catch {
    return answer(request, 503, "later", lang);
  }
  return answer(request, 200, "inbox", lang);
}

/**
 * The two links in an email work the same way: opening one shows a page with a button that
 * POSTs back to the same link, and only the POST changes anything.
 */
async function handleLink(request, env, fetch, { param, pattern, askKey, buttonKey, act }) {
  const url = new URL(request.url);
  const lang = langOf(url.searchParams.get("lang"));
  if (!hasListSettings(env)) return answer(request, 503, "linkClosed", lang);
  const code = url.searchParams.get(param) || "";
  if (request.method !== "POST") {
    const action = { url: `${url.pathname}?${param}=${encodeURIComponent(code)}${lang === "ar" ? "&lang=ar" : ""}`, button: WORDS[lang][buttonKey] };
    return answer(request, 200, askKey, lang, action);
  }
  try {
    return answer(request, 200, await act(code, pattern.test(code)), lang);
  } catch {
    return answer(request, 503, "later", lang);
  }
}

/** GET|POST /api/confirm?c=…[&lang=ar]: the reader pressed the button in the confirm email. */
export function handleConfirm(request, env, { fetch = globalThis.fetch } = {}) {
  return handleLink(request, env, fetch, {
    param: "c",
    pattern: CONFIRM_CODE,
    askKey: "confirmAsk",
    buttonKey: "confirmButton",
    act: async (code, wellFormed) => (wellFormed && (await rpc(env, fetch, "notify_confirm", { p_code: code })) === true ? "confirmed" : "expired"),
  });
}

/**
 * GET|POST /api/unsubscribe?t=…[&lang=ar]: take the address off the list. A POST to the link
 * is also what a mail program's own "unsubscribe" button sends (List-Unsubscribe-Post), so the
 * code is read from the link, never the body. Says the same whether or not it matched.
 */
export function handleUnsubscribe(request, env, { fetch = globalThis.fetch } = {}) {
  return handleLink(request, env, fetch, {
    param: "t",
    pattern: LEAVE_CODE,
    askKey: "leaveAsk",
    buttonKey: "leaveButton",
    act: async (code, wellFormed) => {
      if (wellFormed) await rpc(env, fetch, "notify_leave", { p_code: code });
      return "left";
    },
  });
}
