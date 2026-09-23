#!/usr/bin/env node
/**
 * Build docs/design/arabic-number-agreement-review.html — a one-sitting sheet a
 * hafiz fills to settle the Arabic number-agreement defect (issue
 * `arabic-number-agreement`, docs/design/i18n.md ①).
 *
 * WHY THIS SHEET. Eight interface strings put a count next to an Arabic noun that
 * must agree with it, and Arabic needs six forms where the table writes one — so
 * "٤٨ صفحة" reads to a hafiz like a typo. The fix is one small edit per string,
 * but each edit needs a hafiz's eye on the grammar, which is the only reason the
 * defect has sat open. This turns that vague "needs a hafiz" into a concrete,
 * fillable list.
 *
 * THE KEY SIMPLIFICATION. Agreement is a property of the NOUN, not the string, and
 * only five nouns recur across the eight strings — page, link, ayah, word,
 * occurrence. `page` is already done (its six forms live in the shipped
 * `distancePages` message), so it is shown as the worked model. That leaves four
 * nouns × six forms for a hafiz to confirm — not thirty-seven scattered edits.
 *
 * The draft forms below are modelled on the already-shipped `page` forms so the
 * hafiz reviews rather than authors; every one is theirs to correct. Wiring each
 * confirmed noun back into the eight strings — three of which also need a one-line
 * code change to pass the raw count — is the author's job, not the hafiz's, and is
 * noted on the page so nobody waits on it.
 *
 * Reads the shipped catalogs so the "today" column and the `page` model cannot
 * drift from what the app actually renders. Writes one self-contained HTML page.
 *
 *   node scripts/build-arabic-number-review.mjs      # → docs/design/…-review.html
 *   make arabic-number-review
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const MSG = join(REPO, "apps", "web", "src", "messages");
const OUT = join(REPO, "docs", "design", "arabic-number-agreement-review.html");

const ar = JSON.parse(readFileSync(join(MSG, "ar.json"), "utf8"));

// The six CLDR plural categories Arabic uses, with a plain gloss and a count that
// actually occurs in this app so the hafiz sees the real number+noun pairing.
const CATEGORIES = [
  { id: "zero", gloss: "none — a count of nothing", example: "0" },
  { id: "one", gloss: "exactly one", example: "1" },
  { id: "two", gloss: "exactly two — Arabic has a dual", example: "2" },
  { id: "few", gloss: "three to ten", example: "7" },
  { id: "many", gloss: "eleven to ninety-nine", example: "48" },
  { id: "other", gloss: "a hundred or more", example: "604" },
];

// Eastern-Arabic digits, so a preview reads the way the app renders it.
const eastern = (s) => String(s).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);

// The nouns, the strings each one lives in, and where a reader meets them. `page`
// carries the shipped six forms as the model; the rest carry drafts to confirm.
const NOUNS = [
  {
    id: "page",
    done: true,
    en: "page",
    where:
      "How far one verse sits from another on the rail, and how much of the mus'haf has loaded.",
    strings: ["distancePages", "pagesVendored"],
    // The shipped, already-approved forms, read straight from the catalog.
    forms: extractPluralForms(ar.distancePages) ?? {},
  },
  {
    id: "link",
    en: "link — a related-verse link",
    where:
      "The number of related-verse links on a verse's rail, and in the screen-reader label that announces a highlighted passage.",
    strings: ["railSummary", "rangeAria"],
    today: "روابط",
    draft: {
      zero: "{n} رابط",
      one: "رابط واحد",
      two: "رابطان",
      few: "{n} روابط",
      many: "{n} رابطًا",
      other: "{n} رابط",
    },
  },
  {
    id: "ayah",
    en: "ayah — a verse",
    where: "How many verses sit on the current page (the page legend), and how large a root's set of verses is.",
    strings: ["legendCountOnPage", "rootsStats"],
    today: "آية",
    draft: {
      zero: "{n} آية",
      one: "آية واحدة",
      two: "آيتان",
      few: "{n} آيات",
      many: "{n} آية",
      other: "{n} آية",
    },
  },
  {
    id: "word",
    en: "word",
    where: "How many words share a root — in the root-lens stats line and the occurrences count.",
    strings: ["rootsStats", "rootsOccurrences"],
    today: "كلمات",
    draft: {
      zero: "{n} كلمة",
      one: "كلمة واحدة",
      two: "كلمتان",
      few: "{n} كلمات",
      many: "{n} كلمة",
      other: "{n} كلمة",
    },
  },
  {
    id: "occurrence",
    en: "occurrence — a place a root appears",
    where: "When the root list is trimmed to the closest matches: “nearest N occurrences only.”",
    strings: ["rootsTruncated"],
    today: "مواضع",
    draft: {
      zero: "{n} موضع",
      one: "موضع واحد",
      two: "موضعان",
      few: "{n} مواضع",
      many: "{n} موضعًا",
      other: "{n} موضع",
    },
  },
];

// Which strings already receive the raw count (a pure catalog edit) and which need
// a one-line change first to pass it — the author's follow-up, surfaced so it is honest.
const WIRING = {
  distancePages: { code: false, note: "already done — the model." },
  legendCountOnPage: { code: false, note: "catalog edit only — the count already reaches it." },
  rootsStats: { code: false, note: "catalog edit only — both counts already reach it." },
  rootsOccurrences: { code: false, note: "catalog edit only — the count already reaches it." },
  rangeAria: { code: false, note: "catalog edit only — the count already reaches it." },
  pagesVendored: { code: true, note: "needs one line to pass the page count, then the catalog edit." },
  railSummary: { code: true, note: "needs one line to pass the link count, then the catalog edit." },
  rootsTruncated: { code: true, note: "needs one line to pass the count, then the catalog edit." },
};

/** Pull the six forms out of a shipped `{n, plural, …}` Arabic string, if present. */
function extractPluralForms(icu) {
  if (typeof icu !== "string") return null;
  const out = {};
  for (const cat of CATEGORIES) {
    // {n, plural, … cat{ <form> } …} — balance one level of braces inside the arm.
    const at = icu.indexOf(`${cat.id}{`);
    if (at === -1) continue;
    let i = at + cat.id.length + 1;
    let depth = 1;
    let buf = "";
    for (; i < icu.length && depth > 0; i++) {
      const ch = icu[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) break;
      }
      buf += ch;
    }
    out[cat.id] = buf;
  }
  return Object.keys(out).length ? out : null;
}

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Render one form with its example count substituted, for the live-preview column.
const preview = (form, example) =>
  esc(eastern(String(form).replace(/\{n\}|\{nText\}/g, example)));

