/**
 * The one renderer for a ledger check, shared by every HTML surface that draws
 * one.
 *
 * There are two of those now — `build-validation-guide.mjs` (the read-only
 * field guide, all checks, served to a phone) and `session.mjs` (one check,
 * live, capturing what you do). They exist for different reasons and neither is
 * redundant, but they must never disagree about what a step *says*. A runbook
 * that reads one way on the guide and another in the session is worse than
 * having only one of them: the disagreement is silent, and the person following
 * it has no way to know which page is the stale one.
 *
 * So the words come from docs/validation/ledger.json, and the markup around
 * them comes from here. What each surface owns is its own chrome — the guide's
 * index and its checkbox persistence, the session's capture bar — never a
 * second copy of a step.
 */
import { readEvidence } from "../validation-ledger.mjs";

/* ── text ──────────────────────────────────────────────────────────────── */

export const attr = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// An Arabic run must start AND end on an Arabic character: pulling a trailing
// ASCII period or colon inside the isolate flips it to the far side of the
// phrase, which is exactly the mangling the isolate is here to prevent.
const ARABIC_RUN =
  /[؀-ۿݐ-ݿ](?:[؀-ۿݐ-ݿ\s]*[؀-ۿݐ-ݿ])?/g;

/**
 * Escape, then honour the three bits of markup the ledger's prose actually
 * uses (**bold**, `code`, → arrows survive as-is), and isolate Arabic runs.
 *
 * The isolation is not cosmetic: these runbooks quote the app's own Arabic UI
 * strings inside English sentences, and without `<bdi>` the bidi algorithm
 * drags neighbouring punctuation — the « » quotes, the trailing colon — to the
 * wrong end of the line, so the instruction names a button that appears to be
 * called something else.
 */
export function rich(text) {
  return attr(text)
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(ARABIC_RUN, (m) => `<bdi>${m}</bdi>`);
}

/* ── the parts of a card ───────────────────────────────────────────────── */

/**
 * The picture of what the step's `expect` line describes.
 *
 * Emitted whether or not the file is on disk. A missing shot should look
 * broken: the alternative is that it quietly vanishes from the page and only
 * `gate:validation` ever knows, which is how a guide ends up promising a
 * picture in the terminal and showing none on the phone.
 */
export function shot(id) {
  if (!id) return "";
  return `<figure class="shot">
          <img src="shots/${attr(id)}.png" alt="Screenshot: ${attr(id)}" loading="lazy">
          <figcaption>from the build · a shape to recognise, not a result to match</figcaption>
        </figure>`;
}

export function list(title, items) {
  if (!(items ?? []).length) return "";
  return `<section class="block">
    <h3>${title}</h3>
    <ul class="bullets">${items.map((i) => `<li>${rich(i)}</li>`).join("")}</ul>
  </section>`;
}

/**
 * What a command already did, and — the part that matters — what it could not.
 *
 * This block sits above "What you need" because it changes how much of the card
 * is yours before you read any of it. The residue is rendered as prominently as
 * the discharge on purpose: the risk this feature introduces is a page that
 * looks mostly struck through and reads as "nearly automated", when what is
 * left is the whole reason the check exists.
 */
export function machine(check, ran, struck) {
  if (!check.evidence?.run) return "";
  const state = !ran ? "never-run" : ran.outcome;
  return `<section class="block machine is-${attr(state)}">
    <h3>Already done for you</h3>
    <pre class="cmd">${rich(check.evidence.run)}</pre>
    <p class="expect">${
      ran
        ? `<b>${attr(state)}</b> · ${attr(ran.ranAt.slice(0, 10))} · ${attr(ran.commit ?? "?")} · ${attr(ran.on)} — ${
            struck.size ? `${struck.size} step(s) below are struck through` : "nothing struck through"
          }`
        : `Never run on this tree. Run <code>make validate-auto</code> on the laptop, then <code>make guide</code> — until then every step below is still yours.`
    }</p>
    <p class="tunes-lead">What it cannot do — still yours:</p>
    <ul class="bullets">${(check.evidence.residue ?? []).map((r) => `<li>${rich(r)}</li>`).join("")}</ul>
  </section>`;
}

