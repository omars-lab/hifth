/*
 * A reference followed, the iPad turned, then Back (checklist: "Follow a
 * reference in a note, turn the iPad, then press Back"). A scholar in the room
 * reads a note on its side, follows one of its references, turns the iPad
 * upright to hand it across, and comes Back: the note they started from should
 * be up again on its own verse, the verse in sight, and nothing left over.
 *
 * The page cannot turn the simulator, so the sideways probe's UI test does, at
 * the seconds TURNS names; this follows the first live reference before the
 * first turn, presses the note's Back after it, and watches the second turn
 * (back on its side). After each step it prints the address, the pages shown,
 * the verses lit on the screen, the note's box, how much of the lit verse the
 * note covers, how many lit lines run off the screen, whether a Back button is
 * up and how many notes are open. Boxes, verse numbers and button names only,
 * never note words.
 * Runs in the iPad app, on its side, opened on a verse's note:
 *   make app-probe TARGET=ipad SIDEWAYS=1 LOCALE=en "ROUTE=/hafs-kfqc/2:48?open=commentary" EVALFILE=.claude/skills/walk-app/scripts/ref-turn-walk.js DELAY_MS=2500 TURNS=14,30 PROBE_TIMEOUT_S=200
 */
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? r : null; };
  const f = (b) => (b ? `${Math.round(b.left)},${Math.round(b.top)}-${Math.round(b.right)},${Math.round(b.bottom)}` : "none");
  const overlap = (a, b) => (a && b ? Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) : 0);
  const onScreen = (r) => r && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const isAr = document.documentElement.lang === "ar";
  const shown = () => [...document.querySelectorAll("svg[aria-labelledby^='page-label-']")]
    .filter((e) => onScreen(box(e)) && getComputedStyle(e).visibility === "visible")
    .map((e) => e.getAttribute("aria-labelledby").replace("page-label-", "")).join("+");
  const litEls = () => [...document.querySelectorAll("#hifth-overlay [data-hl-group='selection']")].filter((e) => onScreen(box(e)));
  const sel = () => [...new Set(litEls().map((e) => (e.getAttribute("data-hl-key") || "?").split("/").pop()))].join("+");
  const note = () => [...document.querySelectorAll("[role=dialog]")].find((d) => onScreen(box(d))) || null;
  const backOf = (d) => d && [...d.querySelectorAll("button")].find((b) => /↩|↪/.test(b.textContent));
  const out = [];
  const look = (label) => {
    const d = note(); const db = box(d);
    const lit = litEls().map(box);
    const all = lit.reduce((s, b) => s + b.width * b.height, 0);
    const under = lit.reduce((s, b) => s + overlap(b, db), 0);
    const off = lit.filter((b) => b.bottom > innerHeight || b.top < 0 || b.right > innerWidth || b.left < 0).length;
    out.push(`${label}: view=${innerWidth}x${innerHeight} hash=${location.hash} shown=${shown() || "none"} sel=${sel() || "-"} note=${f(db)} litUnderNote=${all ? Math.round((100 * under) / all) : "-"}% litOff=${off} back=${backOf(d) ? "yes" : "no"} notes=${document.querySelectorAll("[role=dialog]").length}`);
  };
  // Waits for the screen to change size, then lets it settle.
  const turned = async (ms) => {
    const was = `${innerWidth}x${innerHeight}`;
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { await wait(250); if (`${innerWidth}x${innerHeight}` !== was) { await wait(2200); return true; } }
    return false;
  };
  await wait(1500);
  look("A open");
  const cite = note() && [...note().querySelectorAll("button")].find((b) => !b.disabled && (isAr ? /^اذهب إلى/ : /^Go to/).test(b.getAttribute("aria-label") || ""));
  if (!cite) { out.push("B: no live reference"); return out.join(" ; "); }
  out.push(`B follow=${cite.getAttribute("aria-label")}`);
  cite.click();
  await wait(3000);
  look("B followed");
  out.push(`C turnedUpright=${await turned(25000)}`);
  look("C upright");
  const back = backOf(note());
  if (back) { back.click(); await wait(3000); look("D back"); } else out.push("D: no back button");
  out.push(`E turnedSide=${await turned(25000)}`);
  look("E side");
  return out.join(" ; ");
})()
