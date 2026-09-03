# Keeping the options that lost, now that the losers are working code

*Status: decided — **option A**, chosen by the owner on 2 September 2026. Every option a felt
choice draws stays on its page, still tryable; nothing is deleted, and the page and the app
build from the same code. This record states the question, draws the three options, and records
the choice. It is a rule about our own workshop, not about the reader's screen, and it applies
to every choice made by hand from here on — the two page-bar questions are only the first to
force it. The losing options B and C stay drawn below, because they are the reason the choice
was a choice, and the reopening test is what would bring them back.*

**The picture — and a thing you can compare:**
<https://blog.bytesofpurpose.com/hifth/docs/design/graduation-losers-options.html> —
[`graduation-losers-options.html`](../design/graduation-losers-options.html), checked in and
rebuilt by `scripts/build-graduation-options.mjs`. The address is the page's own on the app's
site, so it is public the day the page is merged. It draws each policy as the shape it would
leave on the page-bar decision, now that that page is settled.

## A few words, defined once

- **The decision page** — a page built to make one choice, that draws each option and, when
  the difference is *felt*, lets a reader try it by hand.
- **An option you can try** — a small, self-contained component built so it can be mounted on
  the decision page and, if it wins, moved into the app unchanged.
- **To graduate** — to move a winning option out of the decision page and into the shipped app.
- **The winner / the losers** — the option the owner chose, and the ones it beat.

## What is being decided?

When a design question is settled by letting people try each option on a page, what happens to
the options that lost — do they stay on the page, still tryable, or are they deleted?

## Why is this being asked now?

The page bar just settled two questions this way. *Does a juz marker pull the released page
onto it?* — won by "a marker is a button". *Whose juz is a boundary page?* — won by "both, on
the four seam pages". Each was decided by a reader dragging or switching the real options, not
by reading about them, so for the first time the losing options are **working code sitting
beside the app** — the detent strategies in `packages/core/src/decision-options/detent-strategy.ts`
and the boundary rules in `boundary-juz-rule.ts` — rather than pictures on a page. The winners
are ready to graduate into `PageSlider`, and they cannot move cleanly until we know what to do
with their losing siblings, because the graduation touches the same module those siblings live in.

## The two rules that disagree

- **`CLAUDE.md`, the live-options tenet, and PLAN follow-up 18:** when a felt option wins, "the
  component that wins graduates into the app and the losers are deleted, so nothing was throwaway
  that the choice did not need."
- **The `decide` skill:** "The losing options stay on the page. They are the reason the choice
  was a choice, and the next person to reopen this will want them."

Both are ours; both are right about something. For a *drawn* option they never collide — a
losing picture costs nothing to keep. For a *felt* option they do: the only way to keep a felt
loser tryable is to keep its code, and the only way to delete its code is to lose the ability to
show what lost. This decision is where that collision gets resolved, once, as a rule.

## What happens if nobody decides?

Nothing shipped is wrong — the bar works today. But the graduation (task #46, PLAN follow-up 18,
issue `plan-graduate-page-bar-winners`) stays parked, because moving the winners means deciding
the fate of the losers in the same edit. The cost is a blockage of one piece of work, not a defect.

## What do people outside this project do about this?

This is a question about our workshop, not the mus'haf, so the prior art is software practice: a
**component catalog** keeps every variant tryable long after one ships; a **deprecation shelf**
keeps old code reachable-but-marked so nothing imports it by accident. Option C is those two
ideas put together. **I did not survey specific tools** — I reasoned from the general practice,
because the decision is about how we keep our own record and no other project's answer transfers
without knowing how it draws its choices.

## What have we already decided that touches this?

- [`juz-detents`](./page-bar.md#when-a-reader-lets-go-near-a-marker-should-the-bar-pull-the-page-onto-it)
  and [`boundary-juz`](./page-bar.md#when-a-juz-begins-partway-down-a-page-which-juz-is-that-page-in) —
  the two decisions this governs. Their record states the standing rule that an option whose
  difference is felt is *built, not only drawn*. That rule is exactly what makes this question
  sharp: it is why the losers are code, and code is what this decides the fate of.

## The options

Drawn in full on the page above; in short:

- **A · Keep every option, still there to try.** The page and the app build from the same code;
  nothing is deleted. Keeps the feel of every loser intact; costs a shared module carrying three
  ways to do one job, where a later edit could wire a loser into the app by mistake.
- **B · Keep only the winner; leave a written note.** The losing components are deleted; the page
  names what it beat in prose. Keeps the code honest and minimal; costs the ability to re-feel a
  felt option, so the choice is far harder to reopen than the note implies.
- **C · Keep them tryable, but wall them off from the app.** The losers move to a page-only place
  the shipped app cannot import; the app is wired to the winner alone. Keeps both the feel and the
  guarantee that only the winner can ship; costs a seam — which folder is page-only, which is
  shipped, and a check that the shipped side never imports the page-only one.

## What else could be considered, and why is it not here?

**Delete the losers but keep a recording** — a short screen capture of each losing option in
motion, embedded in the record. It answers the same need as C (re-feel what lost) but with a
video, which cannot be dragged, resized, or checked against a later change to the app. It is a
fallback for a felt loser whose code genuinely cannot be kept, not a general rule.

## What would change the answer?

If keeping the losing code cost the app real size or speed — a page-only option pulling weight
into the shipped bundle — the balance would tip to B. It does not today: the losers are a few
pure functions. If the project stopped making felt choices and returned to drawn-only ones, the
question would dissolve and A and B would be indistinguishable.

## What is this not settling?

Not *how* a wall between page-only and shipped code is drawn or checked, if C wins — that is a
build detail for the graduation. Not the two page-bar choices themselves; those are made. Only
this: once a choice is made by hand, what becomes of the hands-on options it beat.