function nounCard(noun) {
  const forms = noun.done ? noun.forms : noun.draft;
  const rows = CATEGORIES.map((cat) => {
    const val = forms[cat.id] ?? "";
    const ex = eastern(cat.example);
    const input = noun.done
      ? `<span class="form done" dir="rtl">${esc(val)}</span>`
      : `<input class="form" dir="rtl" data-noun="${noun.id}" data-cat="${cat.id}" value="${esc(val)}">`;
    return `<tr>
      <th scope="row"><b>${cat.id}</b><span class="gloss">${cat.gloss}</span></th>
      <td class="ex">${ex}</td>
      <td>${input}</td>
      <td class="prev" dir="rtl" data-noun="${noun.id}" data-cat="${cat.id}">${preview(val, ex)}</td>
    </tr>`;
  }).join("\n");

  const where = noun.strings
    .map((s) => `<code>${s}</code> <span class="wnote">${esc(WIRING[s]?.note ?? "")}</span>`)
    .join("<br>");

  const today = noun.done
    ? `<span class="tag ok">already done — the pattern to copy</span>`
    : `<span class="tag">today, one form for every count: <b dir="rtl">${esc(noun.today)}</b></span>`;

  return `<section class="card ${noun.done ? "done" : ""}">
    <h3>${esc(noun.en)} ${today}</h3>
    <p class="where">${esc(noun.where)}</p>
    <p class="lives">Lives in: ${where}</p>
    <table>
      <thead><tr><th>category</th><th>e.g.</th><th>the Arabic form</th><th>reads as</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

const cards = NOUNS.map(nounCard).join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Arabic number agreement — review</title>
<meta name="description" content="A one-sitting sheet to confirm the Arabic plural forms the app needs for counts.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Spectral:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
  :root{
    --paper:#F1EBDC;--paper-2:#E9E1CE;--raise:#FBF7EE;--ink:#262019;--ink-2:#6A5F4B;--ink-3:#90836B;
    --line:#D7CDB6;--line-soft:#E3DAC5;--amber:#B0740F;--amber-ink:#7C5309;--amber-soft:rgba(176,116,15,.15);
    --teal:#2C685C;--teal-soft:rgba(44,104,92,.13);--clay:#A5472C;
    --shadow:0 1px 2px rgba(38,32,25,.06),0 10px 30px rgba(38,32,25,.09);
    --serif:'Spectral',Georgia,serif;--arab:'Amiri','Spectral',serif;--mono:'IBM Plex Mono',ui-monospace,Menlo,monospace;
  }
  :root:not([data-theme="light"]){@media (prefers-color-scheme:dark){
    --paper:#171308;--paper-2:#1F1A0F;--raise:#241E12;--ink:#EDE5D2;--ink-2:#B0A483;--ink-3:#857A5E;
    --line:#362D1B;--line-soft:#2C2415;--amber:#E0A63C;--amber-ink:#F0C266;--amber-soft:rgba(224,166,60,.16);
    --teal:#74B7A6;--teal-soft:rgba(116,183,166,.15);--clay:#DB8261;
    --shadow:0 1px 2px rgba(0,0,0,.4),0 14px 40px rgba(0,0,0,.5);
  }}
  :root[data-theme="dark"]{
    --paper:#171308;--paper-2:#1F1A0F;--raise:#241E12;--ink:#EDE5D2;--ink-2:#B0A483;--ink-3:#857A5E;
    --line:#362D1B;--line-soft:#2C2415;--amber:#E0A63C;--amber-ink:#F0C266;--amber-soft:rgba(224,166,60,.16);
    --teal:#74B7A6;--teal-soft:rgba(116,183,166,.15);--clay:#DB8261;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--serif);
    line-height:1.55;font-size:17px;padding:0 16px 5rem}
  main{max-width:760px;margin:0 auto}
  header{padding:2.4rem 0 1rem}
  h1{font-size:1.9rem;margin:0 0 .3rem;font-weight:700}
  .lede{color:var(--ink-2);font-size:1.05rem;margin:.2rem 0 1rem}
  .how{background:var(--raise);border:1px solid var(--line);border-radius:12px;padding:1rem 1.2rem;margin:1.2rem 0}
  .how ol{margin:.4rem 0 0;padding-inline-start:1.2rem}
  .how li{margin:.35rem 0}
  h2{font-size:1.05rem;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-3);
    margin:2.4rem 0 .8rem;font-weight:600}
  .card{background:var(--raise);border:1px solid var(--line);border-radius:14px;padding:1.2rem 1.3rem;margin:1rem 0;box-shadow:var(--shadow)}
  .card.done{background:var(--teal-soft);border-color:rgba(44,104,92,.3)}
  .card h3{margin:0 0 .3rem;font-size:1.25rem}
  .where{color:var(--ink-2);margin:.2rem 0 .5rem}
  .lives{font-size:.82rem;color:var(--ink-3);margin:.2rem 0 .8rem;font-family:var(--mono)}
  .lives code{color:var(--amber-ink)}
  .wnote{color:var(--ink-3);font-family:var(--serif)}
  .tag{display:inline-block;font-size:.8rem;font-family:var(--serif);color:var(--ink-2);
    background:var(--amber-soft);border-radius:20px;padding:.1rem .7rem;vertical-align:middle;margin-inline-start:.4rem}
  .tag b{font-family:var(--arab);font-size:1.15rem}
  .tag.ok{background:var(--teal-soft);color:var(--teal)}
  table{width:100%;border-collapse:collapse;margin-top:.5rem}
  th,td{text-align:start;padding:.5rem .5rem;border-bottom:1px solid var(--line-soft);vertical-align:middle}
  thead th{font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-3);font-weight:600;border-bottom:1px solid var(--line)}
  tbody th{font-weight:400;white-space:nowrap}
  tbody th b{font-family:var(--mono);color:var(--amber-ink);font-weight:600}
  .gloss{display:block;font-size:.76rem;color:var(--ink-3)}
  td.ex{font-family:var(--mono);color:var(--ink-2);text-align:center;width:2.5rem}
  input.form,.form.done{font-family:var(--arab);font-size:1.5rem;width:100%;padding:.25rem .5rem;
    border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink)}
  .form.done{display:block;border-style:dashed;background:transparent;border-color:transparent}
  td.prev{font-family:var(--arab);font-size:1.5rem;color:var(--teal);width:6rem}
  .actions{position:sticky;bottom:0;background:var(--paper);padding:1rem 0;border-top:1px solid var(--line);margin-top:2rem}
  button{font-family:var(--serif);font-size:1rem;padding:.6rem 1.3rem;border-radius:10px;border:1px solid var(--amber);
    background:var(--amber);color:#fff;cursor:pointer}
  button.ghost{background:transparent;color:var(--amber-ink)}
  textarea{width:100%;height:12rem;margin-top:1rem;font-family:var(--mono);font-size:.8rem;
    border:1px solid var(--line);border-radius:10px;background:var(--paper-2);color:var(--ink);padding:.8rem;display:none}
  footer{color:var(--ink-3);font-size:.9rem;margin-top:2.5rem;border-top:1px solid var(--line-soft);padding-top:1.2rem}
  code{font-family:var(--mono);font-size:.85em}
</style>
</head>
<body>
<main>
<header>
  <h1>Arabic number agreement — a sheet to fill</h1>
  <p class="lede">The app shows counts next to Arabic words — “48 pages”, “7 links”. English uses two
  shapes of a word (one page / many pages); Arabic uses six, and by which count it is. Right now the
  app writes one shape for all counts, so a reader who knows Arabic sees “٤٨ صفحة” and reads a typo.
  This settles it — about ten minutes.</p>
  <div class="how">
    <b>How to use this</b>
    <ol>
      <li>Each card below is one word. The <b>page</b> card at the top is already done — it is the
      pattern the others copy.</li>
      <li>For each of the other four words, read the six forms. They are filled in with a first draft;
      correct any that are wrong. The green column shows how each reads with a real number in it.</li>
      <li>When they look right, press <b>Copy the confirmed forms</b> at the bottom and send the text
      back. Wiring them into the app — including three lines of code so three of the strings receive
      the count at all — is on me, not you.</li>
    </ol>
  </div>
</header>

<h2>The six forms Arabic asks for</h2>
<div class="card">
  <table>
    <thead><tr><th>category</th><th>when the count is…</th></tr></thead>
    <tbody>
    ${CATEGORIES.map(
      (c) => `<tr><th scope="row"><b>${c.id}</b></th><td>${c.gloss} — e.g. ${eastern(c.example)}</td></tr>`,
    ).join("\n")}
    </tbody>
  </table>
</div>

<h2>The words</h2>
${cards}

<div class="actions">
  <button id="copy">Copy the confirmed forms</button>
  <button class="ghost" id="reset">Reset drafts</button>
  <textarea id="out" readonly></textarea>
</div>

<footer>
  <p>Drawn from the app's own message catalog, so the “today” column and the finished <b>page</b>
  word cannot drift from what ships. Rebuilt by <code>scripts/build-arabic-number-review.mjs</code>
  (<code>make arabic-number-review</code>). The defect it settles is <code>arabic-number-agreement</code>,
  named in the interface-wording notes.</p>
</footer>
</main>
<script>
  const DRAFT = ${JSON.stringify(Object.fromEntries(NOUNS.filter((n) => !n.done).map((n) => [n.id, n.draft])))};
  const EASTERN = (s)=>String(s).replace(/[0-9]/g,d=>"٠١٢٣٤٥٦٧٨٩"[+d]);
  const EX = ${JSON.stringify(Object.fromEntries(CATEGORIES.map((c) => [c.id, c.example])))};
  function sync(inp){
    const prev=document.querySelector('.prev[data-noun="'+inp.dataset.noun+'"][data-cat="'+inp.dataset.cat+'"]');
    if(prev) prev.textContent=EASTERN(inp.value.replace(/\\{n\\}|\\{nText\\}/g, EX[inp.dataset.cat]));
  }
  document.querySelectorAll('input.form').forEach(inp=>inp.addEventListener('input',()=>sync(inp)));
  document.getElementById('copy').addEventListener('click',()=>{
    const res={};
    document.querySelectorAll('input.form').forEach(inp=>{
      (res[inp.dataset.noun] ||= {})[inp.dataset.cat]=inp.value;
    });
    const out=document.getElementById('out');
    out.style.display='block';
    out.value=JSON.stringify(res,null,2);
    out.select();
    try{navigator.clipboard.writeText(out.value);}catch(e){}
  });
  document.getElementById('reset').addEventListener('click',()=>{
    document.querySelectorAll('input.form').forEach(inp=>{
      inp.value=DRAFT[inp.dataset.noun][inp.dataset.cat];sync(inp);
    });
    document.getElementById('out').style.display='none';
  });
</script>
</body>
</html>
`;

writeFileSync(OUT, html);
const remaining = NOUNS.filter((n) => !n.done).length;
console.log(
  `docs/design/arabic-number-agreement-review.html — ${NOUNS.length} nouns ` +
    `(${remaining} to confirm, page done as model), ${CATEGORIES.length} forms each.`,
);