/**
 * Which of a check's steps a real command has already discharged.
 *
 * Only `pass` strikes. A producer that could not reach its subject (exit 3) has
 * proved nothing, and letting that discharge a human's step is precisely how a
 * muted watcher comes to look covered.
 */
export function struckSteps(check) {
  const ran = check.evidence?.run ? readEvidence(check.id) : null;
  const struck = new Set(ran?.outcome === "pass" ? (check.evidence.covers ?? []) : []);
  return { ran, struck };
}

/**
 * One check, whole.
 *
 * `capture` is the only difference between the guide's card and the session's:
 * it stamps each step with its ledger id as well as its position, because a
 * transcript that recorded positions would silently re-point itself the day
 * somebody reorders a runbook. Same rule `evidence.covers` already lives under.
 */
export function card(check, { capture = false } = {}) {
  const rb = check.runbook ?? {};
  const done = check.status === "done";
  const blocked = (rb.needs ?? []).some((n) => /not runnable yet/i.test(n));
  const { ran, struck } = struckSteps(check);

  return `<article class="card${done ? " is-done" : ""}" id="${attr(check.id)}">
  <div class="head">
    <span class="badge${done ? " ok" : blocked ? " wait" : ""}">${
      done ? "done" : blocked ? "blocked" : "outstanding"
    }</span>
    <h2>${rich(check.title)}</h2>
    <p class="id"><code>${attr(check.id)}</code>${
      (check.blocks ?? []).length ? ` · blocks ${check.blocks.map((b) => `<b>${rich(b)}</b>`).join(", ")}` : ""
    }${check.staleAfterDays ? ` · repeats every ${check.staleAfterDays} days` : ""}</p>
  </div>

  <p class="why">${rich(check.why)}</p>
  ${
    done
      ? `<p class="verdict"><b>Verdict ${attr(check.verifiedOn ?? "")}:</b> ${rich(check.result ?? "")}</p>`
      : ""
  }

  ${machine(check, ran, struck)}
  ${list("What you need", rb.needs)}
  ${
    (rb.setup ?? []).length
      ? `<section class="block">
    <h3>Setup — on the laptop</h3>
    ${rb.setup
      .map(
        (s) => `<pre class="cmd">${rich(s.run)}</pre>
    ${s.expect ? `<p class="expect">${rich(s.expect)}</p>` : ""}`,
      )
      .join("\n")}
  </section>`
      : ""
  }

  ${
    (rb.steps ?? []).length
      ? `<section class="block">
    <h3>Steps${capture ? "" : " — on the phone"}</h3>
    <ol class="steps">
      ${rb.steps
        .map((s, i) =>
          s.id && struck.has(s.id)
            ? // Struck, not deleted. The step is still the runbook's own account
              // of what this check is; hiding it would leave the person on the
              // phone unable to tell a discharged step from one nobody wrote.
              `<li class="struck">
        <p class="do"><s>${rich(s.do)}</s></p>
        <p class="expect">Done by <code>${attr(check.evidence.run)}</code> on ${attr(ran.ranAt.slice(0, 10))}. Skip it.</p>
      </li>`
            : `<li${capture ? ` data-step-li="${attr(s.id ?? i)}"` : ""}>
        <label class="do"><input type="checkbox" data-step="${attr(check.id)}:${i}"${
          capture ? ` data-step-id="${attr(s.id ?? "")}" data-step-index="${i}" data-step-do="${attr(s.do)}"` : ""
        }><span>${rich(s.do)}</span></label>
        <p class="expect">${rich(s.expect)}</p>
        ${shot(s.shot)}
        ${s.why ? `<p class="why">${rich(s.why)}</p>` : ""}
        ${capture ? note(check.id, s.id ?? String(i)) : ""}
      </li>`,
        )
        .join("\n      ")}
    </ol>
  </section>`
      : ""
  }

  ${list("Reading the result", rb.reading)}

  <section class="block record">
    <h3>Record it</h3>
    <pre class="cmd">${rich(rb.record ?? `make record CHECK=${check.id} RESULT='<the verdict>'`)}</pre>
    <p class="tunes-lead">Then do what it tunes:</p>
    <ul class="tunes">${(check.tunes ?? []).map((t) => `<li>${rich(t)}</li>`).join("")}</ul>
    ${check.record ? `<p class="expect">Written up in ${rich(check.record)}</p>` : ""}
  </section>
</article>`;
}

