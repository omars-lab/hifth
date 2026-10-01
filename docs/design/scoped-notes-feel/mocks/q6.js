/*
 * Question 6: how the page shows that a verse is in a note. Needs page.js
 * first, and window.MOCK_OPTION set to one of:
 *   A  a small mark on the verse's number, with a count when in more than one;
 *      tapping it lists that verse's notes
 *   B  a mark in the outer margin beside the line the verse starts on
 *   C  nothing on the page; the verse's own menu gains a "Notes" button
 *   D  a faint wash over the whole verse
 * The verses come from the three made-up notes in page.js, so every option
 * marks the same four verses on page 7.
 */
(() => {
  const { NOTES, lines } = window.SN;
  const option = window.MOCK_OPTION;
  const count = new Map();
  for (const n of NOTES) for (const v of n.verses) if (document.getElementById("verse-" + v)) count.set(v, (count.get(v) ?? 0) + 1);
  const css = document.createElement("style");
  css.textContent = `
    .sn-mark { position: fixed; z-index: 3; display: grid; place-items: center; border-radius: 99px;
      background: var(--accent); color: #fff; font: 600 10px/1 var(--font-chrome); box-shadow: 0 0 0 1.5px var(--paper-raised);
      padding: 0 !important; border: 0 !important; min-inline-size: 0 !important; min-block-size: 0 !important; }
    .sn-tick { position: fixed; z-index: 3; width: 3px; border-radius: 2px; background: var(--accent); }
    .sn-wash { position: fixed; z-index: 1; pointer-events: none; background: rgba(31,111,102,.13); }
    .sn-inline { display: flex; gap: 8px; align-items: baseline; margin: 2px 16px 6px; padding: 8px 10px; border-radius: 8px;
      background: var(--accent-tint); font: 14px var(--font-chrome); color: var(--ink); }
    .sn-inline small { color: var(--ink-soft); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sn-pop { position: fixed; z-index: 9998; left: 12px; right: 12px; padding: 12px 14px; border-radius: 12px;
      background: var(--paper-raised); box-shadow: var(--shadow-2); border: 1px solid rgba(0,0,0,.08); font: 14px var(--font-chrome); }
    .sn-pop h3 { margin: 0 0 8px; font-size: 13px; font-weight: 400; color: var(--ink-soft); }
    .sn-pop div { display: flex; justify-content: space-between; padding: 8px 0; border-top: 1px solid rgba(0,0,0,.08); }
    .sn-pop small { color: var(--ink-soft); font-size: 12px; }
  `;
  document.head.append(css);
  const at = (el, r) => Object.assign(el.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
  const key = (v) => document.getElementById("verse-" + v).getAttribute("surah") + ":" + document.getElementById("verse-" + v).getAttribute("ayah");

  function popFor(v, below) {
    document.querySelector(".sn-pop")?.remove();
    const pop = document.createElement("div");
    pop.className = "sn-pop";
    pop.style.top = below + 10 + "px";
    const notes = NOTES.filter((n) => n.verses.includes(v));
    pop.innerHTML = `<h3>Al-Baqarah · ${key(v)} is in ${notes.length} note${notes.length > 1 ? "s" : ""}</h3>` +
      notes.map((n) => `<div><span>${n.title}</span><small>${n.scope} · ${n.verses.length} verses</small></div>`).join("");
    document.body.append(pop);
  }

  // The outer margin: just past the right edge of the text block.
  const textRight = document.querySelector("path.ayahPolygon").ownerSVGElement.getBoundingClientRect().right;
  for (const [v, c] of count) {
    const rs = lines(v);
    if (!rs.length) continue;
    const first = rs[0], last = rs[rs.length - 1];
    const h = last.bottom - last.top;
    if (option === "A") {
      // The number sits at the left end of the verse's last line, about a
      // line-height wide; the mark rides on its upper-left shoulder.
      const m = document.createElement("button");
      m.className = "sn-mark";
      m.dataset.verse = v;
      m.setAttribute("aria-label", `${key(v)}: in ${c} note${c > 1 ? "s" : ""}`);
      const size = c > 1 ? 15 : 9;
      at(m, { left: last.left + h * 0.62 - size / 2, top: last.top + h * 0.14 - size / 2, width: size, height: size });
      m.textContent = c > 1 ? String(c) : "";
      m.addEventListener("click", () => popFor(v, last.bottom));
      document.body.append(m);
    } else if (option === "B") {
      for (let i = 0; i < c; i++) {
        const t = document.createElement("div");
        t.className = "sn-tick";
        at(t, { left: textRight + 1 + i * 5, top: first.top + h * 0.2, width: 3, height: h * 0.6 });
        document.body.append(t);
      }
    } else if (option === "D") {
      for (const r of rs) {
        const w = document.createElement("div");
        w.className = "sn-wash";
        at(w, { left: r.left, top: r.top, width: r.right - r.left, height: r.bottom - r.top });
        document.body.append(w);
      }
    }
  }

  if (option === "C") {
    // The verse's menu (a tap with the select tool) gains one line under its
    // title naming the notes; tapping it would open them.
    new MutationObserver(() => {
      const sheet = [...document.querySelectorAll("section[aria-label]")].find((s) => /\d+:\d+/.test(s.getAttribute("aria-label")));
      if (!sheet || sheet.querySelector(".sn-inline")) return;
      const v = [...count.keys()].find((x) => sheet.getAttribute("aria-label").includes(key(x)));
      const head = [...sheet.children].find((c) => c.textContent.includes(key(v)));
      if (!v || !head) return;
      const notes = NOTES.filter((n) => n.verses.includes(v));
      const line = document.createElement("div");
      line.className = "sn-inline";
      line.innerHTML = `<span>In ${notes.length} note${notes.length > 1 ? "s" : ""}</span><small>${notes.map((n) => n.title).join(" · ")}</small>`;
      head.after(line);
    }).observe(document.body, { childList: true, subtree: true });
  }
  return `q6 mock ${option}: ${count.size} verses`;
})();
