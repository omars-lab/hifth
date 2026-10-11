(async () => {
  // The surah introduction (pitch), opened from the surah's name on the page the route shows, or,
  // with window.__from "deep" set on a line before this script, from 2:255's number menu (route
  // /hafs-kfqc/2:255). Prints, before and after, the pages' boxes, the card's box and which side
  // of the book it lies on, whether the introduction is in it, the surah name's box against the
  // toolbar and the card, and whether the verse's tools are up (they step aside). Boxes and
  // interface names only, never the introduction's words. The page's own toolbar ("page tools",
  // which shares its first Arabic word with the verse's tools) is not counted.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? r : null; };
  const on = (r) => r && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const f = (b) => (b ? `${Math.round(b.left)}-${Math.round(b.right)}x${Math.round(b.top)}-${Math.round(b.bottom)}` : "none");
  const pages = () => [...document.querySelectorAll("svg[aria-labelledby^='page-label-']")].filter((e) => on(box(e))).map((e) => `${e.getAttribute("aria-labelledby").replace("page-label-", "")}@${f(box(e))}`).join(" ");
  const sheet = () => [...document.querySelectorAll("[role=dialog]")].find((e) => on(box(e)));
  const look = (tag) => {
    const s = sheet();
    const intro = s && s.querySelector("section[aria-label='Surah introduction'], section[aria-label='مقدمة السورة']");
    const head = box(document.querySelector("header"));
    const name = box([...document.querySelectorAll("[data-intro-badge]")].find((e) => on(box(e))));
    const tools = [...document.querySelectorAll("[aria-label^='Tools for'], [aria-label^='أدوات']")].filter((e) => on(box(e)) && !["toolbar", "radiogroup"].includes(e.getAttribute("role") || "")).length;
    const grip = s ? s.querySelectorAll('[class*="grip"]').length : 0;
    return `${tag}: view=${innerWidth}x${innerHeight} pages=[${pages()}] header=${f(head)} sheet=${f(box(s))} side=${s?.getAttribute("data-side") ?? "-"} intro=${intro ? "yes" : "no"} name=${f(name)} toolsUp=${tools} grip=${grip}`;
  };
  await wait(2500);
  const out = [look("A")];
  if (window.__from === "deep") {
    const n = [...document.querySelectorAll("[data-verse-number][data-verse-key$='/2:255']")].find((e) => on(box(e)));
    if (!n) return out.concat("no 2:255 number").join(" ; ");
    n.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await wait(800);
    const item = [...document.querySelectorAll("[role=menuitem]")].find((e) => /(Surah introduction|مقدمة السورة)/.test(e.textContent + " " + (e.getAttribute("aria-label") || "")));
    if (!item) return out.concat(`no intro item; items=${[...document.querySelectorAll("[role=menuitem]")].length}`).join(" ; ");
    item.click();
  } else {
    const name = [...document.querySelectorAll("[data-intro-badge]")].find((e) => on(box(e)));
    if (!name) return out.concat("no name on screen").join(" ; ");
    name.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }
  for (const t of [600, 1500]) { await wait(t); out.push(look(`B+${t}`)); }
  return out.join(" ; ");
})()
