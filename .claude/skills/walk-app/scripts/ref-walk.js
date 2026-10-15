/*
 * In the iPad or Mac app, on a verse whose note is open: how many references the note
 * offers as buttons, how many of them come right after a Bible book's name (there
 * should be none), and how many open the verse `window.__want` names; then presses
 * that one, says where it went and whose note is up, and presses Back. A line ahead
 * of it sets the verse to look for, e.g. `window.__want = "4:86";` (a verse no link
 * names gives the counts only). Verse numbers and counts only, never note words.
 *   make app-probe TARGET=ipad SIDEWAYS=1 LOCALE=en "ROUTE=/hafs-kfqc/4:94?open=commentary" EVALFILE=<file with the line, then this> DELAY_MS=2500 PROBE_TIMEOUT_S=120
 */
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const box = (e) => { const r = e && e.getBoundingClientRect(); return r && r.width ? r : null; };
  const west = (s) => s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const key = (e) => (west(e.getAttribute("aria-label") || "").match(/\d+:\d+/) || ["?"])[0];
  const want = window.__want || "4:86";
  const out = [];
  await wait(1500);
  const region = () => [...document.querySelectorAll("[role=dialog]")].find((e) => box(e));
  const n = region();
  if (!n) return "no note";
  const gos = [...n.querySelectorAll('button[aria-label^="Go to"], button[aria-label^="اذهب إلى"]')];
  const keys = gos.map(key);
  const book = /\b(?:Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Psalms?|Isaiah|Luke|Matthew|Mark|John|Romans|Corinthians)\s+$/;
  let bible = 0;
  for (const g of gos) { const r = document.createRange(); r.setStart(n, 0); r.setEndBefore(g); if (book.test(r.toString().slice(-24))) bible++; }
  out.push(`noteOn=${key(n)}`, `links=${gos.length}`, `afterBibleName=${bible}`, `toWant=${keys.filter((k) => k === want).length}`);
  const go = gos.find((g, i) => keys[i] === want);
  if (!go) return out.join(" ; ");
  go.scrollIntoView({ block: "center" }); await wait(500);
  const r = box(go);
  const top = r && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  out.push(`touchable=${!!top && go.contains(top)}`);
  go.click(); await wait(2500);
  const n2 = region();
  out.push(`after=${location.hash.replace(/[?].*/, "")}`, `noteVerse=${n2 ? key(n2) : "none"}`);
  const back = [...document.querySelectorAll("button")].find((e) => box(e) && /^(Back to|ارجع إلى)/.test((e.getAttribute("aria-label") || e.textContent || "").trim()));
  out.push(`backBtn=${back ? "yes" : "no"}`);
  if (back) { back.click(); await wait(2500); out.push(`backTo=${location.hash.replace(/[?].*/, "")}`); }
  return out.join(" ; ");
})()
