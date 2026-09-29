#!/usr/bin/env node
/**
 * Builds docs/design/native-testflight-options.html — the drawn options for the decision
 * "native-testflight-licence": may a build of the Mac / iPad shell that carries The Study
 * Quran's commentary, and the GPL-derived verse data the site already ships, go to a few
 * named outside testers through TestFlight?
 *
 * The difference between the options is where the bytes go and under whose terms — a
 * policy, not a feel — so each option is *drawn* (the tenet allows that for a structural
 * choice) as the path the build takes from this laptop to a tester's iPad, with what is on
 * board at each step.
 *
 * Self-contained: no fonts, no CDN, no assets, and zero Arabic codepoints. Rebuild:
 *   node scripts/build-native-testflight-options.mjs
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../docs/design/native-testflight-options.html");

const C = {
  paper: "#f4efe6", raised: "#fbf8f2", sunk: "#ece4d6", ink: "#26201a", inkSoft: "#5c5347",
  inkFaint: "#6b6255", accent: "#1f6f66", accentStrong: "#17544d", accentTint: "#d7e7e3",
  gold: "#e8a13a", red: "#b3402f",
};

/**
 * Each option is a path: the stops the build passes through, and what is on board.
 * `hold` marks a stop where the bytes rest on somebody else's machine.
 */
const OPTIONS = [
  {
    id: "A",
    name: "Send the whole build to named testers through TestFlight",
    gist:
      "The private build — the mus'haf, The Study Quran's commentary beside it, and the verse " +
      "links the site already ships — is uploaded once to Apple and offered to a handful of " +
      "named people as an internal test. They install it from the TestFlight app at home.",
    stops: [
      { at: "This laptop", carries: "everything", hold: false },
      { at: "Apple's servers", carries: "everything, for up to 90 days", hold: true },
      { at: "Each tester's iPad", carries: "everything", hold: true },
    ],
    hafiz: "A tester opens the app on their own iPad, at home, with no one from this project in the room — the closest thing to the real product.",
    pros: "The pitch works the way a product does. The people who own the commentary see it on their own devices, whenever they like, and can bring it to a colleague.",
    cons: "Two licences meet Apple's terms. The verse-link data is derived from a GPL source, and the argument in the Track B note is that a GPL binary cannot accept the store's per-device terms; whether an internal test counts as that kind of distribution is a reading, not a fact. The commentary sits on Apple's servers, encrypted, for named people — the owners of the material, but on a machine that is not ours.",
    implications: "The licensing opinion the Track B note has waited on since August stops being deferrable. Needs the paid membership. Sets the precedent for every build that follows.",
  },
  {
    id: "B",
    name: "Send a build with the GPL-derived data left out",
    gist:
      "The same path as A, but the verse-link data derived from the GPL corpus is stripped " +
      "from the shell build before upload, so the binary carries only our own code, the " +
      "print, and the commentary. The testers get a mus'haf and its commentary; the hops " +
      "between look-alike verses are gone.",
    stops: [
      { at: "This laptop", carries: "everything minus the verse links", hold: false },
      { at: "Apple's servers", carries: "print, commentary, our code", hold: true },
      { at: "Each tester's iPad", carries: "print, commentary, our code", hold: true },
    ],
    hafiz: "A tester can read, select and open the commentary, but the app's one distinctive move — jump to the verse you would confuse this one with — is missing from the very demo meant to show it.",
    pros: "No GPL question on the upload. The commentary question stays, but it is the owners' own text going to the owners.",
    cons: "The demo loses its headline feature. A second build flavour to keep working, and a gate to prove the stripped build really carries nothing derived. The print's own terms are still unread by a person.",
    implications: "Two builds from one tree, forever, or until the opinion arrives. The team sees a lesser app than the one they are being asked to collaborate on.",
  },
  {
    id: "C",
    name: "Own devices only; show it in the room",
    gist:
      "No upload. The build is signed for this project's own Mac and iPad with a developer " +
      "certificate, exactly as it is today, and the pitch happens with the device in hand. " +
      "Nothing leaves the laptop but the screen.",
    stops: [
      { at: "This laptop", carries: "everything", hold: false },
      { at: "The owner's iPad and Mac", carries: "everything", hold: false },
    ],
    hafiz: "A tester holds the owner's iPad for ten minutes in a meeting. They cannot take it home, cannot open it the next morning, cannot show a colleague.",
    pros: "Already works. No licence question reopened, no membership needed, no bytes on anyone else's server.",
    cons: "The pitch is a demonstration, not a trial. Interest that forms in the room has nothing to act on afterwards. A free team's install expires after seven days.",
    implications: "The pitch is in-person only, and the TestFlight question is not answered, only postponed to the day a tester asks to keep it.",
  },
];

function drawPath(o) {
  return `<div class="path">${o.stops
    .map(
      (s, i) => `${i ? '<div class="arrow" aria-hidden="true">&rarr;</div>' : ""}
      <div class="stop${s.hold ? " hold" : ""}">
        <div class="at">${s.at}</div>
        <div class="carries">${s.carries}</div>
        ${s.hold ? '<div class="pill">on someone else’s machine</div>' : ""}
      </div>`,
    )
    .join("")}</div>`;
}

