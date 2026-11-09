// The pitch demo's steps, as the iPad app walks them (make pitch-walk).
//
// One entry per step of .claude/skills/walk-app/pitch-script.md that a made-up
// tap can do; steps 2 (a turn by the page's edge) and 14 (the surah playing)
// are walked by hand, as the browser test marks them. Each step's checks follow
// apps/web/e2e/pitch-script.spec.ts, check for check, so the browser and the
// iPad count the same thing. When a step changes there, change it here too.
//
// Each `run` is sent into the page as its source text and runs there, so it
// may use only what `helpers` hands it. It answers with checks: what was
// checked, whether it held, and a count or a box. Never a word of the note or
// the verse, which never leave the private build.

/** What every step may use, run in the page. */
export function helpers() {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const box = (e) => {
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? r : null;
  };
  const shown = (e) => {
    const r = box(e);
    return !!r && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && getComputedStyle(e).visibility !== "hidden";
  };
  const inView = (e) => {
    const r = box(e);
    return !!r && r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1;
  };
  const overlaps = (a, b) => !!a && !!b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const f = (r) => (r ? `${Math.round(r.left)},${Math.round(r.top)}-${Math.round(r.right)},${Math.round(r.bottom)}` : "none");
  /** An element's name as a screen reader says it, near enough for these steps. */
  const named = (e) => {
    const label = e.getAttribute("aria-label");
    if (label) return label.trim();
    const by = e.getAttribute("aria-labelledby");
    if (by) return by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ").trim();
    return (e.textContent ?? "").trim();
  };
  const all = (sel, root = document) => [...root.querySelectorAll(sel)];
  const dialogs = () => all("[role=dialog]").filter(shown);
  const dialog = (re) => dialogs().find((d) => !re || re.test(named(d)));
  const buttons = (root, re) => all("button, [role=button]", root).filter((b) => re.test(named(b)));
  const region = (root, name) => all("[role=region], section[aria-label]", root).find((e) => named(e) === name && shown(e));
  const pageSvg = (n) => all(`svg[aria-labelledby="page-label-${n}"]`).find(shown);
  const pages = () => all("svg[aria-labelledby^='page-label-']").filter(shown);
  const rows = (root) => all("li, [role=listitem]", root);
  const lit = () => all("#hifth-overlay .hl-sel").map(box).filter(Boolean);
  /** Wait until `get` gives something truthy, or the time is up. */
  const until = async (get, ms = 10000) => {
    const end = Date.now() + ms;
    for (;;) {
      const v = get();
      if (v || Date.now() > end) return v;
      await wait(100);
    }
  };
  /** Wait until an element stops moving: two equal boxes in a row. */
  const settle = async (e, ms = 10000) => {
    const end = Date.now() + ms;
    let last = "";
    for (;;) {
      const now = f(box(e));
      if (now === last || Date.now() > end) return now === last;
      last = now;
      await wait(150);
    }
  };
  const fire = (type, p, el) =>
    el?.dispatchEvent(
      new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: "touch", isPrimary: true, clientX: p.x, clientY: p.y, button: 0, buttons: type === "pointerup" ? 0 : 1 }),
    );
  /** A finger's tap at a point: down, up, then the click the browser sends. */
  const tap = async (p) => {
    const el = document.elementFromPoint(p.x, p.y);
    fire("pointerdown", p, el);
    await wait(60);
    fire("pointerup", p, el);
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: p.x, clientY: p.y }));
  };
  /** A point the page says belongs to this element, near its middle (a verse that wraps has a gap in its box). */
  const pointIn = (el) => {
    el?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    const r = box(el);
    if (!r) return null;
    const steps = [0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9];
    for (const fy of steps)
      for (const fx of steps) {
        const x = r.left + r.width * fx;
        const y = r.top + r.height * fy;
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
        const hit = document.elementFromPoint(x, y);
        if (hit === el || el.contains(hit)) return { x, y };
      }
    return null;
  };
  const checks = [];
  const check = (what, ok, got) => {
    checks.push({ what, ok: !!ok, got: got === undefined ? null : got });
    return !!ok;
  };
  /** No line of the lit verse under the open card (verseClearOfCard in the browser test). */
  const verseClear = async (card) => {
    await settle(card);
    const lines = await until(() => (lit().length ? lit() : null), 5000);
    if (!check("a verse is lit", lines, lines ? lines.length : 0)) return;
    const c = box(card);
    const under = lines.filter((l) => overlaps(l, c)).length;
    check("no line of the verse is under the card", under === 0, { under, card: f(c) });
  };
  return { wait, box, shown, inView, overlaps, f, named, all, dialogs, dialog, buttons, region, pageSvg, pages, rows, lit, until, settle, tap, pointIn, checks, check, verseClear };
}


