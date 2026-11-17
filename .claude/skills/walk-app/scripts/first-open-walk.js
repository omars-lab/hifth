(async () => {
  // A first open, as Apple's reviewer gets it: no address passed in. Says which page opened, what
  // a screen reader was told, and whether a "Left off" ribbon is drawn though nothing was read yet.
  // Counts and labels only.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [`view=${innerWidth}x${innerHeight} lang=${document.documentElement.lang} hash=${location.hash || "(none)"}`];
  const heard = new Set();
  const listen = () => document.querySelectorAll("[role=status]").forEach((s) => { const t = s.textContent.trim(); if (t) heard.add(t); });
  for (let i = 0; i < 16; i++) { listen(); await wait(250); }
  out.push(`heard=[${[...heard].join(" | ")}]`);
  out.push(`leftOffAt4s=${document.querySelector("[data-bookmark-seam]") ? "yes" : "no"}`);
  await wait(8000);
  out.push(`leftOffAt12s=${document.querySelector("[data-bookmark-seam]") ? "yes" : "no"} hashAt12s=${location.hash || "(none)"}`);
  return out.join(" ; ");
})()