function drawOption(o) {
  return `<article class="opt" id="option-${o.id}">
  <div class="opt-head"><span class="tag">Option ${o.id}</span></div>
  <h3>${o.name}</h3>
  <p class="gist">${o.gist}</p>
  <div class="strip"><div class="strip-title">Where the build goes</div>${drawPath(o)}</div>
  <dl class="tradeoff">
    <dt>For a hafiz</dt><dd>${o.hafiz}</dd>
    <dt>What it buys</dt><dd>${o.pros}</dd>
    <dt>What it costs</dt><dd>${o.cons}</dd>
    <dt>What it commits us to</dt><dd>${o.implications}</dd>
  </dl>
</article>`;
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>May the app go to outside testers?</title>
<style>
  :root{--paper:${C.paper};--raised:${C.raised};--sunk:${C.sunk};--ink:${C.ink};--ink-soft:${C.inkSoft};--ink-faint:${C.inkFaint};--accent:${C.accent};--accent-strong:${C.accentStrong};--accent-tint:${C.accentTint};--gold:${C.gold};--red:${C.red}}
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;padding:2.5rem 1.25rem 4rem}
  .wrap{max-width:1100px;margin:0 auto}
  h1{font-size:1.9rem;line-height:1.2;margin:0 0 .5rem;text-wrap:balance}
  .status{color:var(--ink-soft);font-size:.95rem;margin:0 0 .25rem}
  .lede{color:var(--ink-soft);max-width:66ch}
  h2{font-size:1.25rem;margin:2.4rem 0 .6rem;text-wrap:balance}
  h2 .q{color:var(--accent-strong)}
  p,li{max-width:70ch}
  a{color:var(--accent-strong)}
  .gloss{background:var(--raised);border:1px solid var(--sunk);border-radius:12px;padding:1rem 1.25rem;margin:1rem 0}
  .gloss dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:.35rem 1rem}
  .gloss dt{font-weight:650;color:var(--accent-strong)}
  .gloss dd{margin:0;color:var(--ink-soft)}
  .options{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1.25rem;margin-top:1rem}
  .opt{background:var(--raised);border:1px solid var(--sunk);border-radius:14px;padding:1.1rem 1.15rem 1.35rem;display:flex;flex-direction:column}
  .tag{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:var(--accent);border-radius:999px;padding:.15rem .55rem}
  .opt h3{font-size:1.08rem;margin:.5rem 0 .5rem;line-height:1.25}
  .gist{color:var(--ink-soft);font-size:.95rem;margin:.1rem 0 .9rem}
  .strip{background:var(--paper);border:1px solid var(--sunk);border-radius:10px;padding:.7rem .75rem .6rem}
  .strip-title{font-size:.72rem;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-faint);margin-bottom:.55rem}
  .path{display:flex;flex-direction:column;gap:.25rem}
  .arrow{color:var(--ink-faint);text-align:center;transform:rotate(90deg);line-height:1}
  .stop{background:var(--raised);border:1px solid var(--sunk);border-radius:8px;padding:.45rem .6rem}
  .stop.hold{border-color:var(--gold);box-shadow:inset 0 0 0 1px var(--gold)}
  .at{font-weight:600;font-size:.9rem}
  .carries{font-size:.85rem;color:var(--ink-soft)}
  .pill{display:inline-block;margin-top:.3rem;font-size:.68rem;letter-spacing:.03em;border-radius:999px;padding:.1rem .5rem;background:var(--gold);color:#3a2a08}
  .tradeoff{margin:.9rem 0 0;display:grid;gap:.15rem}
  .tradeoff dt{font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--accent-strong);margin-top:.5rem}
  .tradeoff dd{margin:0;font-size:.9rem;color:var(--ink-soft)}
  .note-block{background:var(--accent-tint);border:1px solid var(--accent);border-radius:12px;padding:1rem 1.25rem;margin:1.4rem 0}
  .note-block strong{color:var(--accent-strong)}
  .today{border-left:4px solid var(--gold);padding:.2rem 1rem;margin:1rem 0;color:var(--ink-soft)}
  footer{margin-top:3rem;color:var(--ink-faint);font-size:.85rem;border-top:1px solid var(--sunk);padding-top:1rem}
</style>
</head>
<body>
<div class="wrap">
<header>
  <p class="status">Open decision &middot; nobody has chosen yet</p>
  <h1>May a build of the app that carries The Study Quran's commentary go to a few named outside testers through TestFlight?</h1>
  <p class="lede">The Mac and iPad app exists and runs on this project's own devices. The next step the pitch wants is
  for a handful of people at The Study Quran to install it themselves and keep it. The only way to do that on an
  iPad without a cable is Apple's TestFlight, and putting a build there means two things this project has so far
  kept off other people's servers travel through Apple's.</p>
</header>

