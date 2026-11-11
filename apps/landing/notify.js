// The notify-me form: send the email and the spam-check token, say what happened.
// Without JavaScript the form still posts to /api/notify, which answers with a plain page.
const form = document.getElementById("notify-form");
const status = form?.querySelector(".notify-status");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const email = String(data.get("email") || "").trim();
  if (!email.includes("@")) {
    status.textContent = "That doesn't look like an email address.";
    return;
  }
  status.textContent = "Sending…";
  try {
    const res = await fetch(form.action, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: data,
    });
    const body = await res.json().catch(() => ({}));
    status.textContent = body.message || (res.ok ? "You're on the list." : "That didn't go through. Please try again.");
    if (res.ok) form.reset();
  } catch {
    status.textContent = "That didn't go through. Check your connection and try again.";
  }
  // A Turnstile token works once; get a fresh one for the next try.
  window.turnstile?.reset();
});
