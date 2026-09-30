#!/usr/bin/env node
/**
 * Render docs/design/share-sheet-options.html — the decision page for what the
 * share sheet asks and which links it hands over (docs/decisions/share-sheet-builder.md).
 *
 * The three shapes differ in something a picture cannot carry: how many taps
 * a link takes, and whether a reader can say what the link opens without
 * knowing the address grammar. So the page draws nothing. It mounts the real
 * app three times, phone-sized, one shape each — the app picks its sheet from
 * `?share=a|b|c` in its own address — and the reader decides by sending a link
 * from each.
 *
 * The frames' addresses are set by the page's own script, from where the page
 * is served: on the site the app sits two folders up (/hifth/ above
 * /hifth/docs/design/). Opened from a clone, there is no app beside it, so each
 * frame says so and names the setting that picks a shape.
 *
 * ── No Qur'an ───────────────────────────────────────────────────────────────
 * Everything a reader reads here is English chrome. The writer refuses if its
 * own output carries an Arabic codepoint.
 *
 * Registered in docs/decisions.json as the `builtBy` for share-sheet-builder.
 *
 *   node scripts/build-share-sheet-options.mjs
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";

const OUT = join(ROOT, "docs/design/share-sheet-options.html");

const OPTIONS = [
  {
    id: "a",
    name: "A · One tap, the website link",
    gist: "The sheet as it was: tap Share and the website link goes to your phone's share sheet, or is copied.",
    pros: ["One tap, nothing to read.", "Every phone knows what to do with a website link."],
    cons: [
      "There is no way to get a link that opens the app itself.",
      "The link opens the verse and nothing else: a teacher who wants to point at its look-alikes has to say so in words.",
    ],
    then: "A link to the app stays a thing only the contract page can write, on a computer, by hand.",
  },
  {
    id: "b",
    name: "B · Two links, no questions",
    gist: "Tap Share and a small tray offers two buttons: the website link, and the app link.",
    pros: ["The app link is one tap away, on the phone, where the verse is.", "Nothing to decide but which link."],
    cons: [
      "Two taps to any link, every time.",
      "Still no way to say what the link should open on arrival.",
    ],
    then: "The reader has to know which of the two links the other person can open; the sheet does not help them choose.",
  },
  {
    id: "c",
    name: "C · Two links, and what the link opens",
    gist: "The same tray, with one question above the two buttons: open the verse as it is, its look-alikes, or its roots.",
    pros: [
      "A teacher can send a student straight to the verse's look-alikes, and the link carries that.",
      "The question is answered by tapping a word, not by knowing an address.",
      "The verse as it is stays the default, so a reader in a hurry taps twice, as in B.",
    ],
    cons: [
      "The tray is taller: three or four choices to look at before the links.",
      "Every panel the app grows will ask to be on this list.",
    ],
    then: "The sheet becomes the phone's link builder, and each new panel that a link can open is a row added here.",
  },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const list = (xs) => `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sharing a verse from a phone</title>
<style>
  :root{
    --paper:#f4efe6; --paper-raised:#fbf8f2; --paper-sunk:#ece4d6;
    --ink:#26201a; --ink-soft:#5c5347; --ink-faint:#6b6255;
    --accent:#1f6f66; --accent-strong:#17544d; --accent-tint:#d7e7e3;
    --radius-md:10px; --radius-lg:16px;
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --paper:#1c1915; --paper-raised:#25211c; --paper-sunk:#332d26;
      --ink:#efe8dc; --ink-soft:#c9bfb0; --ink-faint:#a89e8f;
      --accent:#5fb3a8; --accent-strong:#8fd0c6; --accent-tint:#23403c;
    }
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);
    font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
  main{max-width:78rem;margin:0 auto;padding:2rem 1rem 5rem;}
  h1{font-size:1.9rem;line-height:1.2;margin:.2rem 0 .4rem;}
  h2{font-size:1.28rem;margin:2.4rem 0 .5rem;}
  p,li{max-width:40rem;} .lead{font-size:1.12rem;color:var(--ink-soft);}
  a{color:var(--accent-strong);}
  .glossary{background:var(--paper-raised);border:1px solid var(--paper-sunk);
    border-radius:var(--radius-md);padding:.8rem 1rem;margin:1.2rem 0;font-size:.95rem;max-width:40rem;}
  .glossary dt{font-weight:650;} .glossary dd{margin:0 0 .5rem;color:var(--ink-soft);}
  .phones{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,21rem),1fr));gap:1.4rem;margin:1.4rem 0;}
  .opt{display:flex;flex-direction:column;background:var(--paper-raised);border:1px solid var(--paper-sunk);border-radius:var(--radius-lg);padding:1rem;}
  .opt h3{margin:0 0 .2rem;font-size:1.05rem;}
  .opt .gist{flex:1;margin:0 0 .8rem;color:var(--ink-soft);font-size:.95rem;}
  .opt.rec{border-color:var(--accent);}
  .rec-tag{display:inline-block;font-size:.75rem;font-weight:650;color:var(--accent-strong);
    background:var(--accent-tint);border-radius:999px;padding:.05rem .55rem;margin-left:.4rem;}
  .frame{width:100%;max-width:390px;aspect-ratio:390/844;margin:0 auto;border:8px solid var(--ink);
    border-radius:28px;overflow:hidden;background:var(--paper);position:relative;}
  .frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0;}
  .frame .away{position:absolute;inset:0;display:grid;place-items:center;padding:1rem;text-align:center;
    color:var(--ink-soft);font-size:.9rem;}
  .open{display:block;text-align:center;font-size:.85rem;margin:.5rem 0 0;}
  table{border-collapse:collapse;width:100%;font-size:.93rem;margin:1rem 0;}
  th,td{border:1px solid var(--paper-sunk);padding:.5rem .6rem;vertical-align:top;text-align:left;}
  th{background:var(--paper-raised);}
  td ul{margin:0;padding-left:1.1rem;}
  .scroll{overflow-x:auto;}
  code{font-size:.9em;background:var(--paper-sunk);padding:.05rem .3rem;border-radius:4px;}
</style>
</head>
<body>
<main>
<h1>When you share a verse from a phone, what should the app ask, and which links should it hand you?</h1>
<p class="lead">Until now the Share button wrote one link, to the website, and nothing else. The app now has a second
kind of link, one that opens the Mac and iPad app straight on a verse, and a link can also say what to open when it
arrives: the verse's look-alikes, or its roots. Three ways of offering that from the share button are built below,
each in a real copy of the app. Open the verse in each, tap Share, and send yourself a link.</p>

<dl class="glossary">
  <dt>Website link</dt><dd>an ordinary web address; anyone with a browser can open it.</dd>
  <dt>App link</dt><dd>an address that opens the Hifth app itself on the Mac or iPad, on the verse it names. A phone's share sheet may not know what to do with it, so the app copies it instead.</dd>
  <dt>Look-alikes</dt><dd>verses that resemble this one closely enough to be confused with it while reciting from memory.</dd>
  <dt>Roots</dt><dd>the three-letter stems the verse's words are built on.</dd>
</dl>

<h2>What should you try in each?</h2>
<p>Tap the verse, then Share. Try to get a link that opens the app on this verse with its look-alikes showing.
Notice how many taps it took, whether you knew what the link would do before you sent it, and whether the tray
covered the verse you were sharing.</p>

<div class="phones">
${OPTIONS.map(
  (o) => `  <section class="opt${o.id === "c" ? " rec" : ""}">
    <h3>${esc(o.name)}${o.id === "c" ? '<span class="rec-tag">what the app shows</span>' : ""}</h3>
    <p class="gist">${esc(o.gist)}</p>
    <div class="frame"><div class="away" data-away>This copy of the app loads on the app's own site. From a clone, run the app and open it with <b>?share=${o.id}</b> in the address.</div><iframe data-share="${o.id}" title="${esc(o.name)}" loading="lazy" hidden></iframe></div>
    <a class="open" data-open="${o.id}" hidden>Open it full screen</a>
  </section>`,
).join("\n")}
</div>

<h2>What does each one cost, and what does it lead to?</h2>
<div class="scroll"><table>
  <tr><th></th><th>What it buys</th><th>What it costs</th><th>What it commits us to</th></tr>
${OPTIONS.map((o) => `  <tr><th>${esc(o.name)}</th><td>${list(o.pros)}</td><td>${list(o.cons)}</td><td>${esc(o.then)}</td></tr>`).join("\n")}
</table></div>
<p><b>Recommended: C.</b> It is the only one where a teacher can send a student to a verse's look-alikes without
typing an address, and a reader who wants the plain link still gets it in two taps. The app shows C until the owner
says otherwise; A and B open only from this page.</p>

<h2>What was left out on purpose?</h2>
<p>The contract page's builder asks one more thing: whether the app should tell another app when it has opened the
link. That is left out here. A share sheet is handing a link to a person, and cannot know which app, if any, will
want telling; the page that builds links for a program keeps that question.</p>

<h2>Where are the reasons?</h2>
<p>In <a href="../decisions/share-sheet-builder.md">the decision record</a>, with what the app did before, what else was
looked at, and what would change the answer.</p>
</main>
<script>
  // On the site the app sits two folders above this page. From a file:// clone there is none.
  (function () {
    if (location.protocol === "file:") return;
    var app = new URL("../../", location.href);
    document.querySelectorAll("iframe[data-share]").forEach(function (f) {
      var id = f.getAttribute("data-share");
      var src = app.href + "?share=" + id + "&lang=en#/hafs-kfqc/2:48";
      f.src = src;
      f.hidden = false;
      f.previousElementSibling.hidden = true;
      var open = document.querySelector('[data-open="' + id + '"]');
      open.href = src;
      open.hidden = false;
    });
  })();
</script>
</body>
</html>
`;

if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(html))
  throw new Error("build-share-sheet-options: the page carries an Arabic codepoint");
writeFileSync(OUT, html);
console.log(`wrote ${OUT}`);