<section class="gloss">
  <h2 style="margin-top:0"><span class="q">A few words, defined once</span></h2>
  <dl>
    <dt>The shell</dt><dd>The Mac and iPad app. It shows the web app unchanged inside a native window; it adds no data of its own.</dd>
    <dt>The private build</dt><dd>The version of the app that carries The Study Quran's commentary beside the verses. Shown only to the people who own that commentary. The public website never carries it.</dd>
    <dt>TestFlight</dt><dd>Apple's way of letting named people install an app before it is in the store. An <em>internal</em> test goes to people added to the developer account; there is no review by Apple and a build lasts 90 days.</dd>
    <dt>The verse links</dt><dd>The app's map of which verses a reader tends to confuse with which. It is computed from a scholarly corpus published under the GPL, a licence that forbids adding terms of your own when you pass the work on.</dd>
    <dt>A licensing opinion</dt><dd>A reading of the licences by someone qualified to give one. Everything this project has written about the GPL so far was written by a non-lawyer.</dd>
  </dl>
</section>

<h2><span class="q">What does it change for a hafiz?</span></h2>
<p>Nothing on screen: every option shows the same mus'haf, the same commentary, the same verse links (except B, which
loses the links). What changes is <strong>who can hold it and where</strong> &mdash; on their own iPad at home, or on the
owner's iPad in a meeting. For a hafiz on the team, that is the difference between trying the app the way they would
use it and watching it.</p>

<h2><span class="q">Why is this being asked now?</span></h2>
<p>Because the app now exists. Until 2026-09-29 the question was moot: there was no build to upload. The Track B note
argued in August that a GPL binary could not go to Apple's <em>store</em>, and nothing has changed in that argument.
TestFlight to named testers is a narrower question the note did not ask, and the pitch needs an answer to it before
the first upload &mdash; not before the build, which is done.</p>

<h2><span class="q">What happens if nobody decides?</span></h2>
<div class="today"><p><strong>Today, and by default:</strong> option C. The app runs on the owner's devices, the pitch is shown
in person, and nothing is uploaded. The two upload targets in the build refuse to run while this row is open. Nothing
breaks; the pitch is simply in-person only, and the moment a tester asks to keep the app, this question is back.</p></div>

<h2><span class="q">What do people outside this project do about this?</span></h2>
<p>Apps that ship GPL code on Apple's platforms (Signal, OsmAnd) do it because <em>every</em> copyright holder granted
an extra permission for the store's terms, which this project cannot obtain for the corpus it uses; that survey is in
the Track B note and is reused here, not redone. <strong>I did not look further</strong> for how other projects handle
TestFlight specifically, as opposed to the store: the answer turns on the licence text, not on what others chose.</p>

<h2><span class="q">What have we already decided that constrains this?</span></h2>
<ul>
  <li>The public site carries no scripture text and no held commentary, and the gates that enforce that stay on. Nothing here touches them.</li>
  <li>The private build is shown to the people who own the material, in a room, and is a mockup of a partnership rather than a release. TestFlight to those same people is the first time "in a room" would stretch to "on their own device".</li>
  <li>The Track B note's reading that the App Store is closed to a GPL binary stands, and its open item waits on a licensing opinion. This page does not reopen the store; it asks only about named testers.</li>
</ul>

<h2><span class="q">So what are the options?</span></h2>
<p>Each drawn as the path the build takes, with what is on board at each stop. A gold border marks a stop on a machine this project does not control.</p>
<div class="options">
${OPTIONS.map(drawOption).join("\n")}
</div>

<h2><span class="q">What else could be considered, and why is it not here?</span></h2>
<p><em>Ad-hoc signing</em> (a build tied to each tester's device number, sent as a file) needs the same paid membership as
TestFlight, the tester's device number in advance, and a cable or a hosted file to install from; it moves the bytes off
Apple's servers only to put them on ours, and for iPad it is the harder road. <em>Sending the Mac app as a file</em> avoids
Apple entirely but hits the "damaged app" warning on every Mac since macOS 15 unless it is notarised, which again needs the
paid membership and a Developer ID; it is a fallback for the Mac only, not an answer for the iPad, and the iPad is the
device the pitch is for.</p>

<h2><span class="q">What would change the answer?</span></h2>
<p>A licensing opinion that reads an internal TestFlight test as private sharing rather than distribution would make A
plain. One that reads it the other way would make B the only upload. A change in what the shell carries &mdash; if the verse
links were rederived from a corpus under a permissive licence &mdash; would dissolve the GPL half entirely and leave only the
commentary, which is the owners' own.</p>

<h2><span class="q">What is this not settling?</span></h2>
<p>Not the App Store; that stays closed and waits on the same opinion. Not whether the print's own terms allow any of this;
that reading is still owed by a person and is a separate row. Not Universal Links, which need the same membership and are
their own item. Only this: whether the first upload to Apple may happen, and with what on board.</p>

<footer>
  <p>Rebuilt by the page's own builder; carries no scripture and no external assets. This is a decision page in the project's
  own register &mdash; open the register to see where it sits among the others.</p>
</footer>
</div>
</body>
</html>
`;

const arabic = html.match(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g);
if (arabic) {
  console.error(`Refusing to write: ${arabic.length} Arabic codepoint(s) found.`);
  process.exit(1);
}
writeFileSync(OUT, html);
console.log(`Wrote ${OUT} (${html.length} bytes)`);
