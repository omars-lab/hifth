// The notify-me form: send the email and the spam-check token, say what happened.
// Without JavaScript the form still posts to /api/notify, which answers with a plain page.
// The Arabic page sends lang=ar with the form, so the server answers it in Arabic; the few
// lines said here before the server answers follow the page's own language.
const form = document.getElementById("notify-form");
const status = form?.querySelector(".notify-status");
const WORDS = {
  en: {
    badEmail: "That doesn't look like an email address.",
    sending: "Sending…",
    joined: "You're on the list.",
    failed: "That didn't go through. Please try again.",
    offline: "That didn't go through. Check your connection and try again.",
  },
  ar: {
    badEmail: "لا يبدو هذا عنوان بريد إلكتروني.",
    sending: "جار الإرسال…",
    joined: "أضفناك إلى القائمة.",
    failed: "لم يصل طلبك. حاول مرة أخرى.",
    offline: "لم يصل طلبك. تأكد من اتصالك ثم حاول مرة أخرى.",
  },
};
const say = WORDS[document.documentElement.lang === "ar" ? "ar" : "en"];

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const email = String(data.get("email") || "").trim();
  if (!email.includes("@")) {
    status.textContent = say.badEmail;
    return;
  }
  status.textContent = say.sending;
  try {
    const res = await fetch(form.action, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: data,
    });
    const body = await res.json().catch(() => ({}));
    status.textContent = body.message || (res.ok ? say.joined : say.failed);
    if (res.ok) form.reset();
  } catch {
    status.textContent = say.offline;
  }
  // A Turnstile token works once; get a fresh one for the next try.
  window.turnstile?.reset();
});
