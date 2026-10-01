/*
 * Question 4: what the note tool does when it taps a verse. Needs page.js
 * first, and window.MOCK_OPTION set to one of:
 *   B  a list of notes first; pick one, or start a new note
 *   C  today's new-note box, with the suggested notes as one-tap choices in it;
 *      window.MOCK_ROWS = true lays them out as full rows (the first try, which
 *      covered most of the page) instead of small chips
 *   D  "keep adding": a bar says which note taps go to; no box opens
 * A is the app as it is, so it has no mock.
 */
(() => {
  const { NOTES, toast } = window.SN;
  const option = window.MOCK_OPTION;
  const css = document.createElement("style");
  css.textContent = `
    .sn-choices { margin-block: 10px 2px; display: grid; gap: 6px; }
    .sn-choices > span { font-size: 12px; color: var(--ink-soft); }
    .sn-choice { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; text-align: start;
      padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(31,111,102,.35); background: var(--accent-tint);
      font: 14px var(--font-chrome); color: var(--ink); cursor: pointer; }
    .sn-choice small { color: var(--ink-soft); font-size: 12px; white-space: nowrap; }
    .sn-more { font: 13px var(--font-chrome); color: var(--accent); background: none; border: 0; text-align: start; padding: 4px 2px; }
    .sn-added { margin-block-start: 8px; font-size: 13px; color: var(--accent-strong); }
    .sn-verses { display: flex; flex-wrap: wrap; gap: 4px; margin-block-start: 6px; }
    .sn-verses span { font-size: 12px; padding: 2px 8px; border-radius: 99px; background: var(--paper-sunk); }
    .sn-verses span.new { background: var(--accent); color: #fff; }
    .sn-pills { display: flex; flex-wrap: wrap; gap: 6px; }
    .sn-pills > span { flex-basis: 100%; }
    .sn-pills .sn-choice { padding: 4px 10px; border-radius: 99px; font-size: 13px; }
    .sn-pills .sn-choice small { display: none; }
    .sn-pills .sn-more { padding: 4px 6px; }
    .sn-sheet { position: fixed; z-index: 9998; inset-inline: 12px; padding: 14px; border-radius: 12px;
      background: var(--paper-raised); box-shadow: var(--shadow-2); border: 1px solid rgba(0,0,0,.08); font: 14px var(--font-chrome); }
    .sn-sheet h3 { margin: 0 0 4px; font-size: 13px; font-weight: 400; color: var(--ink-soft); }
    .sn-hide { display: none !important; }
    .sn-bar { position: fixed; z-index: 9998; left: 12px; right: 64px; bottom: 83px; height: 44px; display: flex; align-items: center;
      gap: 10px; padding: 0 6px 0 12px; border-radius: 10px; background: var(--accent); color: #fff; font: 14px var(--font-chrome);
      box-shadow: var(--shadow-2); }
    .sn-bar span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sn-bar button { background: rgba(255,255,255,.18); color: #fff; border: 0; border-radius: 8px; padding: 8px 12px; font: 600 14px var(--font-chrome); }
    .sn-flash { position: fixed; z-index: 2; pointer-events: none; background: rgba(31,111,102,.28); border-radius: 4px;
      transition: opacity .9s ease-out; }
  `;
  document.head.append(css);

  const verseOf = (box) => box.querySelector("div")?.textContent.split("·").pop().trim() ?? "";
  const choice = (n) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sn-choice";
    b.dataset.note = n.id;
    b.innerHTML = `<span>${n.title}</span><small>${n.scope} · ${n.verses.length} verses</small>`;
    return b;
  };

  function suggestInBox(box) {
    const verse = verseOf(box);
    const list = document.createElement("div");
    list.className = window.MOCK_ROWS ? "sn-choices" : "sn-choices sn-pills";
    list.innerHTML = "<span>Or add this verse to</span>";
    NOTES.forEach((n) => list.append(choice(n)));
    const more = document.createElement("button");
    more.className = "sn-more";
    more.textContent = window.MOCK_ROWS ? "More notes…" : "More…";
    list.append(more);
    box.querySelector("textarea").after(list);
    list.addEventListener("click", (e) => {
      const b = e.target.closest(".sn-choice");
      if (!b) return;
      const n = NOTES.find((x) => x.id === b.dataset.note);
      box.querySelector("div").textContent = `${n.title} · ${n.scope} · ${n.verses.length + 1} verses`;
      box.querySelector("textarea").value = n.text;
      const verses = document.createElement("div");
      verses.className = "sn-verses";
      verses.innerHTML = [verse, ...n.keys.split(" · ").filter(Boolean)]
        .map((k, i) => `<span class="${i ? "" : "new"}">${k}</span>`).join("");
      const added = document.createElement("div");
      added.className = "sn-added";
      added.innerHTML = `${verse} added to this note · <u>Undo</u>`;
      list.replaceWith(verses, added);
    });
  }

  function sheetInstead(box) {
    box.classList.add("sn-hide");
    const verse = verseOf(box);
    const r = document.getElementById("verse-54")?.getBoundingClientRect();
    const sheet = document.createElement("div");
    sheet.className = "sn-sheet";
    sheet.style.top = Math.max(12, (r ? r.top : 400) - 300) + "px";
    sheet.innerHTML = `<h3>Al-Baqarah · ${verse}: add to a note</h3>`;
    const list = document.createElement("div");
    list.className = "sn-choices";
    NOTES.forEach((n) => list.append(choice(n)));
    const fresh = document.createElement("button");
    fresh.className = "sn-choice";
    fresh.innerHTML = "<span>New note…</span>";
    list.append(fresh);
    sheet.append(list);
    document.body.append(sheet);
    list.addEventListener("click", (e) => {
      const b = e.target.closest(".sn-choice");
      if (!b) return;
      sheet.remove();
      if (b === fresh) box.classList.remove("sn-hide");
      else toast(`${verse} added to ${NOTES.find((x) => x.id === b.dataset.note).title}`);
    });
  }

  let count = NOTES[0].verses.length;
  function keepAdding(box) {
    box.classList.add("sn-hide");
    const verse = verseOf(box);
    count += 1;
    document.querySelector(".sn-bar span").textContent = `Adding to ${NOTES[0].title} · ${count}`;
    toast(`${verse} added to ${NOTES[0].title}`);
    // Today the tool is put down after one note. Here it stays up: the verse
    // is kept (with a word of text, so the pin stays) and the tool picked again.
    const area = box.querySelector("textarea");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(area, NOTES[0].title);
    area.dispatchEvent(new Event("input", { bubbles: true }));
    setTimeout(() => {
      [...box.querySelectorAll("button")].pop().click();
      setTimeout(() => document.querySelector('[role="radio"][aria-label="Note"]')?.click(), 50);
    }, 50);
  }

  if (option === "D") {
    const bar = document.createElement("div");
    bar.className = "sn-bar";
    bar.innerHTML = `<span>Adding to ${NOTES[0].title} · ${count}</span><button type="button">Stop</button>`;
    document.body.append(bar);
    // A short glow on the verse a tap went to, the only sign on the page itself.
    document.addEventListener("pointerdown", (e) => {
      const p = e.target.closest?.("path.ayahPolygon");
      if (!p) return;
      for (const r of window.SN.lines(Number(p.id.slice(6)))) {
        const f = document.createElement("div");
        f.className = "sn-flash";
        Object.assign(f.style, { left: r.left + "px", top: r.top + "px", width: r.right - r.left + "px", height: r.bottom - r.top + "px" });
        document.body.append(f);
        setTimeout(() => (f.style.opacity = "0"), 250);
        setTimeout(() => f.remove(), 1300);
      }
    }, true);
  }

  // The app's note box is the hook: each option changes it the moment it opens,
  // before it is placed, so it is placed with its new height.
  new MutationObserver((records) => {
    for (const rec of records)
      for (const node of rec.addedNodes) {
        const box = node.nodeType === 1 && (node.matches("[data-note-box]") ? node : node.querySelector?.("[data-note-box]"));
        if (!box) continue;
        if (option === "B") sheetInstead(box);
        else if (option === "C") suggestInBox(box);
        else if (option === "D") keepAdding(box);
      }
  }).observe(document.body, { childList: true, subtree: true });
  return "q4 mock " + option;
})();