export const STEPS = [
  {
    n: 1,
    title: "the app opens on two pages of the mus'haf with nothing over them",
    route: "/hafs-kfqc/p42",
    run: async (h) => {
      h.check("page 42 is in sight", await h.until(() => h.pageSvg(42), 20000));
      h.check("two pages are open", h.pages().length === 2, h.pages().length);
      h.check("no card stands over the pages", h.dialogs().length === 0, h.dialogs().length);
    },
  },
  {
    n: 3,
    title: "a tap on 2:255 opens its note beside it, and the whole verse stays in sight",
    route: "/hafs-kfqc/p42",
    run: async (h) => {
      const svg = await h.until(() => h.pageSvg(42), 20000);
      if (!h.check("page 42 is in sight", svg)) return;
      const at = h.pointIn(svg.querySelector(`#verse-262`)); // 2:255 is the 262nd verse of the book (al-Fatihah has 7)
      if (!h.check("2:255 has a point to tap", at)) return;
      await h.tap(at);
      const card = await h.until(() => h.dialog(/2:255/));
      if (!h.check("a card for 2:255 opens", card, h.dialogs().length)) return;
      await h.verseClear(card);
    },
  },
  {
    n: 4,
    title: "2:255's note reads in its ten printed paragraphs, to its end",
    route: "/hafs-kfqc/2:255?open=commentary",
    run: async (h) => {
      const note = await h.until(() => h.dialogs().map((d) => h.region(d, "Commentary")).find(Boolean), 20000);
      if (!h.check("the note is open", note)) return;
      const ps = h.all("p", note);
      h.check("the note has ten paragraphs", ps.length === 10, ps.length);
      const last = ps[ps.length - 1];
      last?.scrollIntoView({ block: "nearest" });
      await h.wait(600);
      h.check("the last paragraph can be read", last && h.inView(last), h.f(h.box(last)));
    },
  },
  {
    n: 5,
    title: "2:255's related places show eight cards and a way to the rest, and each card opens its verse",
    route: "/hafs-kfqc/2:255?open=commentary",
    run: async (h) => {
      const card = await h.until(() => h.dialogs().find((d) => /Related verses/.test(d.textContent ?? "")), 20000);
      if (!h.check("the related places are in the card", card)) return;
      const hops = h.buttons(card, /^Hop to /);
      h.check("eight places are shown", hops.length === 8, hops.length);
      h.check("a button shows the rest", h.buttons(card, /^Show \d+ more related verses?$/).length > 0);
      const target = h.named(hops[0] ?? card).match(/\d+:\d+/)?.[0] ?? "";
      if (!h.check("the first place names its verse", target, target)) return;
      hops[0].scrollIntoView({ block: "nearest" });
      await h.wait(400);
      hops[0].click();
      const opened = await h.until(() => h.dialog(new RegExp(`${target}\\b`)));
      h.check("the first place opens its verse", opened, target);
    },
  },
  {
    n: 6,
    title: "2:255's roots list opens clear of the verse",
    route: "/hafs-kfqc/2:255?open=roots",
    run: async (h) => {
      const card = await h.until(() => h.dialog(/root/i), 20000);
      if (!h.check("the roots list opens", card, h.dialogs().length)) return;
      await h.verseClear(card);
    },
  },
  {
    n: 7,
    title: "2:48's look-alikes each say why they are there, and the passage reads 2:122–2:123",
    route: "/hafs-kfqc/2:48?open=lookalikes",
    run: async (h) => {
      const list = await h.until(() => h.dialogs().find((d) => h.rows(d).length), 20000);
      if (!h.check("the look-alike list opens", list)) return;
      const rows = h.rows(list);
      const passage = rows.filter((r) => /2:122.2:123/.test(r.innerText)).length;
      h.check("one row is the passage 2:122–2:123", passage === 1, passage);
      const bare = rows.filter((r) => r.innerText.split("\n").filter((l) => l.trim()).length <= 1 && !r.querySelector("[aria-expanded]")).length;
      h.check("every row says why it is there", bare === 0, { rows: rows.length, bare });
    },
  },
  {
    n: 8,
    title: "opening 2:48's row for 2:123 shows the comparison, its name in sight under the title",
    route: "/hafs-kfqc/2:48?open=lookalikes",
    run: async (h) => {
      const list = await h.until(() => h.dialogs().find((d) => h.rows(d).length), 20000);
      if (!h.check("the look-alike list opens", list)) return;
      const row = h.rows(list).find((r) => /2:123/.test(r.innerText) && !/2:122/.test(r.innerText));
      const opener = row?.querySelector("[aria-expanded]");
      if (!h.check("the row for 2:123 can be opened", opener)) return;
      opener.click();
      const svgs = await h.until(() => (h.all("[id^='diff-'] svg", row).length === 2 ? 2 : 0));
      h.check("the comparison shows both verses", svgs === 2, h.all("[id^='diff-'] svg", row).length);
      await h.settle(row);
      const title = h.box(list.querySelector("header"));
      const top = h.box(row);
      h.check("the row's name is under the title, not behind it", title && top && top.top >= title.bottom - 1, { row: h.f(top), title: h.f(title) });
    },
  },
  {
    n: 9,
    title: "10:15's later look-alike 19:73 opens side by side",
    route: "/hafs-kfqc/10:15?open=lookalikes",
    run: async (h) => {
      const later = await h.until(() => h.buttons(document, /later surahs/).find(h.shown), 20000);
      if (!h.check("a button opens the later surahs", later)) return;
      later.click();
      const list = await h.until(() => h.dialog(/later surahs/));
      if (!h.check("the later surahs' list opens", list, h.dialogs().length)) return;
      const row = await h.until(() => h.rows(list).find((r) => /19:73/.test(r.innerText)));
      const opener = row?.querySelector("[aria-expanded]");
      if (!h.check("the row for 19:73 can be opened", opener)) return;
      opener.click();
      const svgs = await h.until(() => (h.all("[id^='diff-'] svg", row).length === 2 ? 2 : 0));
      h.check("the comparison shows both verses", svgs === 2, h.all("[id^='diff-'] svg", row).length);
    },
  },
  {
    n: 10,
    title: "15:30's passage in surah 38 opens with its name in sight under the list's title",
    route: "/hafs-kfqc/15:30?open=lookalikes",
    run: async (h) => {
      const list = await h.until(() => h.dialog(/later surahs/), 20000);
      if (!h.check("the later surahs' list opens", list, h.dialogs().length)) return;
      const row = await h.until(() => h.rows(list).find((r) => /38:72.38:75/.test(r.innerText)));
      const opener = row?.querySelector("[aria-expanded]");
      if (!h.check("the passage 38:72–38:75 can be opened", opener)) return;
      opener.click();
      const svgs = await h.until(() => (h.all("[id^='diff-'] svg", row).length === 2 ? 2 : 0));
      h.check("the comparison shows both passages", svgs === 2, h.all("[id^='diff-'] svg", row).length);
      await h.settle(row);
      const title = h.box(list.querySelector("header"));
      const top = h.box(row);
      h.check("the row's name is under the title, not behind it", title && top && top.top >= title.bottom - 1, { row: h.f(top), title: h.f(title) });
    },
  },
  {
    n: 11,
    title: "al-Kahf's introduction opens from the surah's name and leaves the name in sight",
    route: "/hafs-kfqc/p293",
    run: async (h) => {
      const svg = await h.until(() => h.pageSvg(293), 20000);
      const name = svg && (await h.until(() => h.buttons(svg, /^Surah introduction/).find(h.shown)));
      if (!h.check("the surah's name is a button", name)) return;
      name.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      const card = await h.until(() => h.dialogs().find((d) => h.region(d, "Surah introduction")));
      if (!h.check("the introduction opens", card, h.dialogs().length)) return;
      await h.settle(card);
      h.check("the card does not cover the name", !h.overlaps(h.box(name), h.box(card)), { name: h.f(h.box(name)), card: h.f(h.box(card)) });
    },
  },
  {
    n: 12,
    title: "18:10's note opens, with the book's slanted words slanted",
    route: "/hafs-kfqc/18:10?open=commentary",
    run: async (h) => {
      const note = await h.until(() => h.dialogs().map((d) => h.region(d, "Commentary")).find(Boolean), 20000);
      if (!h.check("the note is open", note)) return;
      const slanted = h.all("em, i", note).length;
      h.check("the note has slanted words", slanted > 0, slanted);
    },
  },
  {
    n: 13,
    title: "18:60's note covers the whole story, and its link lands on 18:65",
    route: "/hafs-kfqc/18:60?open=commentary",
    run: async (h) => {
      const note = await h.until(() => h.dialogs().map((d) => h.region(d, "Commentary")).find(Boolean), 20000);
      if (!h.check("the note is open", note)) return;
      const card = h.dialogs().find((d) => d.contains(note));
      // The note names six places past itself, each one card: 18:65, the runs
      // 18:9–26 and 18:83–98, and 25:53, 27:61 and 55:19–20 (its verse 93 sits
      // inside 83–98). Counted against the book's note on 2026-11-09; the script
      // had said eight. The browser test checks the same six.
      const places = h.buttons(card, /^Hop to /).length;
      h.check("the note links to its six places", places === 6, places);
      const hop = h.buttons(card, /Hop to .*18:65\b/)[0];
      if (!h.check("the note links to 18:65", hop)) return;
      hop.scrollIntoView({ block: "nearest" });
      await h.settle(hop);
      hop.click();
      const landed = await h.until(() => h.dialog(/18:65\b/));
      if (!h.check("the link lands on 18:65", landed, h.dialogs().length)) return;
      await h.verseClear(landed);
    },
  },
  {
    n: 15,
    title: "the Mistake pen marks a word without covering it, and Undo takes the mark away",
    route: "/hafs-kfqc/p7",
    run: async (h) => {
      const svg = await h.until(() => h.pageSvg(7), 20000);
      if (!h.check("page 7 is in sight", svg)) return;
      // An iPad has no keyboard, so the pen is picked as a finger would: from
      // the bar, or behind "Mark up" where a screen folds the pens away
      // (the browser test presses M instead).
      const pen = () => h.all("[role=radio][aria-keyshortcuts=M], [data-phone-bar] [role=radio][data-pen=mistake]").find(h.shown);
      const unfold = async () => {
        const home = h.all("[data-pen-home]").find((e) => h.shown(e) || e.children.length);
        const opener = home && h.all("button", home).find((b) => !b.closest("[role=toolbar]") && h.shown(b));
        const tray = h.all("[data-phone-bar] button[aria-expanded=false]").find(h.shown);
        (opener || tray)?.click();
        await h.wait(800);
      };
      if (!pen()) await unfold();
      if (!h.check("the Mistake pen can be reached", pen())) return;
      if (pen().getAttribute("aria-checked") !== "true") {
        pen().click();
        await h.wait(700);
      }
      const picked = pen()?.getAttribute("aria-checked") ?? document.querySelector("[data-phone-bar]")?.getAttribute("data-tool");
      h.check("the Mistake pen is picked", picked === "true" || picked === "mistake", picked);
      const at = h.pointIn(svg.querySelector("#verse-46"));
      if (!h.check("verse 46 has a point to tap", at)) return;
      await h.tap(at);
      const ask = await h.until(() => h.dialog(/^What went wrong in /));
      if (!h.check("the pen asks what went wrong", ask, h.dialogs().length)) return;
      await h.settle(ask);
      const b = h.box(ask);
      h.check("the question does not stand over the word", !(at.x >= b.left && at.x <= b.right && at.y >= b.top && at.y <= b.bottom), { ask: h.f(b), tap: `${Math.round(at.x)},${Math.round(at.y)}` });
      const whole = h.buttons(ask, /^The whole word$/)[0];
      if (!h.check("the question offers the whole word", whole)) return;
      whole.click();
      const marks = () => h.all("[data-mistake-word]").filter(h.shown).length;
      const one = await h.until(() => (marks() === 1 ? 1 : 0), 5000);
      h.check("one word is marked", one === 1, marks());
      const undoShown = () => h.buttons(document, /^Undo/).find(h.shown);
      if (!undoShown()) await unfold();
      const undo = undoShown();
      if (!h.check("there is an Undo button", undo)) return;
      undo.click();
      const none = await h.until(() => marks() === 0, 5000);
      h.check("Undo takes the mark away", none, marks());
    },
  },
  {
    n: 16,
    title: "a verse nobody planned for (2:37) opens its note like the others",
    route: "/hafs-kfqc/2:37?open=commentary",
    run: async (h) => {
      const note = await h.until(() => h.dialogs().map((d) => h.region(d, "Commentary")).find(Boolean), 10000);
      if (!h.check("the note is open", note)) return;
      const ps = h.all("p", note).length;
      h.check("the note has paragraphs", ps > 0, ps);
    },
  },
];

/** Step ids, as file names: s01, s03, … */
export const stepId = (n) => `s${String(n).padStart(2, "0")}`;

/**
 * One step's question for the page: the helpers, the step, a time limit, and
 * an answer that is its checks. A step that throws says so as a failed check.
 */
export function stepEval(step, limitMs = 60000) {
  const run = step.run.toString();
  return `Promise.race([
  (async () => {
    const h = (${helpers.toString()})();
    try { await (${run})(h); } catch (e) { h.check("the step ran without an error", false, String(e && e.message || e)); }
    return { checks: h.checks };
  })(),
  new Promise((done) => setTimeout(() => done({ checks: [{ what: "the step finished in time", ok: false, got: ${limitMs} }] }), ${limitMs})),
])`;
}
