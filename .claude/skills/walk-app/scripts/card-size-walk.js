(async () => {
  // The page's resting width with whatever card the route opened, after closing it, then with
  // the roots list opened over a page already there, and after closing that; `window.__stop = 1;`
  // on a line ahead of it stops after the first close. Widths, counts and button names only,
  // never note words.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const isClose = (b) => /^(Close|إغلاق)$/.test((b.getAttribute("aria-label") || b.textContent || "").trim());
  const settle = async () => {
    await wait(400);
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})));
    await wait(900);
  };
  const w = () => {
    const page = [...document.querySelectorAll("svg[aria-labelledby^='page-label-']")].find((e) => e.getBoundingClientRect().width && getComputedStyle(e).visibility === "visible");
    const r = page?.getBoundingClientRect();
    return r ? `${r.width.toFixed(1)}@${Math.round(r.left)}` : "none";
  };
  const cards = () => document.querySelectorAll("[role=dialog]").length;
  const closeTop = async () => {
    const b = [...document.querySelectorAll("[role=dialog] button")].find(isClose);
    if (b) b.click();
    else (document.activeElement || document.body).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    out.push(`close=${b ? "button" : "escape"}`);
    await settle();
  };
  const names = () => [...document.querySelectorAll("[role=dialog] button")].map((b) => (b.getAttribute("aria-label") || "").slice(0, 24)).filter(Boolean).slice(0, 6).join("|");
  const out = [`screen=${innerWidth}x${innerHeight}`];
  await settle();
  out.push(`start cards=${cards()} w=${w()} labels=${names()}`);
  await closeTop();
  out.push(`closed cards=${cards()} w=${w()} labels=${names()} hash=${location.hash.replace(/[^\w:/?=&.-]/g,"")}`);
  if (window.__stop) return out.join(" ; ");
  if (cards()) { await closeTop(); out.push(`closed-again cards=${cards()} w=${w()}`); }
  const roots = [...document.querySelectorAll("button")].find((b) => /^(Same roots ·|الجذور)/.test((b.getAttribute("aria-label") || b.textContent || "").trim()));
  if (roots) {
    roots.click(); await settle(); out.push(`roots-after cards=${cards()} w=${w()}`);
    await closeTop(); out.push(`closed2 cards=${cards()} w=${w()}`);
  } else out.push("no roots button");
  return out.join(" ; ");
})()