/**
 * The box you type into while the step is still in front of you.
 *
 * Session pages only. This is the whole reason the session surface exists: the
 * ledger's `result` has always been written from memory at the end of a
 * walkthrough, so whatever you noticed at step four survives only if you were
 * still holding it fifteen minutes later. A note written here lands on disk
 * before you have moved on.
 */
function note(checkId, stepKey) {
  return `<div class="note">
          <label for="n-${attr(checkId)}-${attr(stepKey)}">Anything you noticed — banked as you type</label>
          <textarea id="n-${attr(checkId)}-${attr(stepKey)}" data-note="${attr(stepKey)}" rows="2"
            placeholder="what actually happened, in your words"></textarea>
        </div>`;
}

/* ── the look ──────────────────────────────────────────────────────────── */
//
// Deliberately not the app's paper-and-ink palette. This is a tool for the
// person testing the product, and a tool that looks like the product is a tool
// someone will eventually mistake for the product — in a screenshot, in a bug
// report, in a share sheet. Night workshop: cold ground, one warm accent
// (amber, the same wash the app puts on a selected ayah, so the through-line is
// still there), hairline rules for structure and nothing else.

export const CSS = `
:root {
  --ground: #0f1319; --raised: #161c25; --line: #263140;
  --text: #e6ebf2; --dim: #9aa7b8; --amber: #f0a65a; --green: #7fd4a0; --wait: #b6a4d8;
  --mono: ui-monospace, SFMono-Regular, Menlo, monospace;
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0; background: var(--ground); color: var(--text);
  font: 17px/1.55 ui-serif, Georgia, "Times New Roman", serif;
  padding: 0 16px env(safe-area-inset-bottom) 16px;
}
bdi { font-family: ui-sans-serif, system-ui, sans-serif; }
b { color: #fff; font-weight: 600; }
code { font: 0.85em/1.4 var(--mono); color: var(--amber); overflow-wrap: anywhere; }

.top { max-width: 44rem; margin: 0 auto; padding: 40px 0 8px; }
.kicker { margin: 0; font: 600 13px/1 var(--mono); letter-spacing: .18em;
  text-transform: uppercase; color: var(--amber); }
h1 { margin: 8px 0 4px; font-size: 40px; line-height: 1; letter-spacing: -.02em; }
.lede { margin: 0 0 18px; color: var(--dim); }
.rule { margin: 0; padding: 14px 16px; border-left: 3px solid var(--amber);
  background: var(--raised); font-size: 15px; }
.src { margin: 14px 0 0; font-size: 13px; color: var(--dim); }

main { max-width: 44rem; margin: 0 auto; }
.card { margin: 28px 0; padding: 20px 18px 6px; background: var(--raised);
  border: 1px solid var(--line); border-radius: 14px; }
.card.is-done { opacity: .72; }
.head h2 { margin: 10px 0 2px; font-size: 25px; line-height: 1.2; letter-spacing: -.01em; }
.id { margin: 0 0 14px; font-size: 13px; color: var(--dim); }
.badge { display: inline-block; padding: 3px 9px; border-radius: 999px;
  font: 600 11px/1.5 var(--mono); letter-spacing: .1em; text-transform: uppercase;
  color: var(--ground); background: var(--amber); }
.badge.ok { background: var(--green); }
.badge.wait { background: var(--wait); }
.why { margin: 0 0 4px; color: var(--dim); font-size: 15.5px; }
.verdict { margin: 12px 0 0; padding: 10px 12px; border-left: 3px solid var(--green);
  background: #131a17; font-size: 15px; }

.block { margin: 22px 0; }
.block h3 { margin: 0 0 10px; font: 600 12px/1 var(--mono); letter-spacing: .16em;
  text-transform: uppercase; color: var(--dim); }
.bullets, .tunes { margin: 0; padding-left: 1.1em; }
.bullets li, .tunes li { margin: 0 0 9px; }
.tunes li { font-size: 15px; color: var(--dim); }
.tunes-lead { margin: 16px 0 6px; font-size: 15px; }

pre.cmd { margin: 0 0 10px; padding: 12px 14px; overflow-x: auto;
  background: #0a0d12; border: 1px solid var(--line); border-radius: 9px;
  font: 14px/1.5 var(--mono); color: var(--green); white-space: pre-wrap;
  overflow-wrap: anywhere; -webkit-user-select: all; user-select: all; }

/* The expectation is the whole point of a step: what you should see if it is
   working. It gets its own slab so it cannot be skimmed past. */
.expect { margin: 6px 0 0; padding: 9px 12px 9px 14px; border-left: 2px solid var(--line);
  background: #121820; color: var(--dim); font-size: 15px; border-radius: 0 8px 8px 0; }
.expect::before { content: "expect "; font: 600 11px/1 var(--mono); letter-spacing: .14em;
  text-transform: uppercase; color: var(--amber); }

/* And what the step buys. Quieter than the expectation on purpose — it is the
   line you read when you are tempted to skip the step, not on every pass. An
   expectation nobody can justify is one a tired reader waves through. */
.why { margin: 8px 0 0; padding-left: 14px; color: var(--dim); font-size: 14px; line-height: 1.55; }
.why::before { content: "why "; font: 600 11px/1 var(--mono); letter-spacing: .14em;
  text-transform: uppercase; color: var(--wait); }

/* A description of a screen you have never seen cannot be checked against the
   screen. These come from e2e/shots.spec.ts against the real build — never a
   hand-crop, which would be a second copy of the UI, drifting silently. */
figure.shot { margin: 10px 0 0; }
figure.shot img { display: block; width: 100%; max-width: 300px; height: auto;
  border: 1px solid var(--line); border-radius: 10px; background: var(--ground); }
figure.shot figcaption { margin-top: 6px; font: 500 10px/1.4 var(--mono);
  letter-spacing: .12em; text-transform: uppercase; color: var(--dim); opacity: .75; }

ol.steps { margin: 0; padding-left: 1.4em; }
ol.steps > li { margin: 0 0 18px; padding-left: 4px; }
ol.steps > li::marker { color: var(--amber); font-family: var(--mono); font-size: 14px; }
label.do { display: flex; gap: 12px; align-items: flex-start; min-height: 44px;
  cursor: pointer; -webkit-tap-highlight-color: transparent; }
label.do input { flex: none; width: 24px; height: 24px; margin: 8px 0 0; accent-color: var(--amber); }
label.do input:checked + span { color: var(--dim); text-decoration: line-through;
  text-decoration-color: var(--line); }
label.do span { padding: 8px 0; }

/* What a command already did. Bordered like a card-within-a-card because it is
   the only block on the page that subtracts work, and the reader has to be able
   to see at a glance which claim is doing the subtracting. The left edge is
   green only on a real pass — a "could not tell" gets the waiting colour, since
   an unreachable subject proves nothing and strikes nothing. */
.machine { padding: 14px 16px; border: 1px solid var(--line); border-left-width: 3px;
  border-radius: 0 10px 10px 0; background: #0d1219; }
.machine.is-pass { border-left-color: var(--green); }
.machine.is-fail { border-left-color: #e07a6a; }
.machine.is-unknown, .machine.is-never-run { border-left-color: var(--wait); }
.machine .expect::before { content: "ran "; }

/* Struck, not hidden. A step that vanished would be indistinguishable from one
   nobody ever wrote, and the runbook is also the description of what the check
   is — so it stays legible, just visibly not yours. */
ol.steps > li.struck { opacity: .62; }
li.struck .do { margin: 0; padding: 8px 0 0; }
li.struck s { text-decoration-color: var(--green); }
li.struck .expect::before { content: "machine "; color: var(--green); }

.record { border-top: 1px solid var(--line); padding-top: 18px; }
.foot { max-width: 44rem; margin: 0 auto; padding: 8px 0 48px; color: var(--dim); font-size: 15px; }

@media (min-width: 46rem) { body { padding: 0 24px; } .card { padding: 26px 26px 10px; } }
@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
`;
